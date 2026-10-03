import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// POST /api/notifications/[id]/read — mark single notification as read
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    // Verify ownership
    const notif = await db.notification.findFirst({ where: { id, userId: payload.userId } });
    if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[POST /api/notifications/[id]/read]', err);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
