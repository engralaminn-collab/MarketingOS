import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/keywords — list tracked keywords
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const keywords = await db.keywordTracker.findMany({
      where: { companyId: payload.companyId },
      orderBy: [{ searchVolume: 'desc' }, { keyword: 'asc' }],
    });

    return NextResponse.json({
      data: keywords.map((k) => ({
        id: k.id,
        keyword: k.keyword,
        searchVolume: k.searchVolume,
        difficulty: k.difficulty,
        trend: k.trend,
        lastPosition: k.lastPosition,
        competitorPositions: (() => { try { return JSON.parse(k.competitorPositions || '{}'); } catch { return {}; } })(),
        updatedAt: k.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[GET /api/keywords]', err);
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 });
  }
}

// POST /api/keywords — add a tracked keyword
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const keyword = String(body.keyword || '').trim().toLowerCase();
    if (!keyword) return NextResponse.json({ error: 'keyword is required' }, { status: 400 });

    // Use upsert because [companyId, keyword] is unique
    const tracker = await db.keywordTracker.upsert({
      where: { companyId_keyword: { companyId: payload.companyId, keyword } },
      create: {
        keyword,
        searchVolume: Number(body.searchVolume) || 0,
        difficulty: Math.min(100, Math.max(0, Number(body.difficulty) || 0)),
        trend: ['up', 'down', 'stable'].includes(body.trend) ? body.trend : 'stable',
        lastPosition: body.lastPosition != null ? Number(body.lastPosition) : null,
        companyId: payload.companyId,
      },
      update: {
        searchVolume: body.searchVolume != null ? Number(body.searchVolume) : undefined,
        difficulty: body.difficulty != null ? Math.min(100, Math.max(0, Number(body.difficulty))) : undefined,
        trend: ['up', 'down', 'stable'].includes(body.trend) ? body.trend : undefined,
        lastPosition: body.lastPosition != null ? Number(body.lastPosition) : undefined,
      },
    });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'keyword.tracked',
      title: 'Keyword tracked',
      description: `Now tracking "${keyword}" (volume: ${tracker.searchVolume}/mo, difficulty: ${tracker.difficulty})`,
      resourceType: 'keyword',
      resourceId: tracker.id,
      link: '/market-intelligence',
      metadata: { keyword, searchVolume: tracker.searchVolume },
    });

    return NextResponse.json({
      data: {
        id: tracker.id,
        keyword: tracker.keyword,
        searchVolume: tracker.searchVolume,
        difficulty: tracker.difficulty,
        trend: tracker.trend,
        lastPosition: tracker.lastPosition,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/keywords]', err);
    return NextResponse.json({ error: 'Failed to add keyword' }, { status: 500 });
  }
}
