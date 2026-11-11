/**
 * POST /api/v1/webhooks/delivery
 * Delivery webhook — order/delivery events that trigger follow-up calls.
 * Per directive §10: "Receive an authenticated delivery-completed webhook."
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const eventType = body.event || body.type;
  const tenantId = body.tenant_id || body.companyId;
  const orderId = body.order_id || body.orderId;
  const customerPhone = body.customer_phone || body.phone;

  if (!tenantId || !orderId) return NextResponse.json({ error: 'tenant_id and order_id required' }, { status: 400 });

  switch (eventType) {
    case 'delivery.completed':
      if (customerPhone) {
        const existing = await db.call.findFirst({ where: { companyId: tenantId, fromNumber: customerPhone, outcome: 'delivery_followup' } }).catch(() => null);
        if (!existing) {
          const call = await db.call.create({ data: { companyId: tenantId, direction: 'outbound', fromNumber: 'system', toNumber: customerPhone, status: 'ringing', outcome: 'delivery_followup' } }).catch(() => null);
          if (call) await emitEvent({ type: 'delivery.followup_scheduled', companyId: tenantId, resource: 'call', resourceId: call.id, metadata: { orderId, customerPhone } });
        }
      }
      break;
    case 'delivery.failed':
      await emitEvent({ type: 'delivery.failed', companyId: tenantId, resource: 'order', resourceId: orderId, metadata: { status: body.delivery_status || body.status } });
      break;
  }

  await emitEvent({ type: 'webhook.delivery', companyId: tenantId, resource: 'order', resourceId: orderId, metadata: { eventType, orderId } });
  return NextResponse.json({ ok: true, event: eventType, orderId });
}
