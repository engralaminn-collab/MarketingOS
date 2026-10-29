import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { hasPermission } from '@/lib/auth';
import { generateLocalSpeech } from '@/lib/local-tts';

/**
 * POST /api/media/talking-head/audio
 *
 * Generates the voice for a talking clip using the operator's local TTS service
 * and returns it as a data URL so the browser can drive the mouth animation from
 * the real waveform and record it.
 *
 * Deliberately no hosted fallback: if local TTS is not configured the route says
 * so and the client uses the browser-voice (silent-recording) tier instead.
 */
export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Only LOCAL_TTS_BASE_URL feeds this path: generateLocalSpeech reads nothing
  // else, so reporting "configured" for any other variable would promise audio
  // the route cannot produce.
  const configured = Boolean(process.env.LOCAL_TTS_BASE_URL?.trim());
  if (!configured) {
    return NextResponse.json(
      {
        error: 'No local speech service is configured.',
        hint: 'Set LOCAL_TTS_BASE_URL to an OpenAI-compatible /audio/speech endpoint (e.g. a local Kokoro or Piper server), then retry.',
        fallback: 'browser-voice',
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const voice = typeof body?.voice === 'string' && body.voice.trim() ? body.voice.trim() : 'default';
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: 'Script must be at most 4,000 characters' }, { status: 400 });
  if (voice.length > 80 || !/^[A-Za-z0-9_.-]+$/.test(voice)) return NextResponse.json({ error: 'Invalid voice id' }, { status: 400 });

  try {
    const result = await generateLocalSpeech(text, voice);
    if (!result?.audioDataUrl) {
      return NextResponse.json({ error: 'The local speech service returned no audio.', fallback: 'browser-voice' }, { status: 502 });
    }
    return NextResponse.json(
      {
        data: {
          audioUrl: result.audioDataUrl,
          contentType: result.contentType,
          characters: text.length,
          provider: 'self-hosted',
          stored: false,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      {
        error: 'Local speech generation failed. No hosted fallback was attempted.',
        fallback: 'browser-voice',
      },
      { status: 502 }
    );
  }
}
