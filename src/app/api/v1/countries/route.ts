/**
 * GET /api/v1/countries — list country reference data (with privacy-law guidance)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { listCountries } from '@/lib/industry-taxonomy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const region = url.searchParams.get('region') || undefined;
  const countries = await listCountries(region);
  return ok({ countries });
}
