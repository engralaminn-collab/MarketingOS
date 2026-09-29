import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/crm/leads/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const lead = await db.lead.findFirst({
      where: { id, companyId: payload.companyId },
      include: {
        activities: { orderBy: { createdAt: 'desc' } },
        tags: true,
        deal: true,
        assignedTo: { include: { user: true } },
      },
    });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (err) {
    console.error('[GET /api/crm/leads/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/crm/leads/[id] — update lead (status, score, notes, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    // Verify ownership
    const existing = await db.lead.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const update: any = {};
    const allowedFields = ['name', 'email', 'phone', 'companyName', 'source', 'status', 'score', 'notes', 'assignedToId'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) update[field] = data[field];
    }

    const lead = await db.lead.update({
      where: { id },
      data: update,
      include: { tags: true, activities: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    // Log status changes as activities (orocrm-style audit trail)
    if (data.status && data.status !== existing.status) {
      await db.leadActivity.create({
        data: {
          type: 'status_change',
          content: `Status changed from ${existing.status} → ${data.status}`,
          leadId: id,
        },
      });

      // Fire event for status change — including "deal.won" if relevant
      const isWon = data.status === 'won' || data.status === 'qualified';
      await emitEvent({
        companyId: payload.companyId,
        userId: payload.userId,
        type: `lead.status_changed`,
        title: `Lead status updated`,
        description: `Lead "${lead.name}" status: ${existing.status} → ${data.status}`,
        resourceType: 'lead',
        resourceId: id,
        link: '/crm',
        metadata: { oldStatus: existing.status, newStatus: data.status, leadName: lead.name },
      });
    }

    return NextResponse.json({ lead });
  } catch (err) {
    console.error('[PATCH /api/crm/leads/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/crm/leads/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const existing = await db.lead.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Cascade-delete child records (SQLite doesn't enforce referential actions for these)
    await db.leadActivity.deleteMany({ where: { leadId: id } });
    await db.leadTag.deleteMany({ where: { leadId: id } });
    await db.lead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/crm/leads/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
