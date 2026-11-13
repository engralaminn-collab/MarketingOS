const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const SYNTHESIS_TIMEOUT_MS = 120_000;
const ACCEPTED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/webm',
]);

async function readBoundedAudio(response: Response): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_AUDIO_BYTES) throw new Error('Local TTS returned oversized audio');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_BYTES) {
        await reader.cancel();
        throw new Error('Local TTS returned oversized audio');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function getLocalTtsConfig(): { endpoint: URL; model: string; apiKey: string | null; defaultVoice: string } | null {
  const configured = process.env.LOCAL_TTS_BASE_URL?.trim();
  if (!configured) return null;

  let baseUrl: URL;
  try {
    baseUrl = new URL(configured);
  } catch {
    throw new Error('LOCAL_TTS_BASE_URL must be a valid absolute URL');
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('LOCAL_TTS_BASE_URL must use HTTP(S) and must not contain credentials, a query, or a fragment');
  }

  return {
    endpoint: new URL('/v1/audio/speech', baseUrl),
    model: process.env.LOCAL_TTS_MODEL?.trim() || 'tts-1',
    apiKey: process.env.LOCAL_TTS_API_KEY?.trim() || null,
    defaultVoice: process.env.LOCAL_TTS_VOICE?.trim() || 'default',
  };
}

/** Calls an operator-hosted OpenAI-compatible TTS service and returns a short-lived data URI. */
export async function generateLocalSpeech(text: string, voice: string): Promise<{ audioDataUrl: string; contentType: string } | null> {
  const config = getLocalTtsConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNTHESIS_TIMEOUT_MS);
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        input: text,
        voice: voice === 'default' ? config.defaultVoice : voice,
        response_format: 'mp3',
      }),
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Local TTS returned HTTP ${response.status}`);

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || 'audio/mpeg';
    if (!ACCEPTED_AUDIO_TYPES.has(contentType)) throw new Error('Local TTS returned an unsupported audio type');
    const bytes = await readBoundedAudio(response);
    if (!bytes.length) throw new Error('Local TTS returned empty audio');
    return { audioDataUrl: `data:${contentType};base64,${bytes.toString('base64')}`, contentType };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Local TTS request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
