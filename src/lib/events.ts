import { createHmac, randomBytes } from 'node:crypto';
import { db } from './db';
import { decryptSecret, isEncryptedSecret } from './credentials';
import { SafeFetchError, safeFetchText } from './ssrf';

export interface EventPayload {
  companyId: string;
  userId?: string | null;
  type: string;
  title: string;
  description: string;
  resourceType?: string;
  resourceId?: string;
  link?: string;
  recipientIds?: string[];
  metadata?: Record<string, unknown>;
}

export async function emitEvent(payload: EventPayload): Promise<void> {
  try {
    const {
      companyId,
      userId,
      type,
      title,
      description,
      resourceType,
      resourceId,
      link,
      recipientIds,
      metadata = {},
    } = payload;

    let recipients: string[] = recipientIds || [];
    if (recipients.length === 0) {
      const members = await db.companyUser.findMany({ where: { companyId }, select: { userId: true } });
      recipients = members.map((member) => member.userId);
    }

    const notificationData = recipients.filter((id) => id !== userId).map((recipientId) => ({
      userId: recipientId,
      type,
      title,
      message: description,
      link: link || null,
      metadata: JSON.stringify(metadata),
    }));
    if (notificationData.length > 0) {
      await db.notification.createMany({ data: notificationData }).catch((error) =>
        console.error('[emitEvent] notification createMany failed:', error),
      );
    }

    await db.auditLog.create({
      data: {
        action: type,
        resource: resourceType || 'unknown',
        resourceId: resourceId || null,
        details: description,
        userId: userId || null,
        companyId,
      },
    }).catch((error) => console.error('[emitEvent] auditLog create failed:', error));

    await db.activity.create({
      data: {
        companyId,
        userId: userId || null,
        type,
        description,
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        metadata: JSON.stringify(metadata),
      },
    }).catch((error) => console.error('[emitEvent] activity create failed:', error));

    void fireWebhooksForCompany(companyId, type, {
      id: randomBytes(16).toString('hex'),
      type,
      title,
      description,
      resourceType,
      resourceId,
      metadata,
      companyId,
      actorUserId: userId,
      timestamp: new Date().toISOString(),
    }).catch((error) => console.error('[emitEvent] webhook dispatch failed:', error));
  } catch (error) {
    console.error('[emitEvent] overall failure:', error);
  }
}

export function computeWebhookSignature(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

async function fireWebhooksForCompany(
  companyId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const webhooks = await db.webhook.findMany({ where: { companyId, status: 'active' } }).catch(() => []);
  if (webhooks.length === 0) return;

  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return;
  }
  if (Buffer.byteLength(body, 'utf8') > 256 * 1024) {
    await Promise.all(webhooks.map((webhook) => recordDeliveryFailure(webhook.id, 'Webhook payload exceeds the 256 KB limit')));
    return;
  }

  await Promise.all(webhooks.map(async (webhook) => {
    let subscribedEvents: unknown;
    try {
      subscribedEvents = JSON.parse(webhook.events || '[]');
    } catch {
      subscribedEvents = [];
    }
    if (Array.isArray(subscribedEvents) && subscribedEvents.length > 0 && !subscribedEvents.includes(eventType)) return;
    if (!webhook.secret) {
      await recordDeliveryFailure(webhook.id, 'Signing secret is missing');
      return;
    }

    try {
      if (new URL(webhook.url).protocol !== 'https:') {
        await recordDeliveryFailure(webhook.id, 'Webhook destinations must use HTTPS');
        return;
      }
      const signingSecret = isEncryptedSecret(webhook.secret) ? decryptSecret(webhook.secret) : webhook.secret;
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = computeWebhookSignature(signingSecret, timestamp, body);
      const response = await safeFetchText(webhook.url, {
        method: 'POST',
        timeoutMs: 10_000,
        maxResponseBytes: 64 * 1024,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, */*',
          'x-marketingos-event': eventType,
          'x-marketingos-event-id': String(payload.id || ''),
          'x-marketingos-timestamp': String(timestamp),
          'x-marketingos-signature': `t=${timestamp},v1=${signature}`,
        },
        body,
      });

      if (!response.ok) {
        await recordDeliveryFailure(webhook.id, `Endpoint returned HTTP ${response.status}`, response.status);
        console.warn(`[webhook] event ${eventType} failed with HTTP ${response.status}`);
        return;
      }
      await db.webhook.update({
        where: { id: webhook.id },
        data: {
          deliveryCount: { increment: 1 },
          lastDeliveredAt: new Date(),
          lastDeliveryStatus: response.status,
          lastDeliveryError: null,
        },
      }).catch((error) => console.error('[webhook] could not record successful delivery:', error));
    } catch (error) {
      const message = error instanceof SafeFetchError
        ? safeDeliveryError(error)
        : 'Network delivery failed';
      await recordDeliveryFailure(webhook.id, message);
      console.warn(`[webhook] event ${eventType} delivery failed: ${message}`);
    }
  }));
}

async function recordDeliveryFailure(webhookId: string, error: string, status?: number): Promise<void> {
  await db.webhook.update({
    where: { id: webhookId },
    data: {
      failureCount: { increment: 1 },
      lastDeliveryStatus: status ?? null,
      lastDeliveryError: error.slice(0, 500),
    },
  }).catch((updateError) => console.error('[webhook] could not record failed delivery:', updateError));
}

function safeDeliveryError(error: SafeFetchError): string {
  switch (error.code) {
    case 'SSRF_BLOCKED': return 'Blocked unsafe webhook destination';
    case 'TIMEOUT': return 'Webhook delivery timed out';
    case 'TOO_LARGE': return 'Webhook payload or response exceeded the configured size limit';
    case 'REDIRECT': return 'Webhook redirects are not followed';
    default: return 'Network delivery failed';
  }
}
