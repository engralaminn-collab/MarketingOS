/**
 * POST /api/v1/leads/[id]/verify-contact — verify contact permission (consent + DNC + opt-out)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';
import { verifyContactPermission } from '@/lib/lead-discovery';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const lead = await db.lead.findFirst({ where: { id, companyId: ctx.companyId }, select: { id: true } });
  if (!lead) return notFound('Lead not found');
  const result = await verifyContactPermission(id, ctx.companyId);
  return ok(result);
}
