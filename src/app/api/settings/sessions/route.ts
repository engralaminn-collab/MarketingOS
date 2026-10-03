import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/settings/sessions — list user's sessions
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const sessions = await db.userSession.findMany({
      where: { userId: payload.userId },
      orderBy: { lastActiveAt: 'desc' },
      take: 20,
    });

    // Mark the most-recent session as "current" (best-effort heuristic)
    return NextResponse.json({
      sessions: sessions.map((s, idx) => ({
        id: s.id,
        device: s.deviceInfo,
        ip: s.ipAddress || '—',
        location: s.location || 'Unknown',
        lastActive: timeAgo(s.lastActiveAt),
        current: idx === 0,
      })),
    });
  } catch (err) {
    console.error('[GET /api/settings/sessions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function timeAgo(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'Now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
