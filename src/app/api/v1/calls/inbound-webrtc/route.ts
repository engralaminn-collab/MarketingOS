/**
 * POST /api/v1/calls/inbound-webrtc
 *
 * Start an inbound WebRTC call session via LiveKit.
 * Customer connects via browser → LiveKit room → AI agent.
 *
 * Per directive §7 + §9: "Website WebRTC calling works"
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { startInboundWebRTCCall } from '@/lib/livekit-adapter';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.customerIdentity) return badRequest('customerIdentity is required');

  const call = await db.call.create({
    data: {
      companyId: ctx.companyId,
      direction: 'inbound',
      fromNumber: body.customerIdentity,
      toNumber: 'webrtc',
      status: 'ringing',
      agentId: body.agentId || null,
    },
  });

  const result = await startInboundWebRTCCall({
    callId: call.id,
    tenantId: ctx.companyId,
    customerIdentity: body.customerIdentity,
    agentId: body.agentId,
  });

  await db.callEvent.create({
    data: {
      callId: call.id,
      toStatus: 'active',
      actorType: 'system',
      metadata: JSON.stringify({ roomName: result.roomName, webrtc: true }),
    },
  });

  await emitEvent({
    type: 'call.webrtc_started',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'call',
    resourceId: call.id,
    metadata: { roomName: result.roomName, simulated: result.simulated },
  });

  return ok({
    callId: call.id,
    roomName: result.roomName,
    token: result.participantToken,
    url: result.url,
    simulated: result.simulated,
    message: result.simulated
      ? 'LiveKit not configured. Set LIVEKIT_URL + LIVEKIT_API_KEY + LIVEKIT_API_SECRET.'
      : 'WebRTC call started. Connect to LiveKit room using the token.',
  });
}
