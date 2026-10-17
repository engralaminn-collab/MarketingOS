import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getLocalVideoStatus } from '@/lib/ai-provider';

// GET /api/ai/video-status?taskId=xxx — check video generation status
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

    try {
      const result = await getLocalVideoStatus(taskId);
      const status = result.status.toLowerCase();
      const isReady = ['success', 'completed', 'complete', 'done'].includes(status) && !!result.videoUrl;
      const isFailed = ['fail', 'failed', 'error'].includes(status);
      return NextResponse.json({
        data: {
          taskId,
          status: result.status,
          videoUrl: result.videoUrl || null,
          isReady,
          isProcessing: !isReady && !isFailed,
          isFailed,
        },
      });
    } catch (err) {
      return NextResponse.json({
        data: {
          taskId,
          status: 'UNKNOWN',
          videoUrl: null,
          isReady: false,
          error: err instanceof Error ? err.message : 'Query failed',
        },
      });
    }
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
