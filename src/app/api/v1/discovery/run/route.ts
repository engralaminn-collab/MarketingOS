/**
 * POST /api/v1/discovery/run — run universal discovery (Mode A)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { runUniversalDiscovery } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const result = await runUniversalDiscovery(ctx.companyId, {
    industryIds: body.industryIds,
    countryIds: body.countryIds,
    campaignId: body.campaignId,
  });
  return ok(result);
}
