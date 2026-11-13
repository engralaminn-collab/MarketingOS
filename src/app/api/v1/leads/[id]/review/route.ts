/**
 * POST /api/v1/leads/[id]/review — review a discovered lead (human-in-the-loop)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, badRequest, ok } from '@/lib/v1-middleware';
import { reviewDiscoveredLead } from '@/lib/lead-discovery';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.reviewStatus || !['reviewed', 'approved', 'rejected'].includes(body.reviewStatus)) {
    return badRequest('reviewStatus must be reviewed|approved|rejected');
  }
  // Find the discovered lead by leadId
  const dl = await db.discoveredLead.findFirst({ where: { leadId: id, companyId: ctx.companyId } });
  if (!dl) return notFound('Discovered lead not found for this lead');
  const result = await reviewDiscoveredLead(dl.id, ctx.companyId, body.reviewStatus, body.note);
  return ok(result);
}
