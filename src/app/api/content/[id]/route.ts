import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.companyId || !payload.userId) return null;
  return { companyId: payload.companyId, role: payload.role };
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const data = await req.json().catch(() => null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return NextResponse.json({ error: 'A JSON request body is required' }, { status: 400 });

    const existing = await db.content.findFirst({ where: { id, companyId: actor.companyId } });
    if (!existing) return NextResponse.json({ error: 'Content not found' }, { status: 404 });

    const update: Record<string, unknown> = {};
    if (data.title !== undefined) {
      if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 180) return NextResponse.json({ error: 'Title must contain 1 to 180 characters' }, { status: 400 });
      update.title = data.title.trim();
    }
    if (data.type !== undefined) {
      if (typeof data.type !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/i.test(data.type.trim())) return NextResponse.json({ error: 'Content type is invalid' }, { status: 400 });
      update.type = data.type.trim();
    }
    if (data.status !== undefined) {
      if (typeof data.status !== 'string' || !['draft', 'scheduled', 'published', 'archived'].includes(data.status)) return NextResponse.json({ error: 'Content status is invalid' }, { status: 400 });
      update.status = data.status;
      if (data.status === 'published' && data.publishedAt === undefined) update.publishedAt = new Date();
    }
    for (const field of ['platform', 'mediaType', 'hashtags'] as const) {
      if (data[field] !== undefined) {
        if (data[field] !== null && typeof data[field] !== 'string') return NextResponse.json({ error: `${field} must be text` }, { status: 400 });
        const limit = field === 'hashtags' ? 2_000 : 64;
        update[field] = typeof data[field] === 'string' ? data[field].trim().slice(0, limit) || null : null;
      }
    }
    if (data.body !== undefined) {
      if (data.body !== null && typeof data.body !== 'string') return NextResponse.json({ error: 'Content body must be text' }, { status: 400 });
      if ((data.body?.length || 0) > 100_000) return NextResponse.json({ error: 'Content body exceeds 100 KB' }, { status: 400 });
      update.body = data.body;
    }
    for (const field of ['mediaUrl', 'thumbnailUrl'] as const) {
      if (data[field] !== undefined) {
        if (data[field] !== null && typeof data[field] !== 'string') return NextResponse.json({ error: `${field} must be a URL string` }, { status: 400 });
        const value = typeof data[field] === 'string' ? data[field].trim() : '';
        if (value.length > 2_048) return NextResponse.json({ error: `${field} is too long` }, { status: 400 });
        update[field] = value || null;
      }
    }
    for (const field of ['scheduledAt', 'publishedAt'] as const) {
      if (data[field] !== undefined) {
        const date = parseDate(data[field]);
        if (date === undefined) return NextResponse.json({ error: `${field} is invalid` }, { status: 400 });
        update[field] = date;
      }
    }
    if (data.campaignId !== undefined) {
      if (data.campaignId !== null && typeof data.campaignId !== 'string') return NextResponse.json({ error: 'Campaign ID is invalid' }, { status: 400 });
      if (typeof data.campaignId === 'string' && data.campaignId) {
        const campaign = await db.campaign.findFirst({ where: { id: data.campaignId, companyId: actor.companyId }, select: { id: true } });
        if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        update.campaignId = campaign.id;
      } else {
        update.campaignId = null;
      }
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 });
    if (update.status === 'scheduled' && update.scheduledAt === undefined && !existing.scheduledAt) return NextResponse.json({ error: 'A schedule date is required for scheduled content' }, { status: 400 });

    const content = await db.content.update({ where: { id }, data: update });
    return NextResponse.json({ content });
  } catch (error) {
    console.error('[PATCH /api/content/[id]]', error);
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const result = await db.content.deleteMany({ where: { id, companyId: actor.companyId } });
    if (result.count === 0) return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/content/[id]]', error);
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
  }
}
