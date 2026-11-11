// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.amount || !body?.provider) return badRequest('amount and provider are required');
  const payment = await db.payment.create({ data: { companyId: ctx.companyId, invoiceId: body.invoiceId || null, amount: body.amount, currency: body.currency || 'USD', provider: body.provider, providerPaymentId: body.providerPaymentId || null, method: body.method || 'card', status: 'pending', createdBy: ctx.userId } });
  await emitEvent({ type: 'payment.created', companyId: ctx.companyId, userId: ctx.userId, resource: 'payment', resourceId: payment.id, metadata: { amount: body.amount, provider: body.provider } });
  return ok(payment);
}
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const payments = await db.payment.findMany({ where: { companyId: ctx.companyId }, orderBy: { createdAt: 'desc' }, take: 100 });
  return ok({ payments });
}
