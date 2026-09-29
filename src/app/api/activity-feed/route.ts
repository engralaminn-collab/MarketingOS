import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/activity-feed — company-wide activity stream
// Supports ?limit=50 and ?resourceType=lead for filtering
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const resourceType = searchParams.get('resourceType');

    const where: any = { companyId: payload.companyId };
    if (resourceType) where.resourceType = resourceType;

    const activities = await db.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    // Group counts by type (for stats)
    const typeStats = await db.activity.groupBy({
      by: ['type'],
      where: { companyId: payload.companyId },
      _count: true,
      orderBy: { _count: { type: 'desc' } },
      take: 20,
    });

    return NextResponse.json({
      data: activities.map((a) => ({
        id: a.id,
        type: a.type,
        description: a.description,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        metadata: (() => { try { return JSON.parse(a.metadata || '{}'); } catch { return {}; } })(),
        createdAt: a.createdAt.toISOString(),
        user: a.user,
      })),
      stats: typeStats.map((s) => ({ type: s.type, count: s._count })),
    });
  } catch (err) {
    console.error('[GET /api/activity-feed]', err);
    return NextResponse.json({ error: 'Failed to fetch activity feed' }, { status: 500 });
  }
}
