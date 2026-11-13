/**
 * GET /api/v1/integrations/merlinstacks — list all 4 MerlinStacks services + connection status
 * POST /api/v1/integrations/merlinstacks — create/update a connection
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import {
  MERLINSTACKS_SERVICES,
  getConnectionSummary,
  upsertConnection,
  getService,
} from '@/lib/merlinstacks-adapters';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const services = await getConnectionSummary(ctx.companyId);
  return ok({ services, catalog: MERLINSTACKS_SERVICES });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const body = await request.json().catch(() => null);
  if (!body?.serviceSlug || !body?.baseUrl) {
    return badRequest('serviceSlug and baseUrl are required');
  }
  const service = getService(body.serviceSlug);
  if (!service) {
    return badRequest(`Unknown service. Available: ${MERLINSTACKS_SERVICES.map(s => s.slug).join(', ')}`);
  }
  const connection = await upsertConnection(ctx.companyId, body.serviceSlug, {
    baseUrl: body.baseUrl,
    apiKey: body.apiKey,
    apiSecret: body.apiSecret,
    metadata: body.metadata,
  });
  return ok({ connection });
}
