/**
 * GET /api/v1/leads/[id]/score — get explainable lead score breakdown
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';
import { getLeadScoreBreakdown } from '@/lib/buyer-intent';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  // Verify tenant ownership
  const lead = await db.lead.findFirst({ where: { id, companyId: ctx.companyId }, select: { id: true } });
  if (!lead) return notFound('Lead not found');
  const breakdown = await getLeadScoreBreakdown(id);
  return ok(breakdown);
}
