import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAiProviderConfig } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';

async function probe(url: string, headers: Record<string, string> = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    return { reachable: response.ok, httpStatus: response.status };
  } catch {
    return { reachable: false, httpStatus: null };
  }
}

/**
 * Authenticated diagnostic for the self-hosted inference and media services.
 * Never returns credentials and never invokes a generation request.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = getAiProviderConfig();
    const endpoint = config.provider === 'ollama'
      ? `${config.baseUrl.replace(/\/+$/, '')}/api/tags`
      : `${config.baseUrl.replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {};
    if (config.provider === 'openai-compatible' && process.env.AI_COMPATIBLE_API_KEY) {
      headers.Authorization = `Bearer ${process.env.AI_COMPATIBLE_API_KEY}`;
    }
    const [textModel, image] = await Promise.all([
      probe(endpoint, headers),
      probe(`${(process.env.IMAGE_GENERATION_URL || 'http://127.0.0.1:7860').replace(/\/+$/, '')}/sdapi/v1/options`),
    ]);

    return NextResponse.json({
      data: {
        text: {
          provider: config.provider,
          model: config.model,
          automaticPaidFallback: false,
          ...textModel,
        },
        image: {
          provider: 'self-hosted-stable-diffusion',
          configured: Boolean(process.env.IMAGE_GENERATION_URL),
          ...image,
        },
        video: {
          provider: 'self-hosted-adapter',
          configured: Boolean(process.env.VIDEO_GENERATION_URL),
          connectivityChecked: false,
        },
        speech: {
          provider: 'self-hosted-adapter',
          configured: Boolean(process.env.TTS_SERVICE_URL),
          connectivityChecked: false,
        },
      },
    }, { status: textModel.reachable ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[GET /api/ai/provider-status]', error);
    return NextResponse.json({ error: 'Unable to inspect AI provider configuration' }, { status: 500 });
  }
}
