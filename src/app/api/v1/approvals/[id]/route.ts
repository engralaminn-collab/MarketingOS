/**
 * POST /api/v1/approvals/[id]/approve — approve a request
 * POST /api/v1/approvals/[id]/reject — reject a request
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, notFound, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { approveRequest, rejectRequest } from '@/lib/approval-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  // Only admins/managers can approve
  if (ctx.role === 'viewer' || ctx.role === 'client_user' || ctx.role === 'team_member') {
    return forbidden('Insufficient role to approve/reject');
  }
  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'approve';
  const body = await request.json().catch(() => ({}));
  try {
    if (action === 'reject') {
      const result = await rejectRequest(id, ctx.userId, body.note);
      return ok(result);
    } else {
      const result = await approveRequest(id, ctx.userId, body.note);
      return ok(result);
    }
  } catch (err: any) {
    return badRequest(err.message || 'Approval action failed');
  }
}
