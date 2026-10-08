/**
 * Event bus — central place to fire notifications, audit logs, activities, and webhooks.
 *
 * Every CRUD action in the app should call `emitEvent(...)` so the system can:
 *   1. Create a Notification for the relevant user(s)
 *   2. Write an AuditLog row
 *   3. Write an Activity row (for the company-wide activity feed)
 *   4. Fire any registered Webhooks (HTTP POST to external URLs)
 *
 * Inspired by Chatwoot's event bus, Frappe's webhook system, and OroCRM's audit trail.
 */
import { db } from './db';

export interface EventPayload {
  /** Company this event belongs to */
  companyId: string;
  /** User who triggered the event (null for system-generated events) */
  userId?: string | null;
  /** Event type — dot-namespaced, e.g. "lead.created", "deal.won", "ticket.assigned" */
  type: string;
  /** Human-readable title for notifications */
  title: string;
  /** Longer description for activity feed + audit log */
  description: string;
  /** Resource type: lead | deal | contact | ticket | campaign | content | ... */
  resourceType?: string;
  /** Resource ID for deep-linking */
  resourceId?: string;
  /** Frontend route to navigate to when notification is clicked */
  link?: string;
  /** Recipient user IDs (defaults to all company users if empty) */
  recipientIds?: string[];
  /** Extra metadata as JSON */
  metadata?: Record<string, any>;
}

/**
 * Emit a single event. Performs all four side-effects:
 * 1. Notification for each recipient
 * 2. AuditLog row
 * 3. Activity row
 * 4. Webhook fire (async, fire-and-forget — does not block the caller)
 *
 * Safe to call from any API route. Never throws — logs errors and continues.
 */
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

    // Determine recipients if not specified: all users in the company
    let recipients: string[] = recipientIds || [];
    if (recipients.length === 0) {
      const members = await db.companyUser.findMany({
        where: { companyId },
        select: { userId: true },
      });
      recipients = members.map((m) => m.userId);
    }

    // 1. Create notifications for each recipient (skip the actor if they triggered it)
    const notifData = recipients
      .filter((id) => id !== userId)
      .map((recipientId) => ({
        userId: recipientId,
        type,
        title,
        message: description,
        link: link || null,
        metadata: JSON.stringify(metadata),
      }));
    if (notifData.length > 0) {
      await db.notification.createMany({ data: notifData }).catch((e) =>
        console.error('[emitEvent] notification createMany failed:', e),
      );
    }

    // 2. Audit log
    await db.auditLog
      .create({
        data: {
          action: type,
          resource: resourceType || 'unknown',
          resourceId: resourceId || null,
          details: description,
          userId: userId || null,
          companyId,
        },
      })
      .catch((e) => console.error('[emitEvent] auditLog create failed:', e));

    // 3. Activity feed entry
    await db.activity
      .create({
        data: {
          companyId,
          userId: userId || null,
          type,
          description,
          resourceType: resourceType || null,
          resourceId: resourceId || null,
          metadata: JSON.stringify(metadata),
        },
      })
      .catch((e) => console.error('[emitEvent] activity create failed:', e));

    // 4. Fire webhooks (async, fire-and-forget)
    fireWebhooksForCompany(companyId, type, {
      type,
      title,
      description,
      resourceType,
      resourceId,
      metadata,
      companyId,
      actorUserId: userId,
      timestamp: new Date().toISOString(),
    }).catch((e) => console.error('[emitEvent] fireWebhooks failed:', e));
  } catch (err) {
    console.error('[emitEvent] overall failure:', err);
  }
}

/**
 * Fetch all active webhooks for a company, filter by event subscription,
 * and POST the payload to each URL. Uses fetch with a 10-second timeout.
 *
 * Failures are logged but do not propagate — webhook delivery is best-effort.
 */
async function fireWebhooksForCompany(
  companyId: string,
  eventType: string,
  payload: Record<string, any>,
): Promise<void> {
  const webhooks = await db.webhook
    .findMany({ where: { companyId, status: 'active' } })
    .catch(() => []);
  if (webhooks.length === 0) return;

  await Promise.all(
    webhooks.map(async (webhook) => {
      try {
        let events: string[] = [];
        try {
          events = JSON.parse(webhook.events || '[]');
        } catch {
          events = [];
        }
        // If webhook has no events filter (empty array), it gets all events
        if (events.length > 0 && !events.includes(eventType)) return;

        const signature = webhook.secret
          ? await hmacSha256(webhook.secret, JSON.stringify(payload))
          : null;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MarketingOS-Event': eventType,
            'X-MarketingOS-Signature': signature || '',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        if (!res.ok) {
          console.warn(
            `[webhook] ${webhook.url} returned HTTP ${res.status} for event ${eventType}`,
          );
        }
      } catch (err) {
        console.warn(
          `[webhook] failed to deliver ${eventType} to ${webhook.url}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }),
  );
}

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
