import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/competitors — list competitors for the company
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const competitors = await db.competitor.findMany({
      where: { companyId: payload.companyId },
      orderBy: [{ threatLevel: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      data: competitors.map((c) => ({
        id: c.id,
        name: c.name,
        website: c.website,
        description: c.description,
        strengths: (() => { try { return JSON.parse(c.strengths || '[]'); } catch { return []; } })(),
        weaknesses: (() => { try { return JSON.parse(c.weaknesses || '[]'); } catch { return []; } })(),
        pricing: c.pricing,
        marketShare: c.marketShare,
        threatLevel: c.threatLevel,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[GET /api/competitors]', err);
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 });
  }
}

// POST /api/competitors — add a competitor
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const threatLevels = ['low', 'medium', 'high'];
    const threatLevel = threatLevels.includes(body.threatLevel) ? body.threatLevel : 'medium';

    const competitor = await db.competitor.create({
      data: {
        name,
        website: body.website ? String(body.website) : null,
        description: body.description ? String(body.description) : null,
        strengths: JSON.stringify(body.strengths || []),
        weaknesses: JSON.stringify(body.weaknesses || []),
        pricing: body.pricing ? String(body.pricing) : null,
        marketShare: body.marketShare ? String(body.marketShare) : null,
        threatLevel,
        companyId: payload.companyId,
      },
    });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'competitor.added',
      title: 'Competitor added',
      description: `Competitor "${competitor.name}" added (threat: ${threatLevel})`,
      resourceType: 'competitor',
      resourceId: competitor.id,
      link: '/market-intelligence',
      metadata: { name, threatLevel },
    });

    return NextResponse.json({
      data: {
        id: competitor.id,
        name: competitor.name,
        website: competitor.website,
        threatLevel: competitor.threatLevel,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/competitors]', err);
    return NextResponse.json({ error: 'Failed to add competitor' }, { status: 500 });
  }
}
