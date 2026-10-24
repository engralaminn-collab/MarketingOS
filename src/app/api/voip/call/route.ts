import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';

// POST /api/voip/call — Outbound VoIP call initiator (0perationPrivacy/VoIP: Telnyx Call Control v2, Twilio Voice, or SIP Session Log)
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const to = String(body.to || '').trim();
    const provider = String(body.provider || 'auto').toLowerCase();
    const notes = String(body.notes || '').trim();
    if (!to) return NextResponse.json({ error: 'to required' }, { status: 400 });

    const call = await db.smsMessage.create({
      data: {
        to,
        from: null,
        body: notes ? `VoIP [${provider}] call to ${to} — ${notes}` : `VoIP [${provider}] call to ${to}`,
        status: 'queued',
        providerMessageId: `voip_${Date.now()}`,
        leadId: body.leadId || null,
        contactId: body.contactId || null,
        companyId: payload.companyId,
        sentBy: payload.userId,
      },
    });

    // 1. Telnyx Call Control API v2
    const telnyxKey = process.env.TELNYX_API_KEY;
    const telnyxConnection = process.env.TELNYX_CONNECTION_ID;
    const telnyxFrom = process.env.TELNYX_FROM_NUMBER;
    if ((provider === 'telnyx' || provider === 'auto') && telnyxKey && telnyxConnection && telnyxFrom) {
      const res = await fetch('https://api.telnyx.com/v2/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${telnyxKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: telnyxConnection,
          to,
          from: telnyxFrom,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { data?: { call_control_id?: string } };
        await db.smsMessage.update({
          where: { id: call.id },
          data: {
            from: telnyxFrom,
            status: 'ringing',
            providerMessageId: json.data?.call_control_id || call.providerMessageId,
          },
        });
        return NextResponse.json(
          { data: { callId: call.id, to, provider: 'telnyx', status: 'ringing' } },
          { status: 201 }
        );
      }
    }

    // 2. Twilio Programmable Voice API
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_FROM_NUMBER;
    if ((provider === 'twilio' || provider === 'auto') && twilioSid && twilioToken && twilioFrom) {
      const form = new URLSearchParams({
        To: to,
        From: twilioFrom,
        Twiml: `<Response><Say>Connecting your MarketingOS outbound call.</Say></Response>`,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Calls.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form,
          signal: AbortSignal.timeout(15000),
        }
      );
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string };
        await db.smsMessage.update({
          where: { id: call.id },
          data: {
            from: twilioFrom,
            status: json.status || 'queued',
            providerMessageId: json.sid || call.providerMessageId,
          },
        });
        return NextResponse.json(
          { data: { callId: call.id, to, provider: 'twilio', status: json.status || 'queued' } },
          { status: 201 }
        );
      }
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'voip.call_initiated',
      title: 'VoIP SIP/Call session logged',
      description: `Call session logged for ${to} (${provider})`,
      resourceType: 'voip',
      resourceId: call.id,
      metadata: { to, provider, notes },
    });

    await db.smsMessage.update({
      where: { id: call.id },
      data: {
        status: 'logged_sip',
        body: notes ? `VoIP [${provider}] call logged to ${to} — ${notes}` : `VoIP [${provider}] call logged to ${to}`,
      },
    });

    return NextResponse.json(
      { data: { callId: call.id, to, provider: provider === 'auto' ? 'sip-session' : provider, status: 'logged_sip' } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to initiate VoIP call' }, { status: 500 });
  }
}
