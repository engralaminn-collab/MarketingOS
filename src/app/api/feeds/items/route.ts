import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/feeds/items — list feed items (newest first)
// Optional: ?sourceId=...&isRead=false&isStarred=true&limit=50
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sourceId = searchParams.get('sourceId');
    const isRead = searchParams.get('isRead');
    const isStarred = searchParams.get('isStarred');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const where: any = { companyId: payload.companyId };
    if (sourceId) where.sourceId = sourceId;
    if (isRead === 'true') where.isRead = true;
    if (isRead === 'false') where.isRead = false;
    if (isStarred === 'true') where.isStarred = true;

    const items = await db.feedItem.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        source: { select: { id: true, name: true, category: true } },
      },
    });

    const unreadCount = await db.feedItem.count({
      where: { companyId: payload.companyId, isRead: false },
    });

    return NextResponse.json({
      data: items.map((i) => ({
        id: i.id,
        title: i.title,
        link: i.link,
        description: i.description,
        author: i.author,
        publishedAt: i.publishedAt.toISOString(),
        isRead: i.isRead,
        isStarred: i.isStarred,
        source: i.source,
      })),
      unreadCount,
    });
  } catch (err) {
    console.error('[GET /api/feeds/items]', err);
    return NextResponse.json({ error: 'Failed to fetch feed items' }, { status: 500 });
  }
}
