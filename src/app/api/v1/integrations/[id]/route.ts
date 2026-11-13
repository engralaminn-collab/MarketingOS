// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const integration = await db.integration.findFirst({ where: { id: connectionId, companyId: ctx.companyId } });
  if (!integration) return notFound('integration not found');

  // Delete all related data (secrets, resources, logs, scopes, health checks)
  await db.integrationSecret.deleteMany({ where: { integrationId: connectionId } });
  await db.integrationResource.deleteMany({ where: { integrationId: connectionId } });
  await db.integrationLog.deleteMany({ where: { integrationId: connectionId } });
  await db.integrationScope.deleteMany({ where: { integrationId: connectionId } });
  await db.integrationHealthCheck.deleteMany({ where: { integrationId: connectionId } });
  await db.integration.delete({ where: { id: connectionId } });

  await emitEvent({ type: 'integration.disconnected', companyId: ctx.companyId, userId: ctx.userId, resource: 'integration', resourceId: connectionId, metadata: { provider: integration.provider } });
  return ok({ deleted: true, connectionId, provider: integration.provider });
}
