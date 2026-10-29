import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hasPermission } from '@/lib/auth';
import { generateFreeCloudImage, generateImage, isZaiMediaEnabled } from '@/lib/ai-extensions';
import { generateLocalImage } from '@/lib/ai-provider';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';
import { generateWithComfyUI } from '@/lib/comfyui';

export const runtime = 'nodejs';
export const maxDuration = 120;

const VALID_SIZES: Record<string, { width: number; height: number }> = {
  '1024x1024': { width: 1024, height: 1024 },
  '768x1344': { width: 768, height: 1344 },
  '864x1152': { width: 864, height: 1152 },
  '1344x768': { width: 1344, height: 768 },
  '1152x864': { width: 1152, height: 864 },
  '1440x720': { width: 1440, height: 720 },
  '720x1440': { width: 720, height: 1440 },
};

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    const size = typeof input.size === 'string' ? input.size : '1024x1024';
    const requestedProvider = typeof input.provider === 'string' ? input.provider.trim().toLowerCase() : 'auto';
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    }
    if (prompt.length > 4_000) {
      return NextResponse.json({ error: 'Prompt must be 4,000 characters or fewer' }, { status: 400 });
    }
    if (!Object.prototype.hasOwnProperty.call(VALID_SIZES, size)) {
      return NextResponse.json({ error: `Invalid size. Use: ${Object.keys(VALID_SIZES).join(', ')}` }, { status: 400 });
    }
    if (input.saveToContent !== undefined && typeof input.saveToContent !== 'boolean') {
      return NextResponse.json({ error: 'saveToContent must be a boolean' }, { status: 400 });
    }

    const dimensions = VALID_SIZES[size];
    const shouldSave = input.saveToContent !== false;
    const steps = Math.min(40, Math.max(1, Number(input.steps) || 25));

    // 1. Self-hosted ComfyUI (when COMFYUI_BASE_URL + COMFYUI_IMAGE_CHECKPOINT are configured)
    const comfyConfigured = Boolean(process.env.COMFYUI_BASE_URL?.trim() && process.env.COMFYUI_IMAGE_CHECKPOINT?.trim());
    if (comfyConfigured && (requestedProvider === 'auto' || requestedProvider === 'comfyui')) {
      try {
        const localImage = await generateWithComfyUI(prompt, dimensions.width, dimensions.height);
        if (localImage) {
          const content = shouldSave
            ? await db.content.create({
                data: {
                  title: `AI Image: ${prompt.slice(0, 80)}`,
                  type: 'graphic',
                  status: 'draft',
                  body: `Prompt: ${prompt}\nSize: ${size}\nProvider: self-hosted ComfyUI`,
                  mediaType: 'image',
                  aiGenerated: true,
                  creatorId: actor.userId,
                  companyId: actor.companyId,
                },
                select: { id: true },
              })
            : null;
          await emitEvent({
            companyId: actor.companyId,
            userId: actor.userId,
            type: 'ai.image_generated',
            title: 'Self-hosted AI image generated',
            description: prompt.slice(0, 80),
            resourceType: 'content',
            resourceId: content?.id,
            link: '/content',
            metadata: { size, provider: 'self-hosted-comfyui' },
          });
          return NextResponse.json(
            {
              data: {
                success: true,
                image: localImage,
                imageUrl: localImage,
                prompt,
                size,
                contentId: content?.id || null,
                persisted: false,
                provider: 'self-hosted-comfyui',
              },
            },
            { status: 201, headers: { 'Cache-Control': 'no-store' } },
          );
        }
      } catch (error) {
        console.error('[POST /api/ai/generate-image] self-hosted ComfyUI failed', error);
        if (requestedProvider === 'comfyui') {
          return NextResponse.json({ error: 'Self-hosted ComfyUI image generation failed.' }, { status: 502 });
        }
      }
    }

    // 2. Self-hosted Stable Diffusion WebUI (when IMAGE_GENERATION_URL is explicitly configured or requested)
    const sdWebUiConfigured = Boolean(process.env.IMAGE_GENERATION_URL?.trim());
    if ((sdWebUiConfigured && requestedProvider === 'auto') || requestedProvider === 'sd-webui') {
      try {
        const sdResult = await generateLocalImage(prompt, size, steps);
        const content = shouldSave
          ? await db.content.create({
              data: {
                title: `AI Image: ${prompt.slice(0, 80)}`,
                type: 'graphic',
                status: 'draft',
                body: `Prompt: ${prompt}\nSize: ${size}\nProvider: self-hosted-stable-diffusion`,
                mediaType: 'image',
                aiGenerated: true,
                creatorId: actor.userId,
                companyId: actor.companyId,
              },
              select: { id: true },
            })
          : null;
        return NextResponse.json(
          {
            data: {
              success: true,
              image: sdResult.dataUrl,
              imageUrl: sdResult.dataUrl,
              prompt,
              size,
              contentId: content?.id || null,
              persisted: false,
              provider: 'self-hosted-stable-diffusion',
            },
          },
          { status: 201, headers: { 'Cache-Control': 'no-store' } },
        );
      } catch (error) {
        console.error('[POST /api/ai/generate-image] self-hosted SD WebUI failed', error);
        if (requestedProvider === 'sd-webui' || (!isZaiMediaEnabled() && requestedProvider === 'auto')) {
          return NextResponse.json(
            {
              error: 'Local image generation is unavailable. Start a Stable Diffusion WebUI or ComfyUI service, or explicitly enable an opt-in provider.',
              provider: 'self-hosted-stable-diffusion',
            },
            { status: 503 },
          );
        }
      }
    }

    // 3. Explicit Opt-In Free Cloud Image Provider (only when user explicitly selects provider !== 'auto')
    if (requestedProvider === 'pollinations' || requestedProvider === 'huggingface' || requestedProvider === 'cloudflare') {
      if (input.approveCharges !== true || actor.apiKeyId || !hasPermission(actor.role, 'manager')) return NextResponse.json({ error: 'A manager must explicitly approve potential hosted-provider charges for this request.' }, { status: 403 });
      const freeImg = await generateFreeCloudImage(prompt, dimensions.width, dimensions.height, requestedProvider);
      if (freeImg) {
        const content = shouldSave
          ? await db.content.create({
              data: {
                title: `Free AI Image: ${prompt.slice(0, 80)}`,
                type: 'graphic',
                status: 'draft',
                body: `Prompt: ${prompt}\nSize: ${size}\nProvider: ${freeImg.provider}`,
                mediaType: 'image',
                aiGenerated: true,
                creatorId: actor.userId,
                companyId: actor.companyId,
              },
              select: { id: true },
            })
          : null;
        return NextResponse.json(
          {
            data: {
              success: true,
              image: freeImg.dataUrl,
              imageUrl: freeImg.dataUrl,
              prompt,
              size,
              contentId: content?.id || null,
              persisted: false,
              provider: freeImg.provider,
            },
          },
          { status: 201, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      return NextResponse.json(
        { error: `Opt-in image provider "${requestedProvider}" is currently unavailable.` },
        { status: 503 },
      );
    }

    // 4. Optional hosted Z.AI adapter (strictly gated by ZAI_MEDIA_ENABLED=true)
    if (!isZaiMediaEnabled()) {
      return NextResponse.json(
        {
          error:
            'No model-based image provider is enabled. Configure COMFYUI_BASE_URL and COMFYUI_IMAGE_CHECKPOINT (or IMAGE_GENERATION_URL) for self-hosted generation, or explicitly enable ZAI_MEDIA_ENABLED.',
        },
        { status: 503 },
      );
    }

    if (requestedProvider !== 'zai' || input.approveCharges !== true || actor.apiKeyId || !hasPermission(actor.role, 'manager')) {
      return NextResponse.json({ error: 'Hosted image generation requires explicit provider selection and a manager’s charge approval. No hosted fallback was attempted.' }, { status: 403 });
    }
    const result = await generateImage(prompt, size);
    if (!result?.base64) {
      return NextResponse.json({ error: 'Image generation is unavailable from the configured provider' }, { status: 503 });
    }
    const dataUrl = `data:image/png;base64,${result.base64}`;
    const content = shouldSave
      ? await db.content.create({
          data: {
            title: `AI Image: ${prompt}\n`.slice(0, 80).trim(),
            type: 'graphic',
            status: 'draft',
            body: `Prompt: ${prompt}\nSize: ${size}\nProvider: hosted-zai`,
            mediaType: 'image',
            aiGenerated: true,
            creatorId: actor.userId,
            companyId: actor.companyId,
          },
          select: { id: true },
        })
      : null;

    return NextResponse.json(
      {
        data: {
          success: true,
          image: dataUrl,
          imageUrl: dataUrl,
          prompt,
          size,
          contentId: content?.id || null,
          persisted: false,
          provider: 'hosted-zai',
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[POST /api/ai/generate-image]', error);
    return NextResponse.json({ error: 'Image generation request failed' }, { status: 500 });
  }
}
