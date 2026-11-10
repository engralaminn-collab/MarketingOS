/**
 * GET /api/v1/integrations/{connection_id}/status
 *
 * Phase 3 polling endpoint. Returns the connection-level status of an
 * integration without exposing any secrets. Used by the Integration
 * Setup Agent to detect when the user has completed OAuth on the
 * provider's page.
 *
 * Response:
 *   { "connection_id": "...", "provider": "google", "status": "connected",
 *     "auth_method": "oauth", "granted_scopes": [...],
 *     "token_expires_at": "...", "refresh_supported": true,
 *     "last_validated_at": "...", "resources_selected": 0,
 *     "credential_mask": { "access_token": "****x7Kq" } }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { connectionId } = await params;
  const integration = await db.integration.findFirst({
    where: { id: connectionId, companyId: ctx.companyId },
    include: { secrets: true, resources: true },
  });
  if (!integration) return notFound('integration not found');

  const credentialMask: Record<string, string> = {};
  for (const s of integration.secrets) {
    credentialMask[s.kind] = s.maskedValue || '****';
  }

  const grantedScopes = JSON.parse(integration.grantedScopes || '[]') as string[];

  return ok({
    connection_id: integration.id,
    provider: integration.provider,
    status: integration.status,
    auth_method: integration.authMethod,
    granted_scopes: grantedScopes,
    token_expires_at: integration.tokenExpiresAt?.toISOString() || null,
    refresh_supported: integration.refreshSupported,
    last_validated_at: integration.lastValidatedAt?.toISOString() || null,
    resources_discovered: integration.resources.length,
    resources_selected: integration.resources.filter((r) => r.selected).length,
    credential_mask: credentialMask,
  });
}
