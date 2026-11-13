// @ts-nocheck — temporary: see audit for fix plan
/**
 * AI Memory — persistent memory for AI agents across conversations.
 * Inspired by akitaonrails/ai-memory pattern.
 *
 * Each agent can store and retrieve memories (facts, context, decisions)
 * that persist across sessions. This makes agents "remember" what they
 * learned about leads, companies, and user preferences.
 */
import { db } from './db';

export interface MemoryItem {
  id: string;
  agentType: string;
  category: string;
  content: string;
  metadata: string;
  relevance: number;
  accessCount: number;
  createdAt: string;
  lastAccessedAt: string | null;
}

/**
 * Store a memory for an agent type.
 * Used after an agent learns something new (e.g. "TechVault uses GitHub Enterprise").
 */
export async function storeMemory(
  companyId: string,
  agentType: string,
  category: string,
  content: string,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    // Find any employee in the company (agents use EmployeeMemory as storage)
    const employee = await db.employee.findFirst({
      where: { companyId },
      take: 1,
    });

    if (!employee) {
      console.log('[ai-memory] No employee found for company', companyId, '— skipping memory store');
      return;
    }

    await db.employeeMemory.create({
      data: {
        employeeId: employee.id,
        memoryType: 'semantic',
        category,
        title: `${agentType} memory: ${content.slice(0, 80)}`,
        content,
        metadata: JSON.stringify(metadata || {}),
        relevance: 1.0,
        sourceType: 'execution',
        companyId,
      },
    });
  } catch (err) {
    console.error('[ai-memory] storeMemory failed:', err);
  }
}

/**
 * Retrieve relevant memories for an agent type.
 * Returns the most relevant + recently accessed memories.
 */
export async function retrieveMemories(
  companyId: string,
  agentType: string,
  category?: string,
  limit = 10,
): Promise<MemoryItem[]> {
  try {
    const employee = await db.employee.findFirst({
      where: { companyId },
      take: 1,
    });

    if (!employee) return [];

    const where: any = { employeeId: employee.id };
    if (category) where.category = category;

    const memories = await db.employeeMemory.findMany({
      where,
      orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

  // Increment access count (async, non-blocking)
    for (const m of memories) {
      db.employeeMemory.update({
        where: { id: m.id },
        data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
      }).catch(() => {});
    }

    return memories.map((m) => ({
    id: m.id,
    agentType,
    category: m.category || 'general',
    content: m.content,
    metadata: m.metadata,
    relevance: m.relevance,
    accessCount: m.accessCount,
    createdAt: m.createdAt.toISOString(),
    lastAccessedAt: m.lastAccessedAt?.toISOString() || null,
    }));
  } catch (err) {
    console.error('[ai-memory] retrieveMemories failed:', err);
    return [];
  }
}

/**
 * Humanize AI-generated text — makes it sound more natural and human.
 * Inspired by blader/humanizer pattern.
 *
 * Uses the z-ai-web-dev-sdk to rewrite AI-generated text in a more
 * conversational, human tone. Falls back to rule-based humanization
 * when the LLM is unavailable.
 */
import ZAI from 'z-ai-web-dev-sdk';

export async function humanizeText(
  text: string,
  tone: 'casual' | 'professional' | 'friendly' | 'persuasive' = 'casual',
): Promise<string> {
  // Try LLM first
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a text humanizer. Rewrite the given text to sound more natural, conversational, and human. Make it sound like a real person wrote it — not an AI. Use ${tone} tone. Keep the same meaning but make it flow naturally. Don't add fluff. Don't use words like "delve", "leverage", "robust", "cutting-edge", or "in today's fast-paced world". Return ONLY the rewritten text.`,
        },
        { role: 'user', content: text },
      ],
      thinking: { type: 'disabled' },
    });
    return completion.choices[0]?.message?.content || text;
  } catch {
    // Fallback: rule-based humanization
    return humanizeFallback(text, tone);
  }
}

/**
 * Rule-based humanization fallback when LLM is unavailable.
 */
function humanizeFallback(text: string, tone: string): string {
  let result = text;

  // Remove AI-typical phrases
  const aiPhrases: Record<string, string> = {
    'in today\'s fast-paced world': 'today',
    'in the ever-evolving landscape': 'right now',
    'it\'s worth noting that': '',
    'it is important to note that': '',
    'it\'s important to understand that': '',
    'when it comes to': 'for',
    'in order to': 'to',
    'a wide range of': 'many',
    'a myriad of': 'many',
    'a plethora of': 'many',
    'delve into': 'explore',
    'leverage': 'use',
    'utilize': 'use',
    'facilitate': 'help',
    'comprehensive': 'complete',
    'robust': 'strong',
    'cutting-edge': 'modern',
    'state-of-the-art': 'modern',
    'seamless': 'smooth',
    'game-changing': 'powerful',
    'revolutionary': 'new',
    'paradigm shift': 'big change',
    'holistic approach': 'complete approach',
    'best-in-class': 'top',
    'world-class': 'great',
    'industry-leading': 'leading',
    'next-generation': 'new',
  };

  for (const [ai, human] of Object.entries(aiPhrases)) {
    result = result.replace(new RegExp(ai, 'gi'), human);
  }

  // Fix double spaces from replacements
  result = result.replace(/  +/g, ' ').replace(/^ +| +$/gm, '');

  // Add contractions for casual tone
  if (tone === 'casual' || tone === 'friendly') {
    result = result
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bdoes not\b/gi, "doesn't")
      .replace(/\bcan not\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't")
      .replace(/\bis not\b/gi, "isn't")
      .replace(/\bare not\b/gi, "aren't")
      .replace(/\bhave not\b/gi, "haven't")
      .replace(/\bhas not\b/gi, "hasn't")
      .replace(/\byou are\b/gi, "you're")
      .replace(/\bit is\b/gi, "it's")
      .replace(/\bthat is\b/gi, "that's")
      .replace(/\bwe are\b/gi, "we're")
      .replace(/\bthey are\b/gi, "they're");
  }

  return result;
}

/**
 * Generate an image via z-ai-web-dev-sdk.
 * Inspired by heygen-com/hyperframes + ComfyUI patterns.
 */
export async function generateImage(
  prompt: string,
  size: '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' = '1024x1024',
): Promise<{ url: string; prompt: string } | null> {
  try {
    const zai = await ZAI.create();
    const result = await zai.images.generations.create({
      prompt,
      size,
    });
    const imageUrl = result.data?.[0]?.url || result.url || null;
    if (!imageUrl) return null;
    return { url: imageUrl, prompt };
  } catch {
    return null;
  }
}

/**
 * Generate a video via z-ai-web-dev-sdk.
 * Inspired by MoneyPrinterTurbo pattern.
 */
export async function generateVideo(
  prompt: string,
): Promise<{ videoUrl: string; taskId: string; status: string } | null> {
  try {
    const zai = await ZAI.create();
    // The SDK supports video generation via async API
    const result = await zai.video.generations.create({
      prompt,
    });

    // Video generation is async — return the task ID
    const taskId = result.id || result.taskId || result.task_id || `vid_${Date.now()}`;
    return {
      videoUrl: result.videoUrl || result.video_url || '',
      taskId,
      status: result.status || 'processing',
    };
  } catch {
    return null;
  }
}

/**
 * Generate speech (text-to-speech) via z-ai-web-dev-sdk.
 * Inspired by debpalash/VoiceStudio pattern.
 */
export async function generateSpeech(
  text: string,
  voice: string = 'default',
): Promise<{ audioUrl: string; duration?: number } | null> {
  try {
    const zai = await ZAI.create();
    const result = await zai.audio.tts.create({
      input: text,
      voice,
    });
    const audioUrl = result.url || result.audio_url || '';
    if (!audioUrl) return null;
    return { audioUrl, duration: result.duration };
  } catch {
    return null;
  }
}


// Restored from arena branch (PR #14/#15)

export async function transcribeFreeSpeech(params: {
  audioBase64: string;
  mimeType?: string;
  language?: string;
}): Promise<{ text: string; provider: string; segments?: Array<{ start: number; end: number; text: string }> } | null> {
  const cleanB64 = params.audioBase64.replace(/^data:[^;]+;base64,/, '');
  const bytes = Buffer.from(cleanB64, 'base64');
  if (!bytes.byteLength || bytes.byteLength > 25 * 1024 * 1024) return null;

  const endpoints: Array<{ name: string; url: string; key: string; model: string }> = [];
  if (process.env.LOCAL_STT_BASE_URL) {
    endpoints.push({
      name: 'local-whisper',
      url: `${process.env.LOCAL_STT_BASE_URL.replace(/\/+$/, '')}/v1/audio/transcriptions`,
      key: process.env.LOCAL_STT_API_KEY || '',
      model: process.env.LOCAL_STT_MODEL || 'whisper-1',
    });
  }
  // No hosted fallback: uploading audio off-premises may incur charges and
  // requires an explicit privacy/cost approval flow, which is not implemented.


  for (const ep of endpoints) {
    try {
      const form = new FormData();
      const blob = new Blob([bytes], { type: params.mimeType || 'audio/webm' });
      form.append('file', blob, 'recording.webm');
      form.append('model', ep.model);
      form.append('response_format', 'verbose_json');
      if (params.language) form.append('language', params.language);

      const headers: Record<string, string> = {};
      if (ep.key) headers.Authorization = `Bearer ${ep.key}`;

      const resp = await fetch(ep.url, {
        method: 'POST',
        headers,
        body: form,
        signal: AbortSignal.timeout(45_000),
      });
      if (resp.ok) {
        const json = (await resp.json()) as {
          text?: string;
          segments?: Array<{ start: number; end: number; text: string }>;
        };
        if (json.text) {
          return { text: json.text.trim(), provider: ep.name, segments: json.segments };
        }
      }
    } catch {
      // local STT failed; no hosted fallback
    }
  }
  return null;
}

export function analyzeAiWritingTells(text: string): {
  aiSlopScore: number;
  hits: HumanizerPatternHit[];
  rewrittenDeterministic: string;
} {
  const hits: HumanizerPatternHit[] = [];
  let rewritten = text;
  let penalty = 0;

  for (const rule of HUMANIZER_RULES) {
    const found = text.match(rule.regex) || [];
    if (rule.id === 'em-dash-overuse' && found.length < 3) continue;
    if (found.length > 0) {
      const unique = Array.from(new Set(found.map((m) => m.trim()))).slice(0, 5);
      hits.push({
        id: rule.id,
        category: rule.category,
        rule: rule.rule,
        matches: unique,
        severity: rule.severity,
      });
      const weight = rule.severity === 'high' ? 16 : rule.severity === 'medium' ? 10 : 5;
      penalty += Math.min(weight * found.length, weight * 2.5);
      if (rule.replace) {
        rewritten = rule.replace(rewritten);
      }
    }
  }

  rewritten = rewritten.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const aiSlopScore = Math.max(0, Math.min(100, Math.round(penalty)));
  return { aiSlopScore, hits, rewrittenDeterministic: rewritten };
}
