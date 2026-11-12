/**
 * GET /api/v1/discovery/campaigns — list discovery campaigns (Mode A + Mode B)
 * POST /api/v1/discovery/campaigns — create a discovery campaign
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { createDiscoveryCampaign, listDiscoveryCampaigns } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const campaigns = await listDiscoveryCampaigns(ctx.companyId, status);
  return ok({ campaigns });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.mode) return badRequest('name and mode (universal|targeted) are required');
  const campaign = await createDiscoveryCampaign(ctx.companyId, body);
  return ok({ campaign });
}
