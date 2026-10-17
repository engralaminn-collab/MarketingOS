import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptSecret } from '@/lib/credentials';
import { hasPermission, verifyToken } from '@/lib/auth';
import { isUrlSafe } from '@/lib/ssrf';

const EVENT_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/i;

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const webhooks = await db.webhook.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      webhooks: webhooks.map((webhook) => {
        let events: string[] = [];
        try {
          const parsed: unknown = JSON.parse(webhook.events || '[]');
          if (Array.isArray(parsed)) events = parsed.filter((value): value is string => typeof value === 'string');
        } catch { /* keep empty list */ }
        return {
          id: webhook.id,
          url: webhook.url,
          events,
          status: webhook.status,
          hasSecret: Boolean(webhook.secret),
          deliveryCount: webhook.deliveryCount,
          failureCount: webhook.failureCount,
          lastDeliveredAt: webhook.lastDeliveredAt?.toISOString() || null,
          lastDeliveryStatus: webhook.lastDeliveryStatus,
          lastDeliveryError: webhook.lastDeliveryError,
          createdAt: webhook.createdAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    console.error('[GET /api/settings/webhooks]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!rawUrl || rawUrl.length > 2048) return NextResponse.json({ error: 'A valid HTTPS URL is required' }, { status: 400 });

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: 'A valid HTTPS URL is required' }, { status: 400 });
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      return NextResponse.json({ error: 'Webhook URLs must use HTTPS and cannot contain credentials' }, { status: 400 });
    }
    const safe = await isUrlSafe(url.toString());
    if (!safe.allowed) return NextResponse.json({ error: 'Webhook URL is not a permitted public destination' }, { status: 400 });

    const events = body.events === undefined ? ['lead.created', 'campaign.completed'] : body.events;
    if (!Array.isArray(events) || events.length > 50 || events.some((event) => typeof event !== 'string' || event.length > 100 || (event !== '*' && !EVENT_PATTERN.test(event)))) {
      return NextResponse.json({ error: 'Events must be an array of up to 50 valid event names' }, { status: 400 });
    }
    const cleanEvents = events.filter((event: string) => event !== '*');
    if (events.includes('*') && events.length !== 1) {
      return NextResponse.json({ error: 'Use "*" by itself to subscribe to all events' }, { status: 400 });
    }

    const secret = randomBytes(32).toString('hex');
    let encryptedSecret: string;
    try {
      encryptedSecret = encryptSecret(secret);
    } catch (error) {
      console.error('[POST /api/settings/webhooks] signing-secret encryption unavailable:', error);
      return NextResponse.json({ error: 'Webhook secrets cannot be stored until CREDENTIAL_ENCRYPTION_KEY is configured' }, { status: 503 });
    }

    const webhook = await db.webhook.create({
      data: {
        url: url.toString(),
        events: JSON.stringify(cleanEvents),
        status: 'active',
        secret: encryptedSecret,
        companyId: payload.companyId,
      },
      select: { id: true, url: true, events: true, status: true, createdAt: true },
    });
    return NextResponse.json({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        status: webhook.status,
        createdAt: webhook.createdAt.toISOString(),
        secret,
        signatureHeader: 'X-MarketingOS-Signature: t=<unix timestamp>,v1=<hex HMAC-SHA256>',
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/settings/webhooks]', error);
    return NextResponse.json({ error: 'Unable to create webhook' }, { status: 500 });
  }
}
