// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const integrations = await db.integration.findMany({
    where: { companyId: ctx.companyId },
    include: { secrets: true, resources: true, scopes: true, _count: { select: { healthChecks: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return ok({ integrations });
}
