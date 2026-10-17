/**
 * AI Extensions — consolidated AI capabilities library.
 * Inspired by: akitaonrails/ai-memory, blader/humanizer, debpalash/VoiceStudio,
 * heygen/hyperframes, MoneyPrinterTurbo, mksglu/context-mode
 */
import { db } from './db';
import ZAI from 'z-ai-web-dev-sdk';
import { createChatCompletion } from './ai-provider';

/** Paid/hosted media generation is opt-in; self-hosted Ollama remains the default for text. */
function isZaiMediaEnabled(): boolean {
  return process.env.ZAI_MEDIA_ENABLED === 'true';
}

// ─── AI Memory (akitaonrails/ai-memory) ──────────────────────────
export async function storeMemory(companyId: string, agentType: string, category: string, content: string, metadata?: any): Promise<void> {
  try {
    const employee = await db.employee.findFirst({ where: { companyId }, take: 1 });
    if (!employee) return;
    await db.employeeMemory.create({
      data: { employeeId: employee.id, memoryType: 'semantic', category, title: `${agentType}: ${content.slice(0, 80)}`, content, metadata: JSON.stringify(metadata || {}), relevance: 1.0, sourceType: 'execution', companyId },
    });
  } catch (err) { console.error('[ai-memory] store failed:', err); }
}

export async function retrieveMemories(companyId: string, agentType: string, category?: string, limit = 10): Promise<any[]> {
  try {
    const employee = await db.employee.findFirst({ where: { companyId }, take: 1 });
    if (!employee) return [];
    const where: any = { employeeId: employee.id };
    if (category) where.category = category;
    const memories = await db.employeeMemory.findMany({ where, orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }], take: limit });
    return memories.map(m => ({ id: m.id, agentType, category: m.category || 'general', content: m.content, createdAt: m.createdAt.toISOString() }));
  } catch (err) { console.error('[ai-memory] retrieve failed:', err); return []; }
}

// ─── Text Humanizer (blader/humanizer) ──────────────────────────
export async function humanizeText(
  text: string,
  tone: 'casual' | 'professional' | 'friendly' | 'persuasive' = 'casual',
  companyId = '',
): Promise<{ text: string; provider: string | null; source: 'ai' | 'rules' }> {
  try {
    const completion = await createChatCompletion(companyId, [
      { role: 'system', content: `Rewrite this text to sound more natural and human. Use ${tone} tone. Remove AI-typical phrases. Return ONLY the rewritten text.` },
      { role: 'user', content: text },
    ]);
    return { text: completion.content || text, provider: completion.provider, source: 'ai' };
  } catch {
    return { text: humanizeFallback(text, tone), provider: null, source: 'rules' };
  }
}

function humanizeFallback(text: string, tone: string): string {
  let r = text.replace(/in order to/gi, 'to').replace(/leverage/gi, 'use').replace(/utilize/gi, 'use')
    .replace(/delve into/gi, 'explore').replace(/cutting-edge/gi, 'modern').replace(/robust/gi, 'strong')
    .replace(/comprehensive/gi, 'complete').replace(/seamless/gi, 'smooth').replace(/it's worth noting that/gi, '')
    .replace(/in today's fast-paced world/gi, 'today').replace(/  +/g, ' ').trim();
  if (tone === 'casual' || tone === 'friendly') {
    r = r.replace(/\bdo not\b/gi, "don't").replace(/\bis not\b/gi, "isn't").replace(/\bcan not\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't").replace(/\byou are\b/gi, "you're").replace(/\bit is\b/gi, "it's");
  }
  return r;
}

// ─── AI Image Generation (heygen/hyperframes) ───────────────────
// The SDK returns { created, data: [{ base64 }] }. Images are delivered as
// base64 data URIs, not remote URLs. We convert to a data URL so the UI can
// render them without a separate hosting step.
export async function generateImage(prompt: string, size: string = '1024x1024'): Promise<{ url: string; prompt: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    const zai = await ZAI.create();
    const result = await zai.images.generations.create({ prompt, size: size as '1024x1024' });
    const base64 = result.data?.[0]?.base64;
    if (!base64) return null;
    const url = `data:image/png;base64,${base64}`;
    return { url, prompt };
  } catch { return null; }
}

// ─── AI Video Generation (MoneyPrinterTurbo) ────────────────────
// The SDK returns { id, task_status: 'PROCESSING' | 'SUCCESS' | 'FAIL' }.
// The actual video URL is retrieved later via zai.async.result.query(taskId).
// This function initiates the generation and returns the task ID for polling.
export async function generateVideo(prompt: string): Promise<{ videoUrl: string; taskId: string; status: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    const zai = await ZAI.create();
    const result = await zai.video.generations.create({ prompt });
    const taskId = result.id;
    const status = result.task_status === 'SUCCESS' ? 'completed'
      : result.task_status === 'FAIL' ? 'failed'
      : 'processing';
    // Video URL is not available immediately — must poll zai.async.result.query(taskId)
    return { videoUrl: '', taskId, status };
  } catch { return null; }
}

// ─── AI Video Status Polling ────────────────────────────────────
// Poll the async result endpoint to get the final video URL.
export async function getVideoStatus(taskId: string): Promise<{ status: string; videoUrl: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    const zai = await ZAI.create();
    const result = await zai.async.result.query(taskId);
    const status = result.task_status === 'SUCCESS' ? 'completed'
      : result.task_status === 'FAIL' ? 'failed'
      : 'processing';
    const videoUrl = result.video_url || result.url || result.video_result?.[0]?.url || '';
    return { status, videoUrl };
  } catch { return null; }
}

// ─── AI Voice/TTS (debpalash/VoiceStudio) ──────────────────────
export async function generateSpeech(text: string, voice: string = 'default'): Promise<{ audioUrl: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    const zai = await ZAI.create();
    const result = await zai.audio.tts.create({ input: text, voice }) as Record<string, unknown>;
    const url = (result.url as string) || (result.audio_url as string) || null;
    return url ? { audioUrl: url } : null;
  } catch { return null; }
}
