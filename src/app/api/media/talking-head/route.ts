import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';

/**
 * GET /api/media/talking-head
 *
 * Capability report for the talking-video pipeline. The UI asks this before
 * showing buttons so the operator sees exactly what will happen — no silent
 * fallback, no pretend render.
 *
 * Three tiers, in order of preference:
 *  1. lipsync-adapter  — photoreal neural lip-sync on the operator's own GPU
 *  2. local-tts        — real recorded audio + animated talking head, fully local
 *  3. browser-voice    — live talking preview with the OS voice, in-page only
 */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Matches generateLocalSpeech (src/lib/local-tts.ts): only this variable is read.
  const localTts = Boolean(process.env.LOCAL_TTS_BASE_URL?.trim());
  const videoAdapter = Boolean(process.env.VIDEO_GENERATION_URL?.trim());
  const hostedMedia = process.env.ZAI_MEDIA_ENABLED === 'true';

  return NextResponse.json({
    data: {
      tiers: [
        {
          id: 'lipsync-adapter',
          label: 'Photoreal lip-sync (local GPU)',
          available: false,
          detail: 'Unavailable until consented asset binding and a durable worker are implemented.',
          env: 'LIPSYNC_ADAPTER_URL',
        },
        {
          id: 'local-tts',
          label: 'Recorded voice + animated head (local)',
          available: localTts,
          detail: localTts
            ? 'A local TTS service is configured: the voice is generated locally, the mouth is driven by the real audio envelope, and the clip records with sound.'
            : 'No local TTS configured. Set LOCAL_TTS_BASE_URL (OpenAI-compatible /audio/speech) to record clips with a real voice.',
          env: 'LOCAL_TTS_BASE_URL',
        },
        {
          id: 'browser-voice',
          label: 'Live preview (browser voice)',
          available: true,
          detail:
            'Always available: the browser speaks the script and the avatar animates in real time. Browsers do not expose their speech output as a stream, so this mode records a silent clip unless local TTS is configured.',
          env: null,
        },
      ],
      configured: {
        lipsyncAdapter: false,
        localTts,
        videoAdapter,
        hostedMedia,
      },
      limits: {
        retainedLocallyOnly: false,
        storagePolicy: 'not verified',
        hostedFallback: false,
        maxScriptChars: 4000,
        maxPhotoBytes: 6 * 1024 * 1024,
        recommendedFps: 30,
      },
    },
  });
}
