/**
 * POST /api/v1/compliance/opt-out — process an opt-out request (DNC + revoke consent)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { processOptOut } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.leadId && !body?.phoneNumber) {
    return badRequest('leadId or phoneNumber is required');
  }
  const result = await processOptOut({
    companyId: ctx.companyId,
    leadId: body.leadId,
    phoneNumber: body.phoneNumber,
    reason: body.reason,
    source: body.source,
  });
  return ok(result);
}
