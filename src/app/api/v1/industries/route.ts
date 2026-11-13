/**
 * GET /api/v1/industries — list industry taxonomy (global + tenant-custom)
 * POST /api/v1/industries — add a custom industry (tenant-scoped)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { listIndustryTree, addCustomIndustry } from '@/lib/industry-taxonomy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const tree = await listIndustryTree(ctx.companyId);
  return ok({ industries: tree });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const body = await request.json().catch(() => null);
  if (!body?.name) return badRequest('name is required');
  const industry = await addCustomIndustry(ctx.companyId, body.name, body.parentId, body.description);
  return ok({ industry });
}
