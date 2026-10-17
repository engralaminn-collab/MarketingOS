/**
 * AI Extensions — consolidated AI capabilities library.
 * Inspired by: akitaonrails/ai-memory, blader/humanizer, debpalash/VoiceStudio,
 * heygen/hyperframes, MoneyPrinterTurbo, mksglu/context-mode
 */
import { db } from './db';
import { generateChatCompletion, generateLocalImage, generateLocalVideo, getLocalVideoStatus, generateLocalSpeech } from './ai-provider';

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
    const completion = await generateChatCompletion([
      { role: 'system', content: `Rewrite this text to sound more natural and human. Use ${tone} tone. Remove AI-typical phrases. Return ONLY the rewritten text.` },
      { role: 'user', content: text },
    ]);
    return completion.content;
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

// ─── Self-hosted image generation ───────────────────────────────
export async function generateImage(prompt: string, size: string = '1024x1024'): Promise<{ url: string; prompt: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    const result = await generateLocalImage(prompt, size);
    return { url: result.dataUrl, prompt };
  } catch (error) {
    console.error('[local-image] generation unavailable:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

// ─── Self-hosted video generation ────────────────────────────────
export async function generateVideo(prompt: string): Promise<{ videoUrl: string; taskId: string; status: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    return await generateLocalVideo(prompt);
  } catch (error) {
    console.error('[local-video] generation unavailable:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

// ─── Self-hosted video status polling ────────────────────────────
export async function getVideoStatus(taskId: string): Promise<{ status: string; videoUrl: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    return await getLocalVideoStatus(taskId);
  } catch (error) {
    console.error('[local-video] status unavailable:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

// ─── Self-hosted text-to-speech ──────────────────────────────────
export async function generateSpeech(text: string, voice: string = 'default'): Promise<{ audioUrl: string } | null> {
  if (!isZaiMediaEnabled()) return null;
  try {
    return await generateLocalSpeech(text, voice);
  } catch (error) {
    console.error('[local-tts] generation unavailable:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}
