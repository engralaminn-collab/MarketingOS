/**
 * GET /api/v1/integrations/{connection_id}/missing-fields
 *
 * Phase 6 of the Integration Setup Agent contract.
 *
 * Returns a list of fields the agent still needs to collect from the
 * user before validation can succeed. The list is computed by comparing
 * the provider's required manualFields against what's already stored.
 *
 * For OAuth providers, missing-fields is usually empty — the OAuth
 * flow supplies everything. For providers that need a webhook URL,
 * developer_token, or extra app secret (Google Ads, Meta WhatsApp),
 * the missing-fields endpoint surfaces them as 'collection_method:
 * "secure_form"' so the agent knows to render a form, not ask in chat.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';
import { getProvider } from '@/lib/providers';

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

  const provider = getProvider(integration.provider);
  if (!provider) return notFound(`unknown provider: ${integration.provider}`);

  const missing: Array<{
    field: string;
    secret: boolean;
    required: boolean;
    collection_method: 'secure_form' | 'conversation';
    helpText?: string;
    placeholder?: string;
  }> = [];

  // Manual fields for manual-auth providers
  if (provider.manualFields) {
    for (const f of provider.manualFields) {
      if (f.secret) {
        const has = integration.secrets.some((s) => s.kind === f.name);
        if (!has) {
          missing.push({
            field: f.name,
            secret: true,
            required: f.required,
            collection_method: 'secure_form',
            helpText: f.helpText,
            placeholder: f.placeholder,
          });
        }
      } else {
        const has = integration.resources.some(
          (r) => r.type === 'manual_field' && r.resourceId === f.name && !!r.name
        );
        if (!has) {
          missing.push({
            field: f.name,
            secret: false,
            required: f.required,
            collection_method: 'conversation',
            helpText: f.helpText,
            placeholder: f.placeholder,
          });
        }
      }
    }
  }

  // OAuth providers that need extra secrets (Google Ads developer_token, etc.)
  if (integration.provider === 'google') {
    const hasDevToken = integration.secrets.some((s) => s.kind === 'developer_token');
    if (!hasDevToken && integration.grantedScopes.includes('https://www.googleapis.com/auth/adwords')) {
      missing.push({
        field: 'developer_token',
        secret: true,
        required: false,
        collection_method: 'secure_form',
        helpText: 'Google Ads developer token (obtained from the Google Ads API Center). Optional unless you want ad management.',
      });
    }
  }

  // Resources selected? If discovery has run but nothing was selected,
  // surface that as a missing "resource_selection" step.
  if (integration.status === 'connected' && integration.resources.length > 0 && integration.resources.every((r) => !r.selected)) {
    missing.push({
      field: 'resource_selection',
      secret: false,
      required: true,
      collection_method: 'conversation',
      helpText: `${integration.resources.length} resources were discovered — please choose which to use.`,
    });
  }

  return ok({
    connection_id: integration.id,
    provider: integration.provider,
    missing,
  });
}
