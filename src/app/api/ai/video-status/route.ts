import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// GET /api/ai/video-status?taskId=xxx — poll only a render task saved by this company.
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const taskId = new URL(req.url).searchParams.get('taskId')?.trim();
    if (!taskId || taskId.length > 256) return NextResponse.json({ error: 'A valid taskId is required' }, { status: 400 });

    const ownedTask = await db.content.findFirst({
      where: { companyId: actor.companyId, type: 'video', body: { contains: taskId } },
      select: { id: true },
    });
    if (!ownedTask) return NextResponse.json({ error: 'Video task not found' }, { status: 404 });
    if (process.env.ZAI_MEDIA_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Hosted model-generated video is disabled. A browser-based WebM template maker is separate from this provider task route; no local AI video-model adapter is configured.' }, { status: 503 });
    }

    try {
      const zai = await ZAI.create();
      const result = await zai.async.result.query(taskId);
      const videoUrl = result.video_result?.[0]?.url || result.video_url || result.url || result.video || null;
      const status = String(result.task_status || 'UNKNOWN');
      const isReady = status === 'SUCCESS' && typeof videoUrl === 'string' && videoUrl.length > 0;

      return NextResponse.json({
        data: {
          taskId,
          status,
          videoUrl: isReady ? videoUrl : null,
          isReady,
          isProcessing: status === 'PROCESSING' || status === 'PENDING',
          isFailed: status === 'FAIL',
        },
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.warn('[GET /api/ai/video-status] provider lookup failed', error);
      return NextResponse.json({
        data: {
          taskId,
          status: 'UNKNOWN',
          videoUrl: null,
          isReady: false,
          isProcessing: false,
          isFailed: false,
          error: 'Provider status lookup failed. Please retry later.',
        },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
  } catch (error) {
    console.error('[GET /api/ai/video-status]', error);
    return NextResponse.json({ error: 'Failed to retrieve video status' }, { status: 500 });
  }
}
