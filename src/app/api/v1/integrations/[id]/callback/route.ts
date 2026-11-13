/**
 * GET /api/v1/integrations/{provider}/callback
 *
 * OAuth Authorization Code callback. The provider sends the user back
 * here with `?code=<authorization_code>&state=<state_token>` (and
 * optionally `&error=...` if the user denied consent).
 *
 * Backend responsibilities (per Integration Setup Agent contract):
 *   1. Verify the `state` token against OAuthState (constant-time).
 *   2. Reject if state is unknown, expired, or already consumed.
 *   3. Exchange the code for tokens server-to-server (PKCE verifier
 *      in the request body — never sent to the browser).
 *   4. Encrypt access_token + refresh_token via the vault (AES-256-GCM).
 *   5. Mark the Integration row as `connected`.
 *   6. Mark OAuthState.consumed=true.
 *   7. Redirect the browser to the integration wizard.
 *
 * Tokens NEVER touch the browser, the AI model, or logs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProvider, resolveOAuthClientId, resolveOAuthClientSecret, getCallbackUrl } from '@/lib/providers';
import { validateStateToken } from '@/lib/pkce';
import { encryptSecret, maskSecret } from '@/lib/vault';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: providerSlug } = await params;
  const provider = getProvider(providerSlug);
  if (!provider) {
    return NextResponse.redirect(new URL('/integrations?error=unknown_provider', request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  // User denied consent on the provider's page
  if (error) {
    return NextResponse.redirect(
      new URL(`/integrations?provider=${providerSlug}&error=${encodeURIComponent(error)}&desc=${encodeURIComponent(errorDesc || '')}`, request.url)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=missing_params`, request.url));
  }

  // Find the OAuthState row by state token (and verify it's valid)
  const oauthState = await db.oAuthState.findUnique({ where: { state } });
  if (!oauthState || oauthState.provider !== providerSlug) {
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=invalid_state`, request.url));
  }
  if (oauthState.consumed) {
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=state_consumed`, request.url));
  }
  if (oauthState.expiresAt.getTime() < Date.now()) {
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=state_expired`, request.url));
  }

  // Constant-time state comparison (defense in depth — the DB lookup already
  // confirms the state is unique; this also catches a state token that was
  // tampered with between authorize and callback while the row was still
  // in flight).
  if (!validateStateToken(oauthState.state, state)) {
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=state_mismatch`, request.url));
  }

  // Resolve OAuth client credentials
  const clientId = resolveOAuthClientId(provider);
  const clientSecret = resolveOAuthClientSecret(provider);
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=client_not_configured`, request.url));
  }

  // Exchange code → tokens (server-to-server; PKCE verifier only sent here)
  const tokenUrl = provider.tokenUrl!.replace('{shop}', providerSlug); // Shopify has {shop} placeholder, others don't
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getCallbackUrl(providerSlug),
      client_id: clientId,
      client_secret: clientSecret,
      ...(provider.supportsPkce ? { code_verifier: oauthState.codeVerifier } : {}),
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    console.error(`[integrations:${providerSlug}] token exchange failed`, tokenRes.status, detail.slice(0, 200));
    await db.integrationLog.create({
      data: {
        integration: { connect: { companyId_provider: { companyId: oauthState.companyId, provider: providerSlug } } },
        action: 'callback',
        outcome: 'failure',
        message: `token_exchange_failed: HTTP ${tokenRes.status}`,
        actorUserId: oauthState.userId,
        source: 'api',
      },
    });
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=token_exchange`, request.url));
  }

  const tokens: any = await tokenRes.json();
  const accessToken: string = tokens.access_token;
  const refreshToken: string | undefined = tokens.refresh_token;
  const expiresIn: number | undefined = tokens.expires_in;
  const grantedScopes: string[] = tokens.scope ? String(tokens.scope).split(/[\s,]+/) : provider.scopes;

  if (!accessToken) {
    return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&error=no_access_token`, request.url));
  }

  // Encrypt + persist secrets
  const integration = await db.integration.findFirstOrThrow({
    where: { companyId: oauthState.companyId, provider: providerSlug },
  });

  const accessEncrypted = encryptSecret(accessToken);
  await db.integrationSecret.upsert({
    where: { integrationId_kind: { integrationId: integration.id, kind: 'access_token' } },
    update: { ciphertext: accessEncrypted.ciphertext, keyVersion: accessEncrypted.keyVersion, maskedValue: maskSecret(accessToken), rotatedAt: new Date() },
    create: { integrationId: integration.id, kind: 'access_token', ...accessEncrypted, maskedValue: maskSecret(accessToken) },
  });

  if (refreshToken) {
    const refreshEncrypted = encryptSecret(refreshToken);
    await db.integrationSecret.upsert({
      where: { integrationId_kind: { integrationId: integration.id, kind: 'refresh_token' } },
      update: { ciphertext: refreshEncrypted.ciphertext, keyVersion: refreshEncrypted.keyVersion, maskedValue: maskSecret(refreshToken), rotatedAt: new Date() },
      create: { integrationId: integration.id, kind: 'refresh_token', ...refreshEncrypted, maskedValue: maskSecret(refreshToken) },
    });
  }

  // Mark integration connected + state consumed
  await db.$transaction([
    db.integration.update({
      where: { id: integration.id },
      data: {
        status: 'connected',
        authMethod: 'oauth',
        grantedScopes: JSON.stringify(grantedScopes),
        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        refreshSupported: !!refreshToken,
        currentStateId: null,
        lastValidatedAt: new Date(),
        updatedBy: oauthState.userId,
      },
    }),
    db.oAuthState.update({ where: { id: oauthState.id }, data: { consumed: true } }),
    db.integrationLog.create({
      data: {
        integrationId: integration.id,
        action: 'callback',
        outcome: 'success',
        message: `oauth completed; scopes=${grantedScopes.length}`,
        actorUserId: oauthState.userId,
        source: 'api',
      },
    }),
  ]);

  // Fire event so notifications, audit log, and webhooks fire
  await emitEvent({
    type: 'integration.connected',
    companyId: oauthState.companyId,
    userId: oauthState.userId,
    resource: 'integration',
    resourceId: integration.id,
    metadata: { provider: providerSlug, scopes: grantedScopes },
  });

  return NextResponse.redirect(new URL(`/integrations?provider=${providerSlug}&status=connected`, request.url));
}
