/**
 * GET /api/v1/data-providers — list the free-first data provider registry
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { listDataProviders } from '@/lib/data-providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const providers = await listDataProviders({
    companyId: ctx.companyId,
    category: url.searchParams.get('category') || undefined,
    integrationStatus: url.searchParams.get('integrationStatus') || undefined,
  });
  return ok({ providers });
}
