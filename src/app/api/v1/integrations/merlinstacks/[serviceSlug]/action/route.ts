/**
 * POST /api/v1/integrations/merlinstacks/[serviceSlug]/action — call a service-specific action
 * Body: { action: string, params?: object }
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { adapters, getService } from '@/lib/merlinstacks-adapters';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ serviceSlug: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { serviceSlug } = await params;
  const service = getService(serviceSlug);
  if (!service) return badRequest(`Unknown service: ${serviceSlug}`);
  const adapter = adapters[serviceSlug];
  if (!adapter) return badRequest('No adapter for this service');
  const body = await request.json().catch(() => null);
  if (!body?.action) return badRequest('action is required');
  const fn = (adapter as any)[body.action];
  if (typeof fn !== 'function') {
    return badRequest(`Unknown action: ${body.action}. Available: ${Object.keys(adapter).filter(k => typeof (adapter as any)[k] === 'function').join(', ')}`);
  }
  const result = await fn(ctx.companyId, body.params || {});
  return ok(result);
}
