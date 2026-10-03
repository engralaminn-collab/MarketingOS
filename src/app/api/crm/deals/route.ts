import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/crm/deals — list all deals, optionally filtered by stage
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { stage, search } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (stage && stage !== 'all') where.stage = stage;
    if (search) where.name = { contains: search };

    const deals = await db.deal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { leads: true },
    });

    // Pipeline aggregation by stage (frappe-style kanban columns)
    const pipeline = await db.deal.groupBy({
      by: ['stage'],
      where: { companyId: payload.companyId },
      _count: true,
      _sum: { value: true },
    });

    const pipelineMap: Record<string, { count: number; total: number }> = {};
    for (const p of pipeline) {
      pipelineMap[p.stage] = { count: p._count, total: p._sum.value ?? 0 };
    }

    return NextResponse.json({ deals, pipeline: pipelineMap });
  } catch (err) {
    console.error('[GET /api/crm/deals]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/deals — create a new deal
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const data = await req.json();
    const stage = data.stage ? String(data.stage).toLowerCase() : 'prospect';
    const probability = data.probability !== undefined
      ? Number(data.probability)
      : defaultProbabilityForStage(stage);

    const deal = await db.deal.create({
      data: {
        name: String(data.name || data.title || '').trim(),
        value: Number(data.value || 0),
        stage,
        probability,
        closeDate: data.closeDate ? new Date(data.closeDate) : null,
        notes: data.notes ? String(data.notes) : null,
        companyId: payload.companyId,
      },
    });

    // Fire event: new deal created
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'deal.created',
      title: 'New deal created',
      description: `Deal "${deal.name}" created (${deal.stage}, $${deal.value})`,
      resourceType: 'deal',
      resourceId: deal.id,
      link: '/crm',
      metadata: { dealName: deal.name, value: deal.value, stage: deal.stage },
    });

    return NextResponse.json({ deal });
  } catch (err) {
    console.error('[POST /api/crm/deals]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function defaultProbabilityForStage(stage: string): number {
  const map: Record<string, number> = {
    prospect: 10,
    qualified: 25,
    proposal: 50,
    negotiation: 75,
    won: 100,
    lost: 0,
  };
  return map[stage] ?? 10;
}
