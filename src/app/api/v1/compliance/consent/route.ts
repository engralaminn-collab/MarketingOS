/**
 * GET /api/v1/compliance/consent — list consent records
 * POST /api/v1/compliance/consent — capture consent
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { captureConsent } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const consents = await db.consent.findMany({
    where: { companyId: ctx.companyId, ...(url.searchParams.get('subjectId') ? { subjectId: url.searchParams.get('subjectId')! } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok({ consents });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.subjectId || !body?.kind || !body?.method) {
    return badRequest('subjectId, kind, and method are required');
  }
  const consent = await captureConsent({ ...body, companyId: ctx.companyId, capturedBy: ctx.userId });
  return ok({ consent });
}
