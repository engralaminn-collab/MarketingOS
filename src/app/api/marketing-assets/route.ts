import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

const ASSET_TYPES = ['marketing_kit', 'marketing_diagram', 'cta_button'] as const;
const MAX_PAYLOAD_CHARS = 60_000;
const MAX_TITLE_CHARS = 160;

type AssetType = (typeof ASSET_TYPES)[number];

function isAssetType(value: unknown): value is AssetType {
  return typeof value === 'string' && ASSET_TYPES.includes(value as AssetType);
}

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.userId || !payload.companyId) return null;
  return {
    userId: payload.userId,
    companyId: payload.companyId,
    role: payload.role,
  };
}

function parseAssetBody(value: unknown): { type: AssetType; title: string; payload: Record<string, unknown> } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const type = body.type;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const payload = body.payload;
  if (!isAssetType(type) || !title || title.length > MAX_TITLE_CHARS) return null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return null;
  }
  if (serialized.length > MAX_PAYLOAD_CHARS) return null;
  return { type, title, payload: payload as Record<string, unknown> };
}

function serializeAsset(row: {
  id: string;
  title: string;
  type: string;
  body: string | null;
  aiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.body || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    // A malformed legacy row remains visible but cannot be interpreted as a saved asset.
  }
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    payload,
    aiGenerated: row.aiGenerated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requestedType = new URL(req.url).searchParams.get('type');
    if (requestedType && requestedType !== 'all' && !isAssetType(requestedType)) {
      return NextResponse.json({ error: 'Unsupported asset type' }, { status: 400 });
    }

    const assets = await db.content.findMany({
      where: {
        companyId: actor.companyId,
        type: requestedType && requestedType !== 'all' ? requestedType : { in: [...ASSET_TYPES] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, title: true, type: true, body: true, aiGenerated: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ data: assets.map(serializeAsset) });
  } catch (error) {
    console.error('[GET /api/marketing-assets]', error);
    return NextResponse.json({ error: 'Failed to fetch marketing assets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = parseAssetBody(await req.json().catch(() => null));
    if (!parsed) {
      return NextResponse.json({ error: 'Provide a supported asset type, a title up to 160 characters, and a JSON payload up to 60 KB' }, { status: 400 });
    }

    const content = await db.content.create({
      data: {
        title: parsed.title,
        type: parsed.type,
        status: 'draft',
        body: JSON.stringify(parsed.payload),
        aiGenerated: false,
        creatorId: actor.userId,
        companyId: actor.companyId,
      },
      select: { id: true, title: true, type: true, body: true, aiGenerated: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ data: serializeAsset(content) }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/marketing-assets]', error);
    return NextResponse.json({ error: 'Failed to save marketing asset' }, { status: 500 });
  }
}
