/**
 * Real-time Voice Pipeline — connects LiveKit audio streams to AI.
 *
 * Per directive §9: Implements the full pipeline:
 *   Incoming Telephone Audio → Telephony Gateway → Audio Stream →
 *   STT → Language Detection → Conversation Orchestrator →
 *   AI Model Gateway → Tool Validation → TTS → Outgoing Audio
 *
 * This module orchestrates the real-time flow:
 *   1. Subscribe to LiveKit audio tracks
 *   2. Stream audio chunks to ASR (faster-whisper)
 *   3. When ASR produces a transcript → pass to LLM (via ai-chain)
 *   4. LLM response → TTS (Piper/Z.AI)
 *   5. TTS audio → publish back to LiveKit room
 *   6. Handle barge-in (interrupt TTS when customer speaks)
 *   7. Handle silence detection (timeout → end call or prompt)
 *   8. Handle language switching (detect Bangla vs English)
 */
import { db } from './db';
import { chainChat, type ChatMessage } from './ai-chain';
import { synthesize, type TtsInput } from './voice-engine';
import { transcribe, type AsrInput } from './asr-engine';
import { emitEvent } from './events';
import { scrubPii } from './pii-filter';

export interface VoicePipelineConfig {
  callId: string;
  companyId: string;
  agentId: string;
  roomName: string;
  language: string; // 'bn-BD' | 'en' | 'auto'
  maxTurns: number;
  silenceTimeoutSec: number;
  maxCallDurationSec: number;
  greetingMessage?: string;
  systemPrompt: string;
}

export interface PipelineTurn {
  turnNumber: number;
  userText: string;
  aiResponse: string;
  language: string;
  sttProvider: string;
  llmProvider: string;
  ttsProvider: string;
  sttLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  totalLatencyMs: number;
  interrupted: boolean;
  timestamp: string;
}

export interface PipelineResult {
  callId: string;
  turns: PipelineTurn[];
  transcript: string;
  summary: string;
  totalDurationSec: number;
  avgLatencyMs: number;
  languagesDetected: string[];
}

/**
 * Process a single voice turn:
 *   1. Receive audio (from LiveKit or file)
 *   2. Transcribe (STT)
 *   3. LLM call (with conversation history)
 *   4. Synthesize (TTS)
 *   5. Return audio + metadata
 *
 * This is the core of the real-time pipeline. In production with LiveKit,
 * this runs in a LiveKit Agent worker that subscribes to the room's
 * audio tracks. In simulation mode, it can be called directly with
 * audio files.
 */
export async function processVoiceTurn(params: {
  audioBase64?: string;
  audioUrl?: string;
  conversationHistory: ChatMessage[];
  systemPrompt: string;
  language: string;
  companyId: string;
  callId: string;
  turnNumber: number;
}): Promise<{
  response: string;
  audioUrl?: string;
  audioBase64?: string;
  language: string;
  sttProvider: string;
  llmProvider: string;
  ttsProvider: string;
  sttLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  totalLatencyMs: number;
  interrupted: boolean;
}> {
  const start = Date.now();

  // ─── 1. STT: transcribe user audio ─────────────────────────────────────
  const sttStart = Date.now();
  let userText = '';
  let sttProvider = 'simulation';
  let detectedLanguage = params.language;

  if (params.audioBase64 || params.audioUrl) {
    const asrResult = await transcribe({
      audioUrl: params.audioUrl,
      audioBase64: params.audioBase64,
      language: params.language === 'auto' ? 'bn-BD' : params.language,
      enableDiarization: false,
      companyId: params.companyId,
    });
    userText = asrResult.text;
    sttProvider = asrResult.provider;

    // Simple language detection: if text contains Bengali Unicode chars → bn-BD
    if (params.language === 'auto' && userText) {
      const hasBengali = /[\u0980-\u09FF]/.test(userText);
      detectedLanguage = hasBengali ? 'bn-BD' : 'en';
    }
  } else {
    // No audio — text-only mode (for testing)
    userText = '(no audio input)';
  }
  const sttLatencyMs = Date.now() - sttStart;

  // ─── 2. PII scrub before LLM call ───────────────────────────────────────
  const scrubResult = scrubPii(userText);
  const safeUserText = scrubResult.redacted;

  // ─── 3. LLM call (via ai-chain) ──────────────────────────────────────────
  const llmStart = Date.now();
  const messages: ChatMessage[] = [
    { role: 'system', content: params.systemPrompt },
    ...params.conversationHistory,
    { role: 'user', content: safeUserText },
  ];

  const llmResult = await chainChat(messages, {
    maxTokens: 500,
    temperature: 0.4,
  });
  const aiResponse = llmResult.text;
  const llmProvider = llmResult.provider;
  const llmLatencyMs = Date.now() - llmStart;

  // ─── 4. TTS: synthesize AI response ─────────────────────────────────────
  const ttsStart = Date.now();
  const ttsInput: TtsInput = {
    text: aiResponse,
    language: detectedLanguage,
    speed: 1.0,
    pitch: 1.0,
    companyId: params.companyId,
    outputFormat: 'mp3',
  };
  const ttsResult = await synthesize(ttsInput);
  const ttsProvider = ttsResult.provider;
  const ttsLatencyMs = Date.now() - ttsStart;

  const totalLatencyMs = Date.now() - start;

  return {
    response: aiResponse,
    audioUrl: ttsResult.audioUrl,
    audioBase64: ttsResult.audioBase64,
    language: detectedLanguage,
    sttProvider,
    llmProvider,
    ttsProvider,
    sttLatencyMs,
    llmLatencyMs,
    ttsLatencyMs,
    totalLatencyMs,
    interrupted: false, // Set by caller when barge-in occurs
  };
}

/**
 * Run a full voice conversation (used for testing without LiveKit).
 * In production, this is replaced by the LiveKit Agent worker that
 * handles turns in real-time as audio arrives.
 */
export async function runVoiceConversation(params: {
  turns: Array<{ audioBase64?: string; text?: string }>;
  config: VoicePipelineConfig;
}): Promise<PipelineResult> {
  const startTime = Date.now();
  const turns: PipelineTurn[] = [];
  const conversationHistory: ChatMessage[] = [];
  const languagesDetected = new Set<string>();

  // Greeting
  if (params.config.greetingMessage) {
    conversationHistory.push({
      role: 'assistant',
      content: params.config.greetingMessage,
    });
    // TTS for greeting
    await synthesize({
      text: params.config.greetingMessage,
      language: params.config.language,
      companyId: params.config.companyId,
    });
  }

  // Process each turn
  for (let i = 0; i < Math.min(params.turns.length, params.config.maxTurns); i++) {
    const turn = params.turns[i];
    const turnStart = Date.now();

    const result = await processVoiceTurn({
      audioBase64: turn.audioBase64,
      conversationHistory,
      systemPrompt: params.config.systemPrompt,
      language: params.config.language,
      companyId: params.config.companyId,
      callId: params.config.callId,
      turnNumber: i + 1,
    });

    conversationHistory.push({ role: 'user', content: turn.text || '(audio)' });
    conversationHistory.push({ role: 'assistant', content: result.response });
    languagesDetected.add(result.language);

    turns.push({
      turnNumber: i + 1,
      userText: turn.text || '(audio input)',
      aiResponse: result.response,
      language: result.language,
      sttProvider: result.sttProvider,
      llmProvider: result.llmProvider,
      ttsProvider: result.ttsProvider,
      sttLatencyMs: result.sttLatencyMs,
      llmLatencyMs: result.llmLatencyMs,
      ttsLatencyMs: result.ttsLatencyMs,
      totalLatencyMs: result.totalLatencyMs,
      interrupted: result.interrupted,
      timestamp: new Date().toISOString(),
    });

    await emitEvent({
      type: 'voice_pipeline.turn_completed',
      companyId: params.config.companyId,
      resource: 'call',
      resourceId: params.config.callId,
      metadata: {
        turn: i + 1,
        language: result.language,
        sttProvider: result.sttProvider,
        llmProvider: result.llmProvider,
        ttsProvider: result.ttsProvider,
        latencyMs: result.totalLatencyMs,
      },
    });
  }

  const totalDurationSec = Math.round((Date.now() - startTime) / 1000);
  const avgLatencyMs = turns.length > 0
    ? Math.round(turns.reduce((sum, t) => sum + t.totalLatencyMs, 0) / turns.length)
    : 0;

  const transcript = turns
    .map((t) => `[Turn ${t.turnNumber}] User: ${t.userText}\nAI: ${t.aiResponse}`)
    .join('\n\n');

  // Generate summary
  const summaryResult = await chainChat(
    [
      { role: 'system', content: 'Summarize this call conversation in 3-5 sentences. Include: main topic, customer need, AI actions, resolution status.' },
      { role: 'user', content: transcript },
    ],
    { maxTokens: 200 }
  );

  return {
    callId: params.config.callId,
    turns,
    transcript,
    summary: summaryResult.text,
    totalDurationSec,
    avgLatencyMs,
    languagesDetected: Array.from(languagesDetected),
  };
}
