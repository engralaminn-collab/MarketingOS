import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/settings/webhooks
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const webhooks = await db.webhook.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      webhooks: webhooks.map((w) => ({
        id: w.id,
        url: w.url,
        events: JSON.parse(w.events || '[]'),
        status: w.status,
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[GET /api/settings/webhooks]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/settings/webhooks
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const data = await req.json();
    if (!data.url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    const secret = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const webhook = await db.webhook.create({
      data: {
        url: String(data.url),
        events: JSON.stringify(data.events || []),
        status: 'active',
        secret,
        companyId: payload.companyId,
      },
    });
    return NextResponse.json({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events),
        status: webhook.status,
      },
    });
  } catch (err) {
    console.error('[POST /api/settings/webhooks]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
