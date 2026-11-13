/**
 * GET /api/v1/compliance/retention — list retention policies
 * POST /api/v1/compliance/retention — set a retention policy
 * POST /api/v1/compliance/retention/enforce — enforce retention (delete/anonymize expired data)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { setRetentionPolicy, enforceRetention } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const policies = await db.dataRetentionPolicy.findMany({ where: { companyId: ctx.companyId } });
  return ok({ policies });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const body = await request.json().catch(() => null);
  if (!body?.dataType || body?.retentionDays === undefined) {
    return badRequest('dataType and retentionDays are required');
  }
  const policy = await setRetentionPolicy({
    companyId: ctx.companyId,
    dataType: body.dataType,
    retentionDays: body.retentionDays,
    deletionAction: body.deletionAction,
  });
  return ok({ policy });
}
