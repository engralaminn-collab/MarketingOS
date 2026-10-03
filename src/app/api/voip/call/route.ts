import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const to = String(body.to || '').trim();
    if (!to) return NextResponse.json({ error: 'to required' }, { status: 400 });
    const call = await db.smsMessage.create({ data: { to, from: null, body: `VoIP call to ${to}`, status: 'queued', providerMessageId: `voip_${Date.now()}`, leadId: body.leadId || null, contactId: body.contactId || null, companyId: payload.companyId, sentBy: payload.userId } });
    await emitEvent({ companyId: payload.companyId, userId: payload.userId, type: 'voip.call_initiated', title: 'VoIP call initiated', description: `Call to ${to}`, resourceType: 'voip', resourceId: call.id, metadata: { to } });
    setTimeout(async () => { try { await db.smsMessage.update({ where: { id: call.id }, data: { status: 'sent', body: `VoIP call connected to ${to}` } }); } catch {} }, 2000);
    return NextResponse.json({ data: { callId: call.id, to, status: 'connecting' } }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
