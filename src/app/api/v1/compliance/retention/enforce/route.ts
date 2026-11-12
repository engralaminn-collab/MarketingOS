/**
 * POST /api/v1/compliance/retention/enforce — enforce retention policies (delete/anonymize expired data)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok, forbidden } from '@/lib/v1-middleware';
import { enforceRetention } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user' || ctx.role === 'team_member') {
    return forbidden('Insufficient role');
  }
  const result = await enforceRetention(ctx.companyId);
  return ok(result);
}
