// POST /api/v1/outbound-campaigns/{id}/approve
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, notFound, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin approval required for campaigns');

  const { id } = await params;
  const campaign = await db.outboundCampaign.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!campaign) return notFound('campaign not found');

  await db.outboundCampaign.update({ where: { id }, data: { status: 'approved' } });
  await emitEvent({ type: 'campaign.approved', companyId: ctx.companyId, userId: ctx.userId, resource: 'outbound_campaign', resourceId: id });
  return ok({ id, status: 'approved' });
}
