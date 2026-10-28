import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

/**
 * POST /api/messages/[id]/read — mark one conversation as read.
 *
 * `[id]` is the *other* participant's user id, matching GET /api/messages/[id].
 * Only messages addressed to the caller are ever updated, so a member cannot
 * clear someone else's unread badge. Reading a thread is idempotent.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: otherUserId } = await params;
    if (!otherUserId || otherUserId === payload.userId) {
      return NextResponse.json({ error: 'Invalid thread' }, { status: 400 });
    }

    const member = await db.companyUser.findFirst({
      where: { companyId: payload.companyId, userId: otherUserId, user: { isActive: true } },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const result = await db.message.updateMany({
      where: {
        senderId: otherUserId,
        recipientId: payload.userId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ data: { updated: result.count } });
  } catch (error) {
    console.error('[POST /api/messages/[id]/read]', error);
    return NextResponse.json({ error: 'Failed to mark thread as read' }, { status: 500 });
  }
}
