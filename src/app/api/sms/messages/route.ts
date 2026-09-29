import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/sms/messages — list SMS messages for the company
// Optional: ?leadId=... or ?contactId=... to filter
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('leadId');
    const contactId = searchParams.get('contactId');
    const status = searchParams.get('status');

    const where: any = { companyId: payload.companyId };
    if (leadId) where.leadId = leadId;
    if (contactId) where.contactId = contactId;
    if (status) where.status = status;

    const messages = await db.smsMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    const stats = await db.smsMessage.groupBy({
      by: ['status'],
      where: { companyId: payload.companyId },
      _count: true,
    });

    return NextResponse.json({
      data: messages.map((m) => ({
        id: m.id,
        to: m.to,
        from: m.from,
        body: m.body,
        status: m.status,
        providerMessageId: m.providerMessageId,
        error: m.error,
        leadId: m.leadId,
        contactId: m.contactId,
        sender: m.sender,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      stats: stats.map((s) => ({ status: s.status, count: s._count })),
    });
  } catch (err) {
    console.error('[GET /api/sms/messages]', err);
    return NextResponse.json({ error: 'Failed to fetch SMS messages' }, { status: 500 });
  }
}
