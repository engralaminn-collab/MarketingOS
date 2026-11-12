/**
 * GET /api/v1/discovery/opportunities — list market opportunities (Mode A output)
 * POST /api/v1/discovery/opportunities — record a market opportunity with evidence
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { listMarketOpportunities, recordMarketOpportunity } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const opportunities = await listMarketOpportunities(ctx.companyId, {
    opportunityType: url.searchParams.get('opportunityType') || undefined,
    industryId: url.searchParams.get('industryId') || undefined,
    minConfidence: url.searchParams.get('minConfidence') || undefined,
    limit: parseInt(url.searchParams.get('limit') || '50'),
  });
  return ok({ opportunities });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.evidence || body.evidence.length === 0) {
    return badRequest('title and at least one evidence snippet are required — no invented data.');
  }
  const opportunity = await recordMarketOpportunity(ctx.companyId, body);
  return ok({ opportunity });
}
