/**
 * GET /api/v1/approvals — list pending approval requests
 * POST /api/v1/approvals — create an approval request
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { requestApproval, listPendingApprovals } from '@/lib/approval-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const requestType = url.searchParams.get('requestType') as any || undefined;
  const requests = await listPendingApprovals(ctx.companyId, requestType);
  return ok({ approvalRequests: requests });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.requestType || !body?.action) {
    return badRequest('requestType and action are required');
  }
  const result = await requestApproval(ctx.companyId, {
    ...body,
    requesterId: ctx.userId,
  });
  return ok(result);
}
