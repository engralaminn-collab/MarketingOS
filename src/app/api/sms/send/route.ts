import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// POST /api/sms/send — send an SMS through the configured provider.
// Body: { to: "+15551234567", body: "Hello!", leadId?: string, contactId?: string }
//
// Delivery is REAL. The message is handed to Twilio when TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are configured server-side.
//
// When no provider is configured the row is persisted with status 'blocked'
// and a reason. It is never reported as 'sent' — a delivery confirmation is
// only written after the provider accepts the message and returns its SID.
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

    // ── Real delivery (NdoleStudio/httpsms OR Twilio) ────────────────────
    const httpSmsKey = process.env.HTTPSMS_API_KEY;
    const httpSmsFrom = process.env.HTTPSMS_FROM_NUMBER;
    if (httpSmsKey && httpSmsFrom) {
      try {
        const res = await fetch('https://api.httpsms.com/v1/messages/send', {
          method: 'POST',
          headers: {
            'x-api-key': httpSmsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: text, from: httpSmsFrom, to }),
          signal: AbortSignal.timeout(15000),
        });
        const httpSmsBody = (await res.json().catch(() => ({}))) as {
          data?: { id?: string; status?: string };
          message?: string;
        };
        if (!res.ok) {
          await db.smsMessage.update({
            where: { id: sms.id },
            data: { status: 'failed', error: `httpSMS rejected message (HTTP ${res.status}): ${httpSmsBody.message || 'unknown'}` },
          });
          return NextResponse.json({ data: { id: sms.id, to, body: text, status: 'failed' }, error: 'httpSMS rejected message' }, { status: 502 });
        }
        await db.smsMessage.update({
          where: { id: sms.id },
          data: {
            from: httpSmsFrom,
            status: httpSmsBody.data?.status || 'queued',
            providerMessageId: httpSmsBody.data?.id || null,
          },
        });
        return NextResponse.json(
          {
            data: {
              id: sms.id,
              to: sms.to,
              body: sms.body,
              provider: 'httpsms',
              status: httpSmsBody.data?.status || 'queued',
              providerMessageId: httpSmsBody.data?.id || null,
              createdAt: sms.createdAt.toISOString(),
            },
          },
          { status: 201 }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown httpSMS transport error';
        await db.smsMessage.update({ where: { id: sms.id }, data: { status: 'failed', error: message } });
        return NextResponse.json({ data: { id: sms.id, to, body: text, status: 'failed' }, error: message }, { status: 502 });
      }
    }

    // Credentials come from server-side env only. If any are missing we do NOT
    // pretend the message went out.
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !authToken || !fromNumber) {
      await db.smsMessage.update({
        where: { id: sms.id },
        data: {
          status: 'blocked',
          error: 'No SMS provider configured (set HTTPSMS_API_KEY + HTTPSMS_FROM_NUMBER for free Android gateway or TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER).',
        },
      });
      return NextResponse.json(
        {
          data: {
            id: sms.id,
            to: sms.to,
            body: sms.body,
            status: 'blocked',
            createdAt: sms.createdAt.toISOString(),
          },
          error:
            'SMS provider is not configured. The message was recorded but NOT sent. ' +
            'Configure the Twilio credentials in Settings to enable delivery.',
        },
        { status: 503 }
      );
    }

    try {
      const form = new URLSearchParams({ To: to, From: fromNumber, Body: text });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form,
          signal: AbortSignal.timeout(15000),
        }
      );

      const providerBody = (await res.json().catch(() => ({}))) as {
        sid?: string;
        status?: string;
        message?: string;
      };

      if (!res.ok) {
        // Provider rejected it — record the real failure, never a success.
        await db.smsMessage.update({
          where: { id: sms.id },
          data: {
            status: 'failed',
            error: `Provider rejected the message (HTTP ${res.status}): ${providerBody.message ?? 'unknown error'}`,
          },
        });
        return NextResponse.json(
          {
            data: { id: sms.id, to: sms.to, body: sms.body, status: 'failed' },
            error: `SMS provider rejected the message (HTTP ${res.status}).`,
          },
          { status: 502 }
        );
      }

      // Accepted. Twilio reports 'queued'/'accepted' here; final delivery is
      // confirmed later by its status webhook, so we record what it told us
      // rather than asserting the message was delivered.
      await db.smsMessage.update({
        where: { id: sms.id },
        data: {
          from: fromNumber,
          status: providerBody.status ?? 'queued',
          providerMessageId: providerBody.sid ?? null,
        },
      });

      await emitEvent({
        companyId: payload.companyId,
        userId: payload.userId,
        type: 'sms.sent',
        title: 'SMS accepted by provider',
        description: `SMS to ${to} accepted by provider: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
        resourceType: 'sms',
        resourceId: sms.id,
        link: body.leadId ? '/crm' : undefined,
        metadata: { to, providerStatus: providerBody.status ?? 'queued' },
      });

      return NextResponse.json(
        {
          data: {
            id: sms.id,
            to: sms.to,
            body: sms.body,
            status: providerBody.status ?? 'queued',
            providerMessageId: providerBody.sid ?? null,
            createdAt: sms.createdAt.toISOString(),
          },
        },
        { status: 201 }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown transport error';
      await db.smsMessage.update({
        where: { id: sms.id },
        data: { status: 'failed', error: `Could not reach SMS provider: ${message}` },
      });
      return NextResponse.json(
        {
          data: { id: sms.id, to: sms.to, body: sms.body, status: 'failed' },
          error: 'Could not reach the SMS provider.',
        },
        { status: 502 }
      );
    }

  } catch (err) {
    console.error('[POST /api/sms/send]', err);
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
  }
}
