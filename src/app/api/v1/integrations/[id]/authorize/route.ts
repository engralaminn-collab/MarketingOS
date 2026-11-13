/**
 * POST /api/v1/integrations/{provider}/authorize
 *
 * Phase 2 of the Integration Setup Agent contract.
 *
 * Starts an OAuth Authorization Code + PKCE flow:
 *   1. Resolve the provider definition (provider must be OAuth-capable).
 *   2. Generate a random `state` token and a PKCE `code_verifier`.
 *   3. Persist both in OAuthState (10-minute TTL, single-use).
 *   4. Return the provider-hosted authorization URL.
 *
 * Response:
 *   { "authorization_url": "https://provider.example/oauth/authorize?...",
 *     "state_id": "...",
 *     "expires_at": "2025-01-01T00:10:00.000Z" }
 *
 * Security:
 *   - State is 256-bit random + stored server-side; never in the URL
 *     other than as the opaque token the provider echoes back.
 *   - PKCE code_verifier never leaves the server; the browser only
 *     sees the S256 code_challenge in the authorize URL.
 *   - The OAuthState row is consumed on first callback — replay fails.
 *   - 10-minute TTL means abandoned flows auto-expire.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, notConfigured, ok } from '@/lib/v1-middleware';
import { getProvider, resolveOAuthClientId, getCallbackUrl } from '@/lib/providers';
import { generateCodeVerifier, computeCodeChallenge, generateStateToken } from '@/lib/pkce';

export const dynamic = 'force-dynamic';

const TTL_MINUTES = 10;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id: providerSlug } = await params;
  const provider = getProvider(providerSlug);
  if (!provider) return notFound(`unknown provider: ${providerSlug}`);

  if (provider.authMethod === 'manual') {
    return badRequest(
      `${providerSlug} does not support OAuth — submit credentials via /api/v1/integrations/${providerSlug}/credentials`
    );
  }

  const clientId = resolveOAuthClientId(provider);
  if (!clientId) {
    return notConfigured(
      `oauth:${providerSlug}`,
      `set ${provider.clientIdEnv} and ${provider.clientSecretEnv} in .env to enable OAuth for ${provider.label}`
    );
  }

  // Build PKCE + state
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = provider.supportsPkce ? computeCodeChallenge(codeVerifier) : '';
  const stateToken = generateStateToken();
  const callbackUrl = getCallbackUrl(providerSlug);
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  // Persist OAuthState (single-use)
  const oauthState = await db.oAuthState.create({
    data: {
      companyId: ctx.companyId,
      userId: ctx.userId,
      provider: providerSlug,
      state: stateToken,
      codeVerifier,
      redirectUri: callbackUrl,
      scopes: JSON.stringify(provider.scopes),
      expiresAt,
    },
  });

  // Build the provider's authorize URL
  const authorizeUrl = new URL(provider.authorizeUrl!);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('state', stateToken);
  if (provider.scopes.length > 0) {
    authorizeUrl.searchParams.set('scope', provider.scopes.join(' '));
  }
  if (provider.supportsPkce) {
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  }

  // Create a pending Integration row so the agent can poll its status
  await db.integration.upsert({
    where: { companyId_provider: { companyId: ctx.companyId, provider: providerSlug } },
    update: { status: 'pending', currentStateId: oauthState.id, updatedBy: ctx.userId },
    create: {
      companyId: ctx.companyId,
      provider: providerSlug,
      authMethod: 'oauth',
      status: 'pending',
      grantedScopes: JSON.stringify(provider.scopes),
      currentStateId: oauthState.id,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  return ok({
    authorization_url: authorizeUrl.toString(),
    state_id: oauthState.id,
    expires_at: expiresAt.toISOString(),
    provider: providerSlug,
    pkce_enabled: provider.supportsPkce,
    redirect_uri: callbackUrl,
  });
}
