import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET /api/settings/api-keys
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const keys = await db.apiKey.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      apiKeys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        key: `${k.keyPrefix}********************************`,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() || null,
      })),
    });
  } catch (err) {
    console.error('[GET /api/settings/api-keys]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/settings/api-keys
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const data = await req.json();
    if (!data.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // Generate a real random API key
    const randomPart = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const fullKey = `mos_live_sk_${randomPart}`;
    const keyPrefix = fullKey.slice(0, 12);

    // Hash the full key with bcrypt (so the DB never stores the raw key)
    const hashedKey = await bcrypt.hash(fullKey, 12);

    const apiKey = await db.apiKey.create({
      data: {
        name: String(data.name),
        keyPrefix,
        hashedKey,
        companyId: payload.companyId,
      },
    });

    // Return the full key ONLY once, at creation time
    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey,
        keyPrefix,
        createdAt: apiKey.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[POST /api/settings/api-keys]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
