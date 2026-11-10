/**
 * POST /api/v1/webhooks/livekit
 * LiveKit webhook handler — verifies signature + processes room/participant events.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/livekit-adapter';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const authHeader = request.headers.get('authorization') || '';
  const event = verifyWebhook(body, authHeader);
  if (!event) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  const eventType = event.event || event.type;
  const roomName = event.room?.name || '';
  const participant = event.participant?.identity || '';
  const callId = roomName.replace('call-', '');

  switch (eventType) {
    case 'participant_joined':
      if (participant.startsWith('agent-')) {
        await db.call.updateMany({ where: { id: callId, status: 'ringing' }, data: { status: 'active', answeredAt: new Date() } }).catch(() => {});
      }
      break;
    case 'room_finished':
      await db.call.updateMany({ where: { id: callId, status: { in: ['active', 'ringing', 'hold'] } }, data: { status: 'closed', endedAt: new Date() } }).catch(() => {});
      break;
  }

  await emitEvent({ type: 'livekit.webhook', companyId: '', resource: 'call', resourceId: callId, metadata: { eventType, roomName, participant } });
  return NextResponse.json({ ok: true, event: eventType });
}
