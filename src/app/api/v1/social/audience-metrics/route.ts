/**
 * GET /api/v1/social/audience-metrics — list social audience metrics
 * POST /api/v1/social/audience-metrics — record a metrics snapshot
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
  const metrics = await db.socialAudienceMetric.findMany({
    where: { companyId: ctx.companyId, ...(platform ? { platform } : {}) },
    orderBy: { recordedAt: 'desc' },
    take: 100,
  });
  return ok({ metrics });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.platform || body?.followersCount === undefined) {
    return badRequest('platform and followersCount are required');
  }
  const metric = await db.socialAudienceMetric.create({
    data: {
      socialAccountId: body.socialAccountId || 'unknown',
      platform: body.platform,
      followersCount: body.followersCount,
      followingCount: body.followingCount || null,
      postsCount: body.postsCount || null,
      engagementRate: body.engagementRate || null,
      avgLikesPerPost: body.avgLikesPerPost || null,
      avgCommentsPerPost: body.avgCommentsPerPost || null,
      growthDelta: body.growthDelta || 0,
      topHashtags: body.topHashtags ? JSON.stringify(body.topHashtags) : null,
      bestPostingTime: body.bestPostingTime || null,
      companyId: ctx.companyId,
    },
  });
  return ok({ metric });
}
