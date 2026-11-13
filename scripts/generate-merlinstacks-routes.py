#!/usr/bin/env python3
"""Generate API routes for MerlinStacks integration."""
import os

ROUTES_DIR = '/home/z/my-project/src/app/api/v1/integrations/merlinstacks'
ROUTES = []

# ── Main route: list services + create/remove connections ──────────────────
ROUTES.append(('route.ts', '''/**
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
'''))

# ── Per-service route: test connection + call actions ──────────────────────
ROUTES.append(('[serviceSlug]/route.ts', '''/**
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
'''))

# ── Test connection ────────────────────────────────────────────────────────
ROUTES.append(('[serviceSlug]/test/route.ts', '''/**
 * POST /api/v1/integrations/merlinstacks/[serviceSlug]/test — test a service connection
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, notFound, ok, badRequest } from '@/lib/v1-middleware';
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
  const result = await adapter.testConnection(ctx.companyId);
  return ok(result);
}
'''))

# ── SocaliseIt actions ─────────────────────────────────────────────────────
ROUTES.append(('[serviceSlug]/action/route.ts', '''/**
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
'''))

for rel_path, content in ROUTES:
    full_path = os.path.join(ROUTES_DIR, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w') as f:
        f.write(content)
    print(f"  ✓ {rel_path}")

print(f"\\n✅ Generated {len(ROUTES)} MerlinStacks API route files")
