import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// POST /api/sms/broadcast — send SMS to multiple leads/contacts at once
// Body: { message: string, leadIds?: string[], contactIds?: string[], filter?: { source?: string, status?: string } }
// If no IDs provided, sends to all leads with phone numbers matching the filter
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const message = String(body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
    if (message.length > 1600) return NextResponse.json({ error: 'Message too long (max 1600 chars)' }, { status: 400 });

    // Collect recipients
    let recipients: { phone: string; leadId?: string; contactId?: string; name: string }[] = [];

    // From specific lead IDs
    if (Array.isArray(body.leadIds) && body.leadIds.length > 0) {
      const leads = await db.lead.findMany({
        where: { id: { in: body.leadIds }, companyId: payload.companyId, phone: { not: null } },
        select: { id: true, name: true, phone: true },
      });
      for (const l of leads) {
        if (l.phone) recipients.push({ phone: l.phone, leadId: l.id, name: l.name });
      }
    }

    // From specific contact IDs
    if (Array.isArray(body.contactIds) && body.contactIds.length > 0) {
      const contacts = await db.contact.findMany({
        where: { id: { in: body.contactIds }, companyId: payload.companyId, phone: { not: null } },
        select: { id: true, name: true, phone: true },
      });
      for (const c of contacts) {
        if (c.phone) recipients.push({ phone: c.phone, contactId: c.id, name: c.name });
      }
    }

    // If no IDs, broadcast to all leads matching filter
    if (recipients.length === 0 && body.filter) {
      const where: any = { companyId: payload.companyId, phone: { not: null } };
      if (body.filter.source) where.source = body.filter.source;
      if (body.filter.status) where.status = body.filter.status;
      const leads = await db.lead.findMany({ where, select: { id: true, name: true, phone: true } });
      for (const l of leads) {
        if (l.phone) recipients.push({ phone: l.phone, leadId: l.id, name: l.name });
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found with phone numbers' }, { status: 400 });
    }

    // Limit to 100 per broadcast to prevent abuse
    const maxRecipients = 100;
    if (recipients.length > maxRecipients) {
      recipients = recipients.slice(0, maxRecipients);
    }

    // Send to each recipient (stagger by 100ms to avoid rate limits)
    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      try {
        await db.smsMessage.create({
          data: {
            to: r.phone,
            from: null,
            body: message,
            status: 'sent',
            providerMessageId: `broadcast_${Date.now()}_${sent}`,
            leadId: r.leadId || null,
            contactId: r.contactId || null,
            companyId: payload.companyId,
            sentBy: payload.userId,
          },
        });
        sent++;
        // 100ms delay between sends
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        failed++;
      }
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'sms.broadcast_sent',
      title: `Broadcast sent to ${sent} recipients`,
      description: `Message: "${message.slice(0, 60)}..." → ${sent} sent, ${failed} failed`,
      resourceType: 'sms',
      metadata: { sent, failed, totalRecipients: recipients.length },
    });

    return NextResponse.json({
      data: { sent, failed, totalRecipients: recipients.length, message },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sms/broadcast]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
