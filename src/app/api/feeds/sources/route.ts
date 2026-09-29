import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { fetchAndParseFeed } from '@/lib/feed-parser';

// GET /api/feeds/sources — list all feed sources
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const sources = await db.feedSource.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });

    return NextResponse.json({
      data: sources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        category: s.category,
        isActive: s.isActive,
        lastFetchedAt: s.lastFetchedAt?.toISOString() || null,
        lastError: s.lastError,
        itemCount: s._count.items,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[GET /api/feeds/sources]', err);
    return NextResponse.json({ error: 'Failed to fetch feed sources' }, { status: 500 });
  }
}

// POST /api/feeds/sources — add a new feed source
// Body: { url: string, name?: string, category?: string }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const url = String(body.url || '').trim();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    // Check if URL already exists for this company
    const existing = await db.feedSource.findFirst({
      where: { url, companyId: payload.companyId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Feed source with this URL already exists', data: existing }, { status: 409 });
    }

    // Try to fetch + parse the feed to verify it's valid + auto-fill the name
    let name = String(body.name || '').trim();
    if (!name) {
      const parsed = await fetchAndParseFeed(url);
      if (parsed) {
        name = parsed.title.slice(0, 100);
      } else {
        name = url;
      }
    }

    const source = await db.feedSource.create({
      data: {
        url,
        name,
        category: String(body.category || 'general'),
        isActive: true,
        companyId: payload.companyId,
      },
    });

    return NextResponse.json({
      data: {
        id: source.id,
        name: source.name,
        url: source.url,
        category: source.category,
        isActive: source.isActive,
        createdAt: source.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/feeds/sources]', err);
    return NextResponse.json({ error: 'Failed to add feed source' }, { status: 500 });
  }
}
