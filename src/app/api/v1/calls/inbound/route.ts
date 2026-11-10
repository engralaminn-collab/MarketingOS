// POST /api/v1/calls/inbound — receive an inbound call notification
// Called by telephony gateway (FreeSWITCH/Twilio) when a call arrives
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { transitionCall } from '@/lib/telephony-adapter';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.from || !body?.to) return badRequest('from and to are required');

  // Create call record
  const call = await db.call.create({
    data: {
      companyId: ctx.companyId,
      direction: 'inbound',
      fromNumber: body.from,
      toNumber: body.to,
      fromName: body.fromName || null,
      status: 'ringing',
      phoneNumberId: body.phoneNumberId || null,
    },
  });

  await db.callEvent.create({
    data: { callId: call.id, toStatus: 'ringing', actorType: 'caller' },
  });

  await emitEvent({
    type: 'call.inbound_received',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'call',
    resourceId: call.id,
    metadata: { from: body.from, to: body.to },
  });

  return ok({ callId: call.id, status: 'ringing', message: 'Inbound call received. Use POST /api/v1/calls/{id}/answer to connect an agent.' });
}
