/**
 * POST /api/v1/leads/discover — record a discovered lead with full provenance
 * GET /api/v1/leads/discover — list discovered leads
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { recordDiscoveredLead, listDiscoveredLeads } from '@/lib/lead-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const leads = await listDiscoveredLeads(ctx.companyId, {
    campaignId: url.searchParams.get('campaignId') || undefined,
    reviewStatus: url.searchParams.get('reviewStatus') || undefined,
    minScore: url.searchParams.get('minScore') ? parseInt(url.searchParams.get('minScore')!) : undefined,
    limit: parseInt(url.searchParams.get('limit') || '50'),
  });
  return ok({ discoveredLeads: leads });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.businessName || !body?.sourceUrl) {
    return badRequest('businessName and sourceUrl are required (source provenance is mandatory).');
  }
  const result = await recordDiscoveredLead(ctx.companyId, body);
  return ok(result);
}
