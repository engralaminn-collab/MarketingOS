import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    await db.userSession.deleteMany({ where: { userId: payload.userId, lastActiveAt: { lt: cutoff } } });
    const sessions = await db.userSession.findMany({
      where: { userId: payload.userId, lastActiveAt: { gte: cutoff } },
      orderBy: { lastActiveAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        device: session.deviceInfo,
        ip: session.ipAddress || '—',
        location: session.location || 'Unknown',
        lastActive: timeAgo(session.lastActiveAt),
        current: session.id === payload.sid,
      })),
    });
  } catch (error) {
    console.error('[GET /api/settings/sessions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
