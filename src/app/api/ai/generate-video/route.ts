import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hasPermission } from '@/lib/auth';
import { generateVideo } from '@/lib/ai-extensions';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';
import { generateWithComfyUIVideo } from '@/lib/comfyui';

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
    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    if (!prompt || prompt.length > 2_000) return NextResponse.json({ error: 'Prompt is required and must be at most 2,000 characters' }, { status: 400 });
    const durationValue = input.duration === undefined ? 5 : Number(input.duration);
    if (!Number.isInteger(durationValue) || durationValue < 3 || durationValue > 10) {
      return NextResponse.json({ error: 'Duration must be a whole number from 3 to 10 seconds' }, { status: 400 });
    }
    if (input.saveToContent !== undefined && typeof input.saveToContent !== 'boolean') {
      return NextResponse.json({ error: 'saveToContent must be a boolean' }, { status: 400 });
    }
    const localVideoConfigured = Boolean(process.env.COMFYUI_VIDEO_WORKFLOW_FILE?.trim());
    const hostedVideoEnabled = process.env.ZAI_MEDIA_ENABLED === 'true';
    if (!localVideoConfigured && !hostedVideoEnabled) {
      return NextResponse.json({ error: 'AI video rendering is unavailable. Configure a self-hosted ComfyUI API workflow, or explicitly enable the hosted Z.AI adapter and accept any applicable charges.' }, { status: 503 });
    }

    if (!localVideoConfigured && hostedVideoEnabled && (input.provider !== 'zai' || input.approveCharges !== true || actor.apiKeyId || !hasPermission(actor.role, 'manager'))) {
      return NextResponse.json({ error: 'Hosted video generation requires explicit provider selection and a manager’s charge approval.' }, { status: 403 });
    }
    const shouldSave = input.saveToContent !== false;
    const draft = shouldSave ? await db.content.create({
      data: {
        title: `AI Video: ${prompt.slice(0, 80)}`,
        type: 'video',
        status: 'draft',
        body: `Prompt: ${prompt}\nProvider: ${localVideoConfigured ? 'self-hosted ComfyUI workflow' : 'optional Z.AI media adapter'}\nRender status: starting`,
        mediaType: 'video',
        aiGenerated: true,
        creatorId: actor.userId,
        companyId: actor.companyId,
      },
      select: { id: true },
    }) : null;

    if (localVideoConfigured) {
      try {
        const videoUrl = await generateWithComfyUIVideo(prompt, durationValue);
        if (!videoUrl) throw new Error('Local video workflow is not configured');
        if (draft) {
          await db.content.update({
            where: { id: draft.id },
            data: { body: `Prompt: ${prompt}\nDuration: ${durationValue} seconds\nProvider: self-hosted ComfyUI workflow\nRender status: completed; download the response to keep the video. The generated file is not persisted in the database.` },
          });
        }
        await emitEvent({
          companyId: actor.companyId,
          userId: actor.userId,
          type: 'ai.video_generated',
          title: 'Self-hosted AI video generated',
          description: prompt.slice(0, 80),
          resourceType: 'content',
          resourceId: draft?.id,
          link: '/content',
          metadata: { provider: 'self-hosted-comfyui', duration: durationValue, prompt },
        });
        return NextResponse.json({
          data: { contentId: draft?.id || null, taskId: null, videoUrl, status: 'completed', prompt, duration: durationValue, provider: 'self-hosted-comfyui', persisted: false },
        }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        console.error('[POST /api/ai/generate-video] self-hosted ComfyUI failed; hosted fallback is intentionally disabled', error);
        if (draft) {
          await db.content.update({
            where: { id: draft.id },
            data: { body: `Prompt: ${prompt}\nDuration: ${durationValue} seconds\nProvider: self-hosted ComfyUI workflow\nRender status: failed. No hosted fallback was attempted.` },
          });
        }
        return NextResponse.json({ error: 'Self-hosted video generation failed. No hosted fallback was attempted; the prompt draft was saved.' }, { status: 502 });
      }
    }

    const result = await generateVideo(`${prompt}\nTarget duration: approximately ${durationValue} seconds.`);
    if (!result) {
      if (draft) await db.content.update({ where: { id: draft.id }, data: { body: `Prompt: ${prompt}\nRender status: unavailable` } });
      return NextResponse.json({ error: 'Video generation was not accepted by the configured provider' }, { status: 503 });
    }

    if (draft) {
      await db.content.update({
        where: { id: draft.id },
        data: {
          body: `Prompt: ${prompt}\nDuration target: approximately ${durationValue} seconds\nProvider: hosted Z.AI\nProvider task: ${result.taskId}\nRender status: ${result.status}`,
          mediaUrl: result.videoUrl || null,
        },
      });
    }
    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'ai.video_generated',
      title: 'AI video task started',
      description: prompt.slice(0, 80),
      resourceType: 'content',
      resourceId: draft?.id,
      link: '/content',
      metadata: { prompt, taskId: result.taskId, status: result.status },
    });
    return NextResponse.json({ data: { contentId: draft?.id || null, taskId: result.taskId, videoUrl: result.videoUrl || null, status: result.status, prompt, duration: durationValue, provider: 'hosted-zai' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[POST /api/ai/generate-video]', error);
    return NextResponse.json({ error: 'Could not start video generation' }, { status: 500 });
  }
}
