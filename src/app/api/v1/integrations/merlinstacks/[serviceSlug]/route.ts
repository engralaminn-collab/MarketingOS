/**
 * DELETE /api/v1/integrations/merlinstacks/[serviceSlug] — remove a connection
 * GET /api/v1/integrations/merlinstacks/[serviceSlug] — get connection details
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok, forbidden, badRequest } from '@/lib/v1-middleware';
import { removeConnection, getConnection, getService, MERLINSTACKS_SERVICES } from '@/lib/merlinstacks-adapters';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ serviceSlug: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { serviceSlug } = await params;
  const service = getService(serviceSlug);
  if (!service) return badRequest(`Unknown service: ${serviceSlug}`);
  const connection = await getConnection(ctx.companyId, serviceSlug);
  if (!connection) return notFound('Connection not found');
  return ok({ service, connection: { ...connection, apiKey: connection.apiKey ? '[REDACTED]' : null, apiSecret: '[REDACTED]' } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ serviceSlug: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const { serviceSlug } = await params;
  const service = getService(serviceSlug);
  if (!service) return badRequest(`Unknown service: ${serviceSlug}`);
  await removeConnection(ctx.companyId, serviceSlug);
  return ok({ removed: true });
}
