// POST /api/v1/outbound-campaigns/{id}/resume
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const campaign = await db.outboundCampaign.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!campaign) return notFound('campaign not found');

  await db.outboundCampaign.update({ where: { id }, data: { status: 'running' } });
  await emitEvent({ type: 'campaign.resumed', companyId: ctx.companyId, userId: ctx.userId, resource: 'outbound_campaign', resourceId: id });
  return ok({ id, status: 'running' });
}
