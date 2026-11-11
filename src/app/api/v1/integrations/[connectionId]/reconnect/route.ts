// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok, forbidden } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { connectionId } = await params;
  const integration = await db.integration.findFirst({ where: { id: connectionId, companyId: ctx.companyId } });
  if (!integration) return notFound('integration not found');

  // Generate new OAuth state for reconnection
  const { generateStateToken } = await import('@/lib/pkce');
  const stateToken = generateStateToken();
  await db.integration.update({
    where: { id: connectionId },
    data: { status: 'pending', currentStateId: stateToken },
  });
  await emitEvent({ type: 'integration.reconnect_requested', companyId: ctx.companyId, userId: ctx.userId, resource: 'integration', resourceId: connectionId });
  return ok({ connectionId, status: 'pending', message: 'Reconnection initiated. Use POST /api/v1/integrations/{provider}/authorize to get a new authorization URL.' });
}
