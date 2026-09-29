import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/notifications — list current user's notifications
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { isRead, limit } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { userId: payload.userId };
    if (isRead === 'true') where.isRead = true;
    if (isRead === 'false') where.isRead = false;

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? Number(limit) : 50,
    });

    const unreadCount = await db.notification.count({
      where: { userId: payload.userId, isRead: false },
    });

    return NextResponse.json({ data: notifications, unreadCount });
  } catch (err) {
    console.error('[GET /api/notifications]', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}
