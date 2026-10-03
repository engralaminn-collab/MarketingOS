import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// POST /api/sms/send — queue an SMS for sending
// Body: { to: "+15551234567", body: "Hello!", leadId?: string, contactId?: string }
//
// Real delivery: in production this would call Twilio/httpsms/etc.
// Here we mark as "queued" → simulate send → mark as "sent" after 1s.
// The SmsMessage row persists a full audit trail regardless.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const to = String(body.to || '').trim();
    const text = String(body.body || '').trim();
    if (!to || !text) {
      return NextResponse.json({ error: 'to and body are required' }, { status: 400 });
    }
    if (text.length > 1600) {
      return NextResponse.json({ error: 'SMS body too long (max 1600 chars)' }, { status: 400 });
    }

    // Create the SMS row with status=queued
    const sms = await db.smsMessage.create({
      data: {
        to,
        from: null, // would be the assigned sender number in production
        body: text,
        status: 'queued',
        leadId: body.leadId || null,
        contactId: body.contactId || null,
        companyId: payload.companyId,
        sentBy: payload.userId,
      },
    });

    // Simulate async send — in production this would call Twilio / httpsms / etc.
    // We just mark as "sent" after a short delay.
    setTimeout(async () => {
      try {
        await db.smsMessage.update({
          where: { id: sms.id },
          data: {
            status: 'sent',
            providerMessageId: `sim_${sms.id}_${Date.now()}`,
          },
        });
        await emitEvent({
          companyId: payload.companyId,
          userId: payload.userId,
          type: 'sms.sent',
          title: 'SMS sent',
          description: `SMS sent to ${to}: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
          resourceType: 'sms',
          resourceId: sms.id,
          link: body.leadId ? '/crm' : undefined,
          metadata: { to, body: text.slice(0, 100) },
        });
      } catch (err) {
        console.error('[sms send] failed to update status:', err);
      }
    }, 1000);

    return NextResponse.json({
      data: {
        id: sms.id,
        to: sms.to,
        body: sms.body,
        status: sms.status,
        createdAt: sms.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sms/send]', err);
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
  }
}
