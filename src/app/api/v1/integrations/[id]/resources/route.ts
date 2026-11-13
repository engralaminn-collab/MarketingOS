/**
 * POST /api/v1/integrations/{connection_id}/resources
 *
 * Phase 5 of the Integration Setup Agent contract — the user selects
 * which discovered resources MarketingOS should use. Never auto-selects;
 * requires explicit confirmation.
 *
 * Body:
 *   { "resource_ids": ["youtube_channel:UC...", "search_console_site:https://example.com/"] }
 *
 * resource_ids are formed as "{type}:{resourceId}" — both come from
 * the discover response so the client only ever echoes back ids the
 * backend produced.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const integration = await db.integration.findFirst({
    where: { id: connectionId, companyId: ctx.companyId },
    include: { resources: true },
  });
  if (!integration) return notFound('integration not found');

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.resource_ids)) {
    return badRequest('body must be { "resource_ids": ["type:id", ...] }');
  }

  // Validate every requested resource exists + belongs to this integration
  const requested = new Set(body.resource_ids);
  const updates: Promise<unknown>[] = [];
  for (const r of integration.resources) {
    const composite = `${r.type}:${r.resourceId}`;
    const selected = requested.has(composite);
    updates.push(
      db.integrationResource.update({
        where: { id: r.id },
        data: { selected },
      })
    );
  }
  await Promise.all(updates);

  // Snapshot selected resources onto the Integration row for fast reads
  const selectedResources = integration.resources
    .filter((r) => requested.has(`${r.type}:${r.resourceId}`))
    .map((r) => ({ type: r.type, id: r.resourceId, name: r.name }));

  await db.integration.update({
    where: { id: integration.id },
    data: {
      selectedResources: JSON.stringify(selectedResources),
      updatedBy: ctx.userId,
    },
  });

  await db.integrationLog.create({
    data: {
      integrationId: integration.id,
      action: 'select_resources',
      outcome: 'success',
      message: `selected ${selectedResources.length} of ${integration.resources.length} resources`,
      actorUserId: ctx.userId,
      source: 'ui',
    },
  });

  await emitEvent({
    type: 'integration.resources_selected',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'integration',
    resourceId: integration.id,
    metadata: { provider: integration.provider, count: selectedResources.length },
  });

  return ok({
    connection_id: integration.id,
    provider: integration.provider,
    selected: selectedResources,
    deselected_count: integration.resources.length - selectedResources.length,
  });
}
