import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.competitor.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const update: any = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.website !== undefined) update.website = body.website ? String(body.website) : null;
    if (body.description !== undefined) update.description = body.description ? String(body.description) : null;
    if (body.strengths !== undefined) update.strengths = JSON.stringify(body.strengths);
    if (body.weaknesses !== undefined) update.weaknesses = JSON.stringify(body.weaknesses);
    if (body.pricing !== undefined) update.pricing = body.pricing ? String(body.pricing) : null;
    if (body.marketShare !== undefined) update.marketShare = body.marketShare ? String(body.marketShare) : null;
    if (['low', 'medium', 'high'].includes(body.threatLevel)) update.threatLevel = body.threatLevel;

    const competitor = await db.competitor.update({ where: { id }, data: update });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'competitor.updated',
      title: 'Competitor updated',
      description: `Competitor "${competitor.name}" was updated`,
      resourceType: 'competitor',
      resourceId: id,
      link: '/market-intelligence',
    });

    return NextResponse.json({ data: competitor });
  } catch (err) {
    console.error('[PATCH /api/competitors/[id]]', err);
    return NextResponse.json({ error: 'Failed to update competitor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.competitor.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.competitor.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[DELETE /api/competitors/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 });
  }
}
