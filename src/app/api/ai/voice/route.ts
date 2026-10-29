import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateSpeech } from '@/lib/ai-extensions';
import { generateLocalSpeech } from '@/lib/local-tts';

function isSafeAudioUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.local') && !host.startsWith('[');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    const voice = typeof input.voice === 'string' && input.voice.trim() ? input.voice.trim() : 'default';
    if (!text || text.length > 5_000) return NextResponse.json({ error: 'Voiceover script is required and must be at most 5,000 characters' }, { status: 400 });
    if (voice.length > 80 || !/^[A-Za-z0-9_-]+$/.test(voice)) return NextResponse.json({ error: 'Voice ID is invalid' }, { status: 400 });
    const localTtsConfigured = Boolean(process.env.LOCAL_TTS_BASE_URL?.trim());
    const hostedTtsEnabled = process.env.ZAI_MEDIA_ENABLED === 'true';
    if (!localTtsConfigured && !hostedTtsEnabled) {
      return NextResponse.json({ error: 'Speech generation is unavailable. Configure a self-hosted OpenAI-compatible TTS service or explicitly enable the hosted Z.AI adapter.' }, { status: 503 });
    }

    if (!localTtsConfigured && hostedTtsEnabled && (input.provider !== 'zai' || input.approveCharges !== true || actor.apiKeyId || !hasPermission(actor.role, 'manager'))) {
      return NextResponse.json({ error: 'Hosted speech generation requires explicit provider selection and a manager’s charge approval.' }, { status: 403 });
    }
    const draft = await db.content.create({
      data: {
        title: `AI voiceover: ${text.slice(0, 72)}`,
        type: 'audio',
        status: 'draft',
        body: `Voiceover script:\n${text}\n\nVoice: ${voice}\nGeneration status: processing`,
        mediaType: 'audio',
        aiGenerated: true,
        creatorId: actor.userId,
        companyId: actor.companyId,
      },
      select: { id: true },
    });

    if (localTtsConfigured) {
      try {
        const result = await generateLocalSpeech(text, voice);
        if (!result) throw new Error('Local TTS is not configured');
        await db.content.update({
          where: { id: draft.id },
          data: { body: `Voiceover script:\n${text}\n\nVoice: ${voice}\nProvider: self-hosted OpenAI-compatible TTS\nGeneration status: completed; audio is returned to this session and is not persisted in the database.` },
        });
        return NextResponse.json({
          data: { contentId: draft.id, audioUrl: result.audioDataUrl, contentType: result.contentType, text, voice, provider: 'self-hosted', audioStored: false },
        }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        console.error('[POST /api/ai/voice] self-hosted TTS failed; hosted fallback is intentionally disabled', error);
        await db.content.update({
          where: { id: draft.id },
          data: { body: `Voiceover script:\n${text}\n\nVoice: ${voice}\nProvider: self-hosted OpenAI-compatible TTS\nGeneration status: failed. No hosted fallback was attempted.` },
        });
        return NextResponse.json({ error: 'Self-hosted speech generation failed. No hosted fallback was attempted; the script draft was saved.' }, { status: 502 });
      }
    }

    const result = await generateSpeech(text, voice);
    if (!result || !isSafeAudioUrl(result.audioUrl)) {
      await db.content.update({
        where: { id: draft.id },
        data: { body: `Voiceover script:\n${text}\n\nVoice: ${voice}\nProvider: hosted Z.AI\nGeneration status: unavailable` },
      });
      return NextResponse.json({ error: 'Voiceover generation is unavailable or returned an unsafe audio URL. The draft was saved.' }, { status: 503 });
    }

    await db.content.update({
      where: { id: draft.id },
      data: {
        mediaUrl: result.audioUrl,
        body: `Voiceover script:\n${text}\n\nVoice: ${voice}\nProvider: hosted Z.AI\nGeneration status: completed`,
      },
    });
    return NextResponse.json({ data: { contentId: draft.id, audioUrl: result.audioUrl, contentType: null, text, voice, provider: 'hosted-zai', audioStored: true } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[POST /api/ai/voice]', error);
    return NextResponse.json({ error: 'Could not generate voiceover' }, { status: 500 });
  }
}
