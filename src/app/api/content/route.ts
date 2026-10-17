import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.companyId || !payload.userId) return null;
  return { companyId: payload.companyId, userId: payload.userId, role: payload.role };
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(req.url).searchParams;
    const type = params.get('type');
    const status = params.get('status');
    const where: Record<string, unknown> = { companyId: actor.companyId };
    if (type && type !== 'all' && type.length <= 64) where.type = type;
    if (status && status !== 'all' && ['draft', 'scheduled', 'published', 'archived'].includes(status)) where.status = status;

    const content = await db.content.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('[GET /api/content]', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON request body is required' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const allowedStatuses = ['draft', 'scheduled', 'published'];
    const status = typeof body.status === 'string' && allowedStatuses.includes(body.status) ? body.status : 'draft';
    if (!title || title.length > 180) return NextResponse.json({ error: 'Title is required and must be 180 characters or fewer' }, { status: 400 });
    if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(type)) return NextResponse.json({ error: 'Content type is invalid' }, { status: 400 });

    const bodyText = body.body === undefined || body.body === null ? null : typeof body.body === 'string' ? body.body : null;
    if (body.body !== undefined && body.body !== null && typeof body.body !== 'string') {
      return NextResponse.json({ error: 'Content body must be text' }, { status: 400 });
    }
    if ((bodyText?.length || 0) > 100_000) return NextResponse.json({ error: 'Content body exceeds 100 KB' }, { status: 400 });

    const scheduledValue = body.scheduledAt ?? body.scheduledDate;
    const scheduledAt = parseDate(scheduledValue);
    if (scheduledAt === undefined) return NextResponse.json({ error: 'Schedule date is invalid' }, { status: 400 });
    if (status === 'scheduled' && !scheduledAt) return NextResponse.json({ error: 'A schedule date is required for scheduled content' }, { status: 400 });

    let campaignId: string | null = null;
    if (body.campaignId !== undefined && body.campaignId !== null && body.campaignId !== '') {
      if (typeof body.campaignId !== 'string' || body.campaignId.length > 64) return NextResponse.json({ error: 'Campaign ID is invalid' }, { status: 400 });
      const campaign = await db.campaign.findFirst({ where: { id: body.campaignId, companyId: actor.companyId }, select: { id: true } });
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      campaignId = campaign.id;
    }

    const platform = typeof body.platform === 'string' && body.platform.trim() ? body.platform.trim().slice(0, 64) : null;
    const safeUrlField = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim().slice(0, 2_048) : null;
    const content = await db.content.create({
      data: {
        title,
        type,
        status,
        platform,
        body: bodyText,
        mediaUrl: safeUrlField(body.mediaUrl),
        mediaType: typeof body.mediaType === 'string' ? body.mediaType.trim().slice(0, 64) || null : null,
        thumbnailUrl: safeUrlField(body.thumbnailUrl),
        hashtags: typeof body.hashtags === 'string' ? body.hashtags.slice(0, 2_000) : null,
        scheduledAt: scheduledAt ?? null,
        publishedAt: status === 'published' ? new Date() : null,
        engagement: '{}',
        aiGenerated: false,
        creatorId: actor.userId,
        companyId: actor.companyId,
        campaignId,
      },
    });

    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: content.status === 'published' ? 'content.published' : 'content.created',
      title: content.status === 'published' ? 'Content marked published' : 'New content created',
      description: `"${content.title}" (${content.type}${content.platform ? ', ' + content.platform : ''})`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { title: content.title, type: content.type, platform: content.platform, status: content.status },
    });

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/content]', error);
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
  }
}
