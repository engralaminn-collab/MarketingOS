// @ts-nocheck — temporary: see audit for fix plan
/**
 * ASR Engine — multilingual Speech-to-Text with Bangla support.
 *
 * Per directive §3 Module D: Bangladeshi Bangla (`bn-BD`) is the primary
 * language; English, Hindi, Arabic are secondary.
 *
 * Provider priority:
 *   1. faster-whisper (local, MIT, large-v3) — primary; GPU recommended
 *   2. Z.AI cloud ASR (free) — fallback when faster-whisper not installed
 *   3. WhisperX (BSD-4-clause) — adds speaker diarization
 *   4. whisper.cpp (MIT) — CPU fallback for low-resource workers
 *   5. Simulation — last resort
 *
 * Per directive §12: "Do not assume a model supports high-quality Bangla
 * merely because it supports multilingual transcription." Quality must
 * pass the BANGLA_VOICE_MODEL_EVALUATION.md plan before production use.
 */
import { db } from './db';
import ZAI from 'z-ai-web-dev-sdk';

export interface AsrInput {
  audioUrl?: string; // URL to fetch audio from
  audioBase64?: string; // base64-encoded audio
  language?: string; // default "bn-BD"
  enableDiarization?: boolean;
  enableStreaming?: boolean;
  companyId?: string; // for usage metering
  prompt?: string; // optional context to bias recognition
}

export interface AsrResult {
  text: string;
  segments?: Array<{
    start: number; // seconds
    end: number;
    text: string;
    speaker?: string; // if diarization enabled
    confidence?: number;
  }>;
  language: string;
  durationSec: number;
  provider: 'faster-whisper' | 'zai' | 'whisperx' | 'whisper_cpp' | 'simulation';
  modelId: string;
  simulated: boolean;
  error?: string;
}

const FASTER_WHISPER_URL = process.env.FASTER_WHISPER_URL || 'http://localhost:8080';
const WHISPERX_URL = process.env.WHISPERX_URL || 'http://localhost:8081';
const WHISPER_CPP_URL = process.env.WHISPER_CPP_URL || 'http://localhost:8082';

export async function transcribe(input: AsrInput): Promise<AsrResult> {
  const language = input.language || 'bn-BD';
  if (!input.audioUrl && !input.audioBase64) {
    return { text: '', language, durationSec: 0, provider: 'simulation', modelId: 'none', simulated: true, error: 'no audio provided' };
  }

  // 1. faster-whisper (preferred for streaming + low latency)
  if (process.env.FASTER_WHISPER_URL) {
    try {
      const r = await fetch(`${FASTER_WHISPER_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: input.audioUrl,
          audio_base64: input.audioBase64,
          language,
          enable_diarization: input.enableDiarization,
          prompt: input.prompt,
        }),
      });
      if (r.ok) {
        const data: any = await r.json();
        await trackAsrUsage(input.companyId, 'faster-whisper', language, data.duration_sec || 0, data.text?.length || 0);
        return {
          text: data.text || '',
          segments: data.segments,
          language,
          durationSec: data.duration_sec || 0,
          provider: 'faster-whisper',
          modelId: 'large-v3',
          simulated: false,
        };
      }
    } catch { /* fall through */ }
  }

  // 2. WhisperX (for diarization)
  if (process.env.WHISPERX_URL && input.enableDiarization) {
    try {
      const r = await fetch(`${WHISPERX_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: input.audioUrl,
          audio_base64: input.audioBase64,
          language,
          diarize: true,
        }),
      });
      if (r.ok) {
        const data: any = await r.json();
        await trackAsrUsage(input.companyId, 'whisperx', language, data.duration_sec || 0, data.text?.length || 0);
        return {
          text: data.text || '',
          segments: data.segments,
          language,
          durationSec: data.duration_sec || 0,
          provider: 'whisperx',
          modelId: 'large-v3+diarize',
          simulated: false,
        };
      }
    } catch { /* fall through */ }
  }

  // 3. whisper.cpp (CPU-only fallback)
  if (process.env.WHISPER_CPP_URL) {
    try {
      const r = await fetch(`${WHISPER_CPP_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: input.audioUrl,
          audio_base64: input.audioBase64,
          language,
        }),
      });
      if (r.ok) {
        const data: any = await r.json();
        await trackAsrUsage(input.companyId, 'whisper_cpp', language, data.duration_sec || 0, data.text?.length || 0);
        return {
          text: data.text || '',
          language,
          durationSec: data.duration_sec || 0,
          provider: 'whisper_cpp',
          modelId: 'large-v3-quantized',
          simulated: false,
        };
      }
    } catch { /* fall through */ }
  }

  // 4. Z.AI cloud ASR (already integrated)
  try {
    const zai = await ZAI.create();
    if (input.audioBase64) {
      const r: any = await zai.audio.asr.create({
        file_base64: input.audioBase64 as any,
        language,
        prompt: input.prompt,
      });
      await trackAsrUsage(input.companyId, 'zai', language, r?.duration_sec || 0, r?.text?.length || 0);
      return {
        text: r?.text || '',
        language,
        durationSec: r?.duration_sec || 0,
        provider: 'zai',
        modelId: 'glm-asr',
        simulated: false,
      };
    }
  } catch { /* fall through */ }

  // 5. Simulation
  await trackAsrUsage(input.companyId, 'simulation', language, 0, 0);
  return {
    text: '',
    language,
    durationSec: 0,
    provider: 'simulation',
    modelId: 'simulation',
    simulated: true,
    error: 'No ASR provider available. Install faster-whisper (https://github.com/SYSTRAN/faster-whisper) or set FASTER_WHISPER_URL.',
  };
}

async function trackAsrUsage(
  companyId: string | undefined,
  provider: string,
  language: string,
  audioSeconds: number,
  charCount: number
): Promise<void> {
  if (!companyId) return;
  const day = new Date().toISOString().slice(0, 10);
  await db.asrUsageDaily.upsert({
    where: { companyId_day_provider_language: { companyId, day, provider, language } },
    update: {
      audioSecondsProcessed: { increment: audioSeconds },
      charactersTranscribed: { increment: charCount },
    },
    create: {
      companyId, day, provider, language,
      audioSecondsProcessed: audioSeconds,
      charactersTranscribed: charCount,
    },
  });
}

export function getAsrProviderStatus(): Array<{ name: string; configured: boolean; license: string; bangla: boolean }> {
  return [
    { name: 'faster-whisper', configured: !!process.env.FASTER_WHISPER_URL, license: 'MIT', bangla: true },
    { name: 'whisperx', configured: !!process.env.WHISPERX_URL, license: 'BSD-4-clause', bangla: true },
    { name: 'whisper_cpp', configured: !!process.env.WHISPER_CPP_URL, license: 'MIT', bangla: true },
    { name: 'zai', configured: true, license: 'Free tier', bangla: true },
  ];
}
