/**
 * GET /api/v1/cost/summary — cost intelligence dashboard (USD, free-first tracking)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { getCostSummary } from '@/lib/cost-intelligence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  const summary = await getCostSummary(ctx.companyId, days);
  return ok(summary);
}
