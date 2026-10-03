import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const campaigns = await db.campaign.findMany({
      where: { companyId: payload.companyId },
      include: { contents: true },
      orderBy: { createdAt: 'desc' },
    });

    // Parse metrics JSON strings into objects so the frontend can read them directly
    const parsed = campaigns.map((c) => ({
      ...c,
      metrics: (() => { try { return JSON.parse(c.metrics || '{}'); } catch { return {}; } })(),
    }));

    return NextResponse.json({ campaigns: parsed });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const data = await req.json();
    // Prisma stores metrics as String, so we must JSON.stringify objects
    const createData: any = { ...data, companyId: payload.companyId };
    if (data.metrics && typeof data.metrics === 'object') {
      createData.metrics = JSON.stringify(data.metrics);
    }
    if (data.startDate) createData.startDate = new Date(data.startDate);
    if (data.endDate) createData.endDate = new Date(data.endDate);
    if (data.budget !== undefined) createData.budget = Number(data.budget);
    const campaign = await db.campaign.create({ data: createData });

    // Fire event: campaign created
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'campaign.created',
      title: 'New campaign created',
      description: `Campaign "${campaign.name}" created (${campaign.type}, $${campaign.budget || 0} budget)`,
      resourceType: 'campaign',
      resourceId: campaign.id,
      link: '/campaigns',
      metadata: { name: campaign.name, type: campaign.type, budget: campaign.budget },
    });

    return NextResponse.json({ campaign });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
