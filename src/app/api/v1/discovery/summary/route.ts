/**
 * GET /api/v1/discovery/summary — discovery dashboard summary
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { getDiscoverySummary } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const summary = await getDiscoverySummary(ctx.companyId);
  return ok(summary);
}
