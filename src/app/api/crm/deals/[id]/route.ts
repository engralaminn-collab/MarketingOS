import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// PATCH /api/crm/deals/[id] — update deal (stage changes from kanban DnD hit this)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const existing = await db.deal.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const update: any = {};
    const allowedFields = ['name', 'value', 'stage', 'probability', 'notes', 'closeDate'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'value' || field === 'probability') {
          update[field] = Number(data[field]);
        } else if (field === 'closeDate') {
          update[field] = data[field] ? new Date(data[field]) : null;
        } else {
          update[field] = data[field];
        }
      }
    }

    // If stage changed, auto-set probability if not explicitly provided
    if (data.stage && data.stage !== existing.stage && data.probability === undefined) {
      const map: Record<string, number> = {
        prospect: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0,
      };
      update.probability = map[data.stage] ?? existing.probability;
    }

    const deal = await db.deal.update({ where: { id }, data: update });

    // Fire event when stage changes (especially deal.won, deal.lost)
    if (data.stage && data.stage !== existing.stage) {
      await emitEvent({
        companyId: payload.companyId,
        userId: payload.userId,
        type: data.stage === 'won' ? 'deal.won' : data.stage === 'lost' ? 'deal.lost' : 'deal.stage_changed',
        title: data.stage === 'won' ? '🎉 Deal won!' : data.stage === 'lost' ? 'Deal lost' : 'Deal moved',
        description: `Deal "${deal.name}" moved from ${existing.stage} → ${data.stage} ($${deal.value})`,
        resourceType: 'deal',
        resourceId: id,
        link: '/crm',
        metadata: {
          dealName: deal.name,
          value: deal.value,
          oldStage: existing.stage,
          newStage: data.stage,
        },
      });
    }

    return NextResponse.json({ deal });
  } catch (err) {
    console.error('[PATCH /api/crm/deals/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/crm/deals/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const existing = await db.deal.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Unlink leads before deleting
    await db.lead.updateMany({ where: { dealId: id }, data: { dealId: null } });
    await db.deal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/crm/deals/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
