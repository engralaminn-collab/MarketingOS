/**
 * GET /api/v1/compliance/summary — compliance dashboard summary
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { getComplianceSummary } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const summary = await getComplianceSummary(ctx.companyId);
  return ok(summary);
}
