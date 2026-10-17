import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const keys = await db.apiKey.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
    });

    return NextResponse.json({
      apiKeys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('[GET /api/settings/api-keys]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) return NextResponse.json({ error: 'Name must be between 1 and 80 characters' }, { status: 400 });

    let fullKey = '';
    let keyPrefix = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `mos_live_sk_${randomBytes(32).toString('hex')}`;
      const candidatePrefix = candidate.slice(0, 'mos_live_sk_'.length + 20);
      const existingPrefix = await db.apiKey.findFirst({ where: { keyPrefix: candidatePrefix }, select: { id: true } });
      if (!existingPrefix) {
        fullKey = candidate;
        keyPrefix = candidatePrefix;
        break;
      }
    }
    if (!fullKey || !keyPrefix) return NextResponse.json({ error: 'Unable to generate a unique API key prefix; please retry' }, { status: 503 });
    const hashedKey = await bcrypt.hash(fullKey, 12);
    const apiKey = await db.apiKey.create({
      data: {
        name,
        keyPrefix,
        hashedKey,
        companyId: payload.companyId,
        createdById: payload.userId,
      },
      select: { id: true, name: true, keyPrefix: true, createdAt: true },
    });

    await db.auditLog.create({
      data: {
        action: 'api_key.create',
        resource: `API key: ${name}`,
        details: 'Created API key (secret shown once)',
        userId: payload.userId,
        companyId: payload.companyId,
      },
    }).catch((error) => console.error('[POST /api/settings/api-keys] audit log failed:', error));

    return NextResponse.json({
      apiKey: { ...apiKey, key: fullKey, createdAt: apiKey.createdAt.toISOString() },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/settings/api-keys]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
