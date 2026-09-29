import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { refreshFeedSource } from '@/lib/feed-parser';
import { emitEvent } from '@/lib/events';

// POST /api/feeds/refresh — refresh one (body { sourceId }) or all feeds
// Returns the number of new items found per source.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sourceId = body.sourceId;

    let sources;
    if (sourceId) {
      const single = await db.feedSource.findFirst({
        where: { id: String(sourceId), companyId: payload.companyId },
      });
      if (!single) return NextResponse.json({ error: 'Feed source not found' }, { status: 404 });
      sources = [single];
    } else {
      sources = await db.feedSource.findMany({
        where: { companyId: payload.companyId, isActive: true },
      });
    }

    const results: { sourceId: string; name: string; newItems: number }[] = [];
    let totalNew = 0;
    for (const source of sources) {
      const newCount = await refreshFeedSource(source.id);
      results.push({ sourceId: source.id, name: source.name, newItems: newCount });
      totalNew += newCount;
    }

    if (totalNew > 0) {
      await emitEvent({
        companyId: payload.companyId,
        userId: payload.userId,
        type: 'feeds.refreshed',
        title: 'Feeds refreshed',
        description: `${totalNew} new feed items found across ${sources.length} sources`,
        resourceType: 'feed',
        link: '/feeds',
        metadata: { totalNew, sources: sources.length },
      });
    }

    return NextResponse.json({ data: { results, totalNew } });
  } catch (err) {
    console.error('[POST /api/feeds/refresh]', err);
    return NextResponse.json({ error: 'Failed to refresh feeds' }, { status: 500 });
  }
}
