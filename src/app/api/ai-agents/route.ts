import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  return actor?.companyId && actor.userId ? actor : null;
}

export async function GET(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'A company workspace session is required.' }, { status: 401 });
  try {
    const agents = await db.aiAgent.findMany({ where: { companyId: actor.companyId! }, orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json({ agents });
  } catch { return NextResponse.json({ error: 'Could not fetch agents.' }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'A company workspace session is required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
  const { id, isEnabled } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !id || id.length > 128 || typeof isEnabled !== 'boolean') return NextResponse.json({ error: 'id and boolean isEnabled are required.' }, { status: 400 });
  try {
    const updated = await db.aiAgent.updateMany({ where: { id, companyId: actor.companyId! }, data: { isEnabled } });
    if (!updated.count) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    return NextResponse.json({ agent: await db.aiAgent.findFirst({ where: { id, companyId: actor.companyId! } }) });
  } catch { return NextResponse.json({ error: 'Could not update agent.' }, { status: 500 }); }
}
