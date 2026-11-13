/**
 * POST /api/v1/integrations/{provider}/credentials
 *
 * Submits manual credentials for a provider that does not support OAuth
 * (WordPress application password, Mailchimp API key, SendGrid API key).
 *
 * Body shape (one or more fields per provider.manualFields):
 *   { "credentials": { "site_url": "...", "username": "...", "application_password": "..." } }
 *
 * Backend:
 *   - Encrypts every secret field via the vault (AES-256-GCM).
 *   - Stores non-secret fields as plain IntegrationResource metadata.
 *   - Returns ONLY the masked values + credential_id reference.
 *
 * NEVER accepts:
 *   - OAuth access tokens (use /authorize + /callback)
 *   - OAuth refresh tokens
 *   - Provider account passwords
 *   - OTP / 2FA / recovery codes
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { getProvider } from '@/lib/providers';
import { encryptSecret, maskSecret } from '@/lib/vault';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id: providerSlug } = await params;
  const provider = getProvider(providerSlug);
  if (!provider) return notFound(`unknown provider: ${providerSlug}`);
  if (provider.authMethod === 'oauth') {
    return badRequest(`${providerSlug} uses OAuth — call /api/v1/integrations/${providerSlug}/authorize instead`);
  }
  if (!provider.manualFields || provider.manualFields.length === 0) {
    return badRequest(`provider ${providerSlug} has no manualFields defined`);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || !body.credentials) {
    return badRequest('body must be { "credentials": { ... } }');
  }
  const submitted: Record<string, string> = body.credentials;

  // Reject forbidden secret kinds (defensive — these belong to OAuth flow only)
  const forbiddenKinds = ['access_token', 'refresh_token', 'otp', 'mfa_code', 'recovery_code', 'session_cookie', 'password'];
  for (const forbidden of forbiddenKinds) {
    if (forbidden in submitted) {
      return badRequest(`field "${forbidden}" is not allowed via this endpoint`);
    }
  }

  // Validate required fields
  const missing = provider.manualFields.filter((f) => f.required && !submitted[f.name]?.trim());
  if (missing.length > 0) {
    return badRequest(
      `missing required fields: ${missing.map((f) => f.name).join(', ')}`,
      missing.map((f) => ({ field: f.name, helpText: f.helpText }))
    );
  }

  // Upsert the Integration row (manual authMethod, connected status)
  const integration = await db.integration.upsert({
    where: { companyId_provider: { companyId: ctx.companyId, provider: providerSlug } },
    update: {
      status: 'connected',
      authMethod: 'manual',
      grantedScopes: '[]',
      lastValidatedAt: new Date(),
      updatedBy: ctx.userId,
    },
    create: {
      companyId: ctx.companyId,
      provider: providerSlug,
      authMethod: 'manual',
      status: 'connected',
      grantedScopes: '[]',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  // Persist each submitted field: secrets encrypted, non-secrets stored as
  // a single IntegrationResource row with metadata.
  const maskedResults: Array<{ field: string; secret: boolean; masked: string | null }> = [];

  for (const field of provider.manualFields) {
    const value = (submitted[field.name] || '').trim();
    if (!value) continue;

    if (field.secret) {
      const encrypted = encryptSecret(value);
      await db.integrationSecret.upsert({
        where: { integrationId_kind: { integrationId: integration.id, kind: field.name } },
        update: { ciphertext: encrypted.ciphertext, keyVersion: encrypted.keyVersion, maskedValue: maskSecret(value), rotatedAt: new Date() },
        create: { integrationId: integration.id, kind: field.name, ...encrypted, maskedValue: maskSecret(value) },
      });
      maskedResults.push({ field: field.name, secret: true, masked: maskSecret(value) });
    } else {
      // Non-secret field stored as a single resource row per field.
      await db.integrationResource.upsert({
        where: { integrationId_type_resourceId: { integrationId: integration.id, type: 'manual_field', resourceId: field.name } },
        update: { name: value, status: 'valid', metadata: JSON.stringify({ label: field.label }) },
        create: {
          integrationId: integration.id,
          type: 'manual_field',
          resourceId: field.name,
          name: value,
          status: 'valid',
          metadata: JSON.stringify({ label: field.label }),
          selected: true,
        },
      });
      maskedResults.push({ field: field.name, secret: false, masked: value });
    }
  }

  await db.integrationLog.create({
    data: {
      integrationId: integration.id,
      action: 'credentials_stored',
      outcome: 'success',
      message: `manual credentials stored: ${maskedResults.map((m) => m.field).join(', ')}`,
      actorUserId: ctx.userId,
      source: 'api',
    },
  });

  await emitEvent({
    type: 'integration.connected',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'integration',
    resourceId: integration.id,
    metadata: { provider: providerSlug, authMethod: 'manual' },
  });

  return ok({
    credential_id: integration.id,
    provider: providerSlug,
    status: 'stored',
    fields: maskedResults,
  });
}
