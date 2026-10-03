import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// POST /api/notifications/read-all — mark all as read for current user
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const result = await db.notification.updateMany({
      where: { userId: payload.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ data: { updated: result.count } });
  } catch (err) {
    console.error('[POST /api/notifications/read-all]', err);
    return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
  }
}
