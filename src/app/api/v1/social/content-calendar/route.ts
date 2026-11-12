/**
 * GET /api/v1/social/content-calendar — list content calendar items
 * POST /api/v1/social/content-calendar — create a calendar item
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');
  const items = await db.contentCalendarItem.findMany({
    where: { companyId: ctx.companyId, ...(platform ? { platform } : {}) },
    orderBy: { scheduledAt: 'asc' },
    take: 100,
  });
  return ok({ items });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.platform || !body?.scheduledAt || !body?.title) {
    return badRequest('platform, scheduledAt, and title are required');
  }
  const item = await db.contentCalendarItem.create({
    data: {
      platform: body.platform,
      scheduledAt: new Date(body.scheduledAt),
      title: body.title,
      contentId: body.contentId || null,
      status: body.status || 'draft',
      aiGenerated: body.aiGenerated || false,
      hashtags: body.hashtags ? JSON.stringify(body.hashtags) : null,
      approvalRequired: body.approvalRequired !== false,
      companyId: ctx.companyId,
    },
  });
  return ok({ item });
}
