// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { originateCall } from '@/lib/telephony-adapter';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.to || !body?.from) return badRequest('to and from are required');
  const result = await originateCall({ companyId: ctx.companyId, direction: 'outbound', from: body.from, to: body.to, agentId: body.agentId, humanAgentId: body.humanAgentId, metadata: { userId: ctx.userId, ...body.metadata } });
  return ok(result);
}
