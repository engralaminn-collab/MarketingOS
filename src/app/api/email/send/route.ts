import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

// POST /api/email/send — Multi-adapter Email & Newsletter Dispatch (Resend, Brevo, SMTP/Webhook, or Staged Queue)
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const to = String(body.to || '').trim();
    const subject = String(body.subject || '').trim();
    const html = String(body.html || body.content || '').trim();
    const adapter = String(body.adapter || 'auto').toLowerCase();
    const fromEmail = String(body.from || process.env.EMAIL_FROM || 'noreply@marketingos.local').trim();

    if (!subject || !html) {
      return NextResponse.json({ error: 'subject and html/content are required' }, { status: 400 });
    }

    // Persist in Content table as email record
    const record = await db.content.create({
      data: {
        title: subject,
        body: html,
        type: 'email',
        platform: 'email',
        status: adapter === 'stage' ? 'draft' : 'scheduled',
        companyId: payload.companyId,
        creatorId: payload.userId,
        aiGenerated: Boolean(body.aiGenerated),
      },
    });

    if (adapter === 'stage' || !to) {
      return NextResponse.json(
        {
          data: {
            id: record.id,
            adapter: 'staged_queue',
            status: 'staged',
            subject,
            to: to || null,
          },
        },
        { status: 201 }
      );
    }

    // 1. Resend Adapter (Free 3,000 emails/mo tier)
    const resendKey = process.env.RESEND_API_KEY;
    if ((adapter === 'resend' || adapter === 'auto') && resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { id?: string };
        await db.content.update({ where: { id: record.id }, data: { status: 'published', publishedAt: new Date() } });
        return NextResponse.json({
          data: { id: record.id, providerId: json.id, adapter: 'resend', status: 'sent', to, subject },
        });
      }
    }

    // 2. Brevo Adapter (Free 300 emails/day tier)
    const brevoKey = process.env.BREVO_API_KEY;
    if ((adapter === 'brevo' || adapter === 'auto') && brevoKey) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: fromEmail, name: 'MarketingOS' },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { messageId?: string };
        await db.content.update({ where: { id: record.id }, data: { status: 'published', publishedAt: new Date() } });
        return NextResponse.json({
          data: { id: record.id, providerId: json.messageId, adapter: 'brevo', status: 'sent', to, subject },
        });
      }
    }

    // 3. SMTP Relay / n8n Webhook Adapter
    const webhookUrl = process.env.EMAIL_WEBHOOK_URL;
    if ((adapter === 'webhook' || adapter === 'smtp' || adapter === 'auto') && webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to, subject, html }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        await db.content.update({ where: { id: record.id }, data: { status: 'published', publishedAt: new Date() } });
        return NextResponse.json({
          data: { id: record.id, adapter: 'webhook', status: 'sent', to, subject },
        });
      }
    }

    return NextResponse.json(
      {
        data: {
          id: record.id,
          adapter: 'staged_no_provider_key',
          status: 'staged',
          to,
          subject,
          note: 'Saved to Content Queue. Configure RESEND_API_KEY, BREVO_API_KEY, or EMAIL_WEBHOOK_URL for live dispatch.',
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Email send failed' }, { status: 500 });
  }
}
