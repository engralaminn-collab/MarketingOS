import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// PATCH /api/crm/tickets/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const existing = await db.ticket.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const update: any = {};
    const allowedFields = ['subject', 'description', 'status', 'priority', 'assignedToId'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) update[field] = data[field];
    }

    // If a new message is provided, append it
    if (data.message && String(data.message).trim()) {
      await db.ticketMessage.create({
        data: {
          content: String(data.message),
          ticketId: id,
        },
      });
    }

    const ticket = await db.ticket.update({
      where: { id },
      data: update,
      include: { messages: { orderBy: { createdAt: 'asc' } }, assignedTo: { include: { user: true } } },
    });
    return NextResponse.json({ ticket });
  } catch (err) {
    console.error('[PATCH /api/crm/tickets/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/crm/tickets/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const existing = await db.ticket.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.ticketMessage.deleteMany({ where: { ticketId: id } });
    await db.ticket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/crm/tickets/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
