// GET/POST /api/v1/suppression-list — DNC (Do Not Call) management
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const entries = await db.suppressionList.findMany({ where: { companyId: ctx.companyId }, orderBy: { blockedAt: 'desc' }, take: 200 });
  return ok({ entries });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.phoneNumber) return badRequest('phoneNumber is required');

  const entry = await db.suppressionList.upsert({
    where: { companyId_phoneNumber: { companyId: ctx.companyId, phoneNumber: body.phoneNumber } },
    update: { reason: body.reason || 'user_request', source: body.source || 'api' },
    create: { companyId: ctx.companyId, phoneNumber: body.phoneNumber, reason: body.reason || 'user_request', source: body.source || 'api', createdBy: ctx.userId },
  });
  return ok(entry);
}
