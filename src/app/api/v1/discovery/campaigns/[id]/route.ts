/**
 * GET /api/v1/discovery/campaigns/[id] — get a campaign
 * PATCH /api/v1/discovery/campaigns/[id] — update campaign status
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok, forbidden } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const campaign = await db.discoveryCampaign.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!campaign) return notFound('Campaign not found');
  return ok({ campaign });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const updated = await db.discoveryCampaign.updateMany({
    where: { id, companyId: ctx.companyId },
    data: { ...(body?.status ? { status: body.status } : {}), ...(body?.autonomyLevel ? { autonomyLevel: body.autonomyLevel } : {}) },
  });
  if (updated.count === 0) return notFound('Campaign not found');
  return ok({ updated: true });
}
