import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

const ASSET_TYPES = ['marketing_kit', 'marketing_diagram', 'cta_button'] as const;
const MAX_PAYLOAD_CHARS = 60_000;
const MAX_TITLE_CHARS = 160;

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.userId || !payload.companyId) return null;
  return { userId: payload.userId, companyId: payload.companyId, role: payload.role };
}

function parseUpdate(value: unknown): { title: string; payload: Record<string, unknown> } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const payload = body.payload;
  if (!title || title.length > MAX_TITLE_CHARS || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  try {
    if (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) return null;
  } catch {
    return null;
  }
  return { title, payload: payload as Record<string, unknown> };
}

const routeParams = (context: { params: Promise<{ id: string }> }) => context.params;

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await routeParams(context);
    const existing = await db.content.findFirst({
      where: { id, companyId: actor.companyId, type: { in: [...ASSET_TYPES] } },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const parsed = parseUpdate(await req.json().catch(() => null));
    if (!parsed) return NextResponse.json({ error: 'Provide a title up to 160 characters and a JSON payload up to 60 KB' }, { status: 400 });

    const asset = await db.content.update({
      where: { id },
      data: { title: parsed.title, body: JSON.stringify(parsed.payload) },
      select: { id: true, title: true, type: true, body: true, aiGenerated: true, createdAt: true, updatedAt: true },
    });

    let payload: Record<string, unknown> = {};
    try {
      const decoded: unknown = JSON.parse(asset.body || '{}');
      if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) payload = decoded as Record<string, unknown>;
    } catch {
      // The body was just serialized above; this is defensive against corrupt DB data.
    }
    return NextResponse.json({ data: { ...asset, payload, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString() } });
  } catch (error) {
    console.error('[PATCH /api/marketing-assets/[id]]', error);
    return NextResponse.json({ error: 'Failed to update marketing asset' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await routeParams(context);
    const existing = await db.content.findFirst({
      where: { id, companyId: actor.companyId, type: { in: [...ASSET_TYPES] } },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    await db.content.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/marketing-assets/[id]]', error);
    return NextResponse.json({ error: 'Failed to delete marketing asset' }, { status: 500 });
  }
}
