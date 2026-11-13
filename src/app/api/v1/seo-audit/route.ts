/**
 * GET /api/v1/seo-audit — list website audits
 * POST /api/v1/seo-audit — run a real SEO audit on a URL
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { auditWebsite, listWebsiteAudits } from '@/lib/seo-audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const audits = await listWebsiteAudits(ctx.companyId, limit);
  return ok({ audits });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.url) return badRequest('url is required');
  try {
    const result = await auditWebsite(ctx.companyId, body.url);
    return ok(result);
  } catch (err: any) {
    return badRequest(err.message || 'SEO audit failed');
  }
}
