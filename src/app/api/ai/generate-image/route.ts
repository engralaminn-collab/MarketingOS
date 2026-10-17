import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import { generateWithComfyUI } from '@/lib/comfyui';
import ZAI from 'z-ai-web-dev-sdk';

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
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const actor = await verifyToken(token);
  if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt || prompt.length > 2_000) {
    return NextResponse.json({ error: 'Prompt is required and must be at most 2,000 characters' }, { status: 400 });
  }
  const size = typeof input.size === 'string' ? input.size : '1024x1024';
  if (!VALID_SIZES.has(size)) return NextResponse.json({ error: 'Unsupported image dimensions' }, { status: 400 });

  const [width, height] = size.split('x').map(Number);
  const localImageModelConfigured = Boolean(process.env.COMFYUI_BASE_URL?.trim());

  if (localImageModelConfigured) {
    try {
      const image = await generateWithComfyUI(prompt, width, height);
      if (!image) return NextResponse.json({ error: 'Local ComfyUI is not configured' }, { status: 503 });
      return NextResponse.json({ success: true, image, size, provider: 'ComfyUI (self-hosted)' }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.error('[POST /api/ai/generate-image] self-hosted ComfyUI failure', error);
      const message = error instanceof Error ? error.message : 'Local image generation failed';
      return NextResponse.json({ error: `Self-hosted ComfyUI failed: ${message}. No hosted fallback was used.` }, { status: 503 });
    }
  }

  if (process.env.ZAI_MEDIA_ENABLED !== 'true') {
    return NextResponse.json({
      error: 'No model-based image provider is enabled. Configure COMFYUI_BASE_URL and COMFYUI_IMAGE_CHECKPOINT for self-hosted generation, or explicitly enable ZAI_MEDIA_ENABLED for the optional hosted provider.',
    }, { status: 503 });
  }

  try {
    const zai = await ZAI.create();
    const response = await zai.images.generations.create({ prompt, size: size as never });
    const imageBase64 = response.data?.[0]?.base64;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ error: 'Image provider returned no image data' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${imageBase64}`,
      size,
      provider: 'Z.AI (hosted)',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[POST /api/ai/generate-image] provider failure', error);
    return NextResponse.json({ error: 'Image generation is temporarily unavailable. Please retry later.' }, { status: 503 });
  }
}
