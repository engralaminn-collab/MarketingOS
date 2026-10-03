import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/crm/contacts
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { search } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { companyName: { contains: search } },
      ];
    }

    const contacts = await db.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ contacts });
  } catch (err) {
    console.error('[GET /api/crm/contacts]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/contacts
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const data = await req.json();
    const contact = await db.contact.create({
      data: {
        name: String(data.name || '').trim(),
        email: data.email ? String(data.email).trim() : null,
        phone: data.phone ? String(data.phone).trim() : null,
        companyName: data.company || data.companyName ? String(data.company || data.companyName).trim() : null,
        position: data.position ? String(data.position) : null,
        source: data.source ? String(data.source) : null,
        notes: data.notes ? String(data.notes) : null,
        companyId: payload.companyId,
      },
    });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'contact.created',
      title: 'New contact added',
      description: `Contact "${contact.name}"${contact.companyName ? ' from ' + contact.companyName : ''} was added`,
      resourceType: 'contact',
      resourceId: contact.id,
      link: '/crm',
      metadata: { name: contact.name, companyName: contact.companyName },
    });

    return NextResponse.json({ contact });
  } catch (err) {
    console.error('[POST /api/crm/contacts]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
