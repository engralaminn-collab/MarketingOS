import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

const VALID_SIZES: Record<string, { width: number; height: number }> = {
  '1024x1024': { width: 1024, height: 1024 },
  '768x1344': { width: 768, height: 1344 },
  '1344x768': { width: 1344, height: 768 },
  '1440x720': { width: 1440, height: 720 },
  '720x1440': { width: 720, height: 1440 },
  '864x1152': { width: 864, height: 1152 },
  '1152x864': { width: 1152, height: 864 },
};

const VALID_SIZES = new Set([
  '1024x1024',
  '768x1344',
  '1344x768',
  '1440x720',
  '720x1440',
  '864x1152',
  '1152x864',
]);

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const size = typeof body.size === 'string' ? body.size : '1024x1024';
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    if (prompt.length > 4000) return NextResponse.json({ error: 'Prompt must be 4,000 characters or fewer' }, { status: 400 });
    const dimensions = VALID_SIZES[size];
    if (!dimensions) return NextResponse.json({ error: `Invalid size. Use: ${Object.keys(VALID_SIZES).join(', ')}` }, { status: 400 });

    // Local Stable Diffusion WebUI API. No cloud image API or paid fallback.
    const baseUrl = (process.env.IMAGE_GENERATION_URL || 'http://127.0.0.1:7860').replace(/\/+$/, '');
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          width: dimensions.width,
          height: dimensions.height,
          steps: Math.min(40, Math.max(1, Number(body.steps) || 25)),
          batch_size: 1,
          n_iter: 1,
        }),
        signal: AbortSignal.timeout(Number(process.env.IMAGE_GENERATION_TIMEOUT_MS) || 120_000),
        cache: 'no-store',
      });
    } catch {
      return NextResponse.json({
        error: 'Local image generation is unavailable. Start a Stable Diffusion WebUI service and configure IMAGE_GENERATION_URL. No third-party provider was called.',
        provider: 'self-hosted-stable-diffusion',
      }, { status: 503 });
    }
  }

  if (process.env.ZAI_MEDIA_ENABLED !== 'true') {
    return NextResponse.json({
      error: 'No model-based image provider is enabled. Configure COMFYUI_BASE_URL and COMFYUI_IMAGE_CHECKPOINT for self-hosted generation, or explicitly enable ZAI_MEDIA_ENABLED for the optional hosted provider.',
    }, { status: 503 });
  }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      return NextResponse.json({
        error: `Local image service returned HTTP ${response.status}`,
        ...(detail ? { detail } : {}),
      }, { status: 502 });
    }

    const result = await response.json() as { images?: string[] };
    const image = result.images?.[0];
    if (!image) return NextResponse.json({ error: 'Local image service returned no image' }, { status: 502 });
    return NextResponse.json({
      success: true,
      image: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
      size,
      provider: 'self-hosted-stable-diffusion',
    });
  } catch (error) {
    console.error('[POST /api/ai/generate-image]', error);
    return NextResponse.json({ error: 'Image generation request failed' }, { status: 500 });
  }
}
