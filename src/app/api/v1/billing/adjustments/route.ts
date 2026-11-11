// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required for billing adjustments');
  const body = await request.json().catch(() => null);
  if (!body?.amount || !body?.reason) return badRequest('amount and reason are required');
  const adj = await db.billingAdjustment.create({ data: { companyId: ctx.companyId, type: body.type || 'credit', amount: body.amount, currency: 'USD', reason: body.reason, invoiceId: body.invoiceId || null, createdBy: ctx.userId } });
  await emitEvent({ type: 'billing.adjustment', companyId: ctx.companyId, userId: ctx.userId, resource: 'billing_adjustment', resourceId: adj.id, metadata: { type: body.type, amount: body.amount } });
  return ok(adj);
}
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const adjustments = await db.billingAdjustment.findMany({ where: { companyId: ctx.companyId }, orderBy: { createdAt: 'desc' }, take: 100 });
  return ok({ adjustments });
}
