import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/crm/tickets
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { status, priority, search } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;
    if (search) where.subject = { contains: search };

    const tickets = await db.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
        assignedTo: { include: { user: true } },
      },
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    console.error('[GET /api/crm/tickets]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/tickets
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const data = await req.json();
    const ticket = await db.ticket.create({
      data: {
        subject: String(data.subject || '').trim(),
        description: data.description ? String(data.description) : null,
        status: data.status ? String(data.status) : 'open',
        priority: data.priority ? String(data.priority) : 'medium',
        assignedToId: data.assignedToId ? String(data.assignedToId) : null,
        companyId: payload.companyId,
      },
      include: { assignedTo: { include: { user: true } } },
    });

    // If description is non-empty, create the initial message
    if (data.description) {
      await db.ticketMessage.create({
        data: {
          content: String(data.description),
          ticketId: ticket.id,
        },
      });
    }

    // Fire event: ticket created (notifies assignee + admins)
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: ticket.priority === 'critical' ? 'ticket.critical_created' : 'ticket.created',
      title: ticket.priority === 'critical' ? '🔴 Critical ticket created' : 'New support ticket',
      description: `Ticket "${ticket.subject}" (${ticket.priority} priority)`,
      resourceType: 'ticket',
      resourceId: ticket.id,
      link: '/crm',
      metadata: { subject: ticket.subject, priority: ticket.priority, status: ticket.status },
    });

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error('[POST /api/crm/tickets]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
