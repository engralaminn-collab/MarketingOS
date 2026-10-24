import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getVideoStatus, isZaiMediaEnabled } from '@/lib/ai-extensions';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const taskId = new URL(req.url).searchParams.get('taskId')?.trim();
    if (!taskId || taskId.length > 256) {
      return NextResponse.json({ error: 'A valid taskId is required' }, { status: 400 });
    }

    const ownedTask = await db.content.findFirst({
      where: { companyId: actor.companyId, type: 'video', body: { contains: taskId } },
      select: { id: true },
    });
    if (!ownedTask) return NextResponse.json({ error: 'Video task not found' }, { status: 404 });

    if (!isZaiMediaEnabled()) {
      return NextResponse.json(
        { error: 'Hosted model-generated video polling is disabled. Use Media Studio WebM Scene Composer or self-hosted ComfyUI.' },
        { status: 503 },
      );
    }

    const result = await getVideoStatus(taskId);
    const status = result.status.toLowerCase();
    const isReady = ['success', 'completed', 'complete', 'done'].includes(status) && !!result.videoUrl;
    const isFailed = ['fail', 'failed', 'error', 'disabled'].includes(status);

    return NextResponse.json(
      {
        data: {
          taskId,
          status: result.status,
          videoUrl: result.videoUrl || null,
          isReady,
          isProcessing: !isReady && !isFailed,
          isFailed,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[GET /api/ai/video-status]', error);
    return NextResponse.json({ error: 'Failed to retrieve video status' }, { status: 500 });
  }
}
