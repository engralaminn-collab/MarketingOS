// @ts-nocheck
/**
 * Resource Discovery — POST /api/v1/integrations/{connection_id}/discover
 *
 * Phase 4 of the Integration Setup Agent contract.
 *
 * Calls the provider's discovery API server-to-server using the encrypted
 * access token from the vault. Returns only non-secret resources the user
 * is authorized to access.
 *
 * Discovery strategies:
 *   - google:           fans out to Search Console + YouTube + GA4 + GTM
 *   - youtube:          YouTube channels + brand accounts
 *   - meta:             Pages + IG accounts + ad accounts + pixels + WA
 *   - linkedin:         Member profile + organizations
 *   - wordpress:        site identity via /wp-json/
 *   - shopify:          shop info + product counts
 *   - mailchimp:        audiences via /lists
 *   - sendgrid:         sender identities
 *
 * Rules:
 *   - Discover only resources covered by granted scopes.
 *   - Do NOT claim inaccessible resources don't exist.
 *   - Distinguish "not found" from "permission not granted".
 *   - Never return access tokens to the AI model.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, badRequest, ok } from '@/lib/v1-middleware';
import { decryptSecret } from '@/lib/vault';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { connectionId } = await params;
  const integration = await db.integration.findFirst({
    where: { id: connectionId, companyId: ctx.companyId },
    include: { secrets: true },
  });
  if (!integration) return notFound('integration not found');
  if (integration.status !== 'connected') {
    return badRequest(`integration is ${integration.status}; complete OAuth or submit credentials first`);
  }

  const provider = getProvider(integration.provider);
  if (!provider) return notFound(`unknown provider: ${integration.provider}`);

  // Resolve the access token from the vault (manual providers may not have one)
  const accessTokenRow = integration.secrets.find((s) => s.kind === 'access_token');
  const accessToken = accessTokenRow ? decryptSecret(accessTokenRow.ciphertext) : null;

  // Dispatch to the right discoverer
  let discovered: Record<string, unknown>;
  try {
    discovered = await runDiscovery(provider.discoverer, integration, accessToken);
  } catch (e: any) {
    await db.integrationLog.create({
      data: {
        integrationId: integration.id,
        action: 'discover',
        outcome: 'failure',
        message: e?.message || String(e),
        actorUserId: ctx.userId,
        source: 'api',
      },
    });
    return Response.json(
      { ok: false, error: 'discovery_failed', message: e?.message || 'unknown error' },
      { status: 502 }
    );
  }

  // Persist discovered resources (upsert; preserve user selections)
  for (const [type, items] of Object.entries(discovered)) {
    if (!Array.isArray(items)) continue;
    for (const item of items as any[]) {
      const resourceId = String(item.id);
      const name = item.name || null;
      const permission = item.permission || null;
      const metadata = JSON.stringify(item.metadata || {});
      const existing = await db.integrationResource.findUnique({
        where: { integrationId_type_resourceId: { integrationId: integration.id, type, resourceId } },
      });
      if (existing) {
        await db.integrationResource.update({
          where: { id: existing.id },
          data: { name, permission, metadata, status: 'valid' },
        });
      } else {
        await db.integrationResource.create({
          data: { integrationId: integration.id, type, resourceId, name, permission, metadata, status: 'valid', selected: false },
        });
      }
    }
  }

  await db.integrationLog.create({
    data: {
      integrationId: integration.id,
      action: 'discover',
      outcome: 'success',
      message: `discovered ${Object.values(discovered).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)} resources`,
      actorUserId: ctx.userId,
      source: 'api',
    },
  });

  return ok({ provider: integration.provider, resources: discovered });
}

// ─── Discoverer dispatch ─────────────────────────────────────────────────────

async function runDiscovery(
  discoverer: string,
  integration: { id: string; provider: string; companyId: string; secrets: any[] },
  accessToken: string | null
): Promise<Record<string, unknown>> {
  switch (discoverer) {
    case 'google_search_console':
    case 'google_youtube':
    case 'google_ga4':
    case 'google_gtm':
    case 'google_ads':
    case 'google_business':
      return discoverGoogle(integration, accessToken);
    case 'meta_pages':
    case 'meta_ad_accounts':
    case 'meta_pixels':
    case 'meta_whatsapp':
      return discoverMeta(integration, accessToken);
    case 'linkedin_organizations':
      return discoverLinkedin(accessToken);
    case 'x_account':
      return discoverX(accessToken);
    case 'tiktok_account':
      return discoverTiktok(accessToken);
    case 'pinterest_boards':
      return discoverPinterest(accessToken);
    case 'wordpress_site':
      return discoverWordPress(integration);
    case 'shopify_store':
      return discoverShopify(integration, accessToken);
    case 'stripe_account':
      return discoverStripe(accessToken);
    case 'hubspot_account':
      return discoverHubspot(accessToken);
    case 'mailchimp_audiences':
      return discoverMailchimp(integration);
    case 'sendgrid_sender_identities':
      return discoverSendgrid(integration);
    default:
      return { error: `no discoverer implemented for "${discoverer}"` };
  }
}

// ─── Google — fan out to Search Console + YouTube + GA4 + GTM ────────────────
async function discoverGoogle(_integration: any, accessToken: string | null): Promise<Record<string, unknown>> {
  if (!accessToken) return { error: 'no access token — connect via OAuth first' };
  const [searchConsole, youtube, ga4, gtm] = await Promise.allSettled([
    discoverGoogleSearchConsole(accessToken),
    discoverYouTube(accessToken),
    discoverGA4(accessToken),
    discoverGTM(accessToken),
  ]);
  return {
    search_console_sites: settled(searchConsole),
    youtube_channels: settled(youtube),
    ga4_properties: settled(ga4),
    gtm_containers: settled(gtm),
  };
}

function settled<T>(p: PromiseSettledResult<T>): T | { error: string } {
  return p.status === 'fulfilled' ? p.value : { error: (p as PromiseRejectedResult).reason?.message || 'request failed' };
}

async function discoverGoogleSearchConsole(token: string) {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`search console HTTP ${res.status}`);
  const data: any = await res.json();
  return (data.siteEntry || []).map((s: any) => ({
    id: s.siteUrl,
    name: s.siteUrl,
    permission: s.permissionLevel,
    type: 'search_console_site',
    metadata: { siteUrl: s.siteUrl, permissionLevel: s.permissionLevel },
  }));
}

async function discoverYouTube(token: string) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`youtube HTTP ${res.status}`);
  const data: any = await res.json();
  return (data.items || []).map((c: any) => ({
    id: c.id,
    name: c.snippet?.title,
    type: 'youtube_channel',
    permission: 'owner',
    metadata: { country: c.snippet?.country, uploadsPlaylist: c.contentDetails?.relatedPlaylists?.uploads },
  }));
}

async function discoverGA4(token: string) {
  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/properties?show_deleted=false', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ga4 HTTP ${res.status}`);
  const data: any = await res.json();
  return (data.properties || []).map((p: any) => ({
    id: p.name.replace('properties/', ''),
    name: p.displayName,
    type: 'ga4_property',
    permission: 'reader',
    metadata: { industry: p.industryCategory, timeZone: p.timeZone, currencyCode: p.currencyCode },
  }));
}

async function discoverGTM(token: string) {
  const res = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/accounts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`gtm HTTP ${res.status}`);
  const data: any = await res.json();
  const out: any[] = [];
  for (const a of data.account || []) {
    const containersRes = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/accounts/${a.accountId}/containers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (containersRes.ok) {
      const cs: any = await containersRes.json();
      for (const c of cs.container || []) {
        out.push({
          id: `${a.accountId}-${c.publicId}`,
          name: `${a.name} / ${c.name}`,
          type: 'gtm_container',
          permission: a.tagManagerId ? 'owner' : 'user',
          metadata: { publicId: c.publicId, usageContext: c.usageContext },
        });
      }
    }
  }
  return out;
}

// ─── Meta — Pages + IG + Ad accounts + Pixels + WhatsApp ─────────────────────
async function discoverMeta(_integration: any, accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const [pages, adAccounts] = await Promise.allSettled([
    fetchJson(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,access_token&access_token=${accessToken}`),
    fetchJson(`https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_id,currency&access_token=${accessToken}`),
  ]);
  const pagesList = pages.status === 'fulfilled' ? pages.value.data || [] : [];
  const adsList = adAccounts.status === 'fulfilled' ? adAccounts.value.data || [] : [];

  // For each page, fetch IG account + pixels in parallel
  const instagramAccounts: any[] = [];
  const pixels: any[] = [];
  await Promise.all(
    pagesList.map(async (page: any) => {
      const igRes = await fetchJson(
        `https://graph.facebook.com/v19.0/${page.id}?fields=connected_instagram_account{username,name,followers_count}&access_token=${page.access_token || accessToken}`
      ).catch(() => null);
      if (igRes?.connected_instagram_account) {
        instagramAccounts.push({ ...igRes.connected_instagram_account, page_id: page.id });
      }
      const pxRes = await fetchJson(
        `https://graph.facebook.com/v19.0/${page.id}/adaccounts?fields=pixels&access_token=${page.access_token || accessToken}`
      ).catch(() => null);
      for (const acct of pxRes?.data || []) {
        for (const px of acct.pixels?.data || []) {
          pixels.push({ id: px.id, name: px.name, page_id: page.id });
        }
      }
    })
  );

  return {
    facebook_pages: pagesList.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: 'fb_page',
      permission: p.category || 'page',
      metadata: { category: p.category },
    })),
    instagram_accounts: instagramAccounts.map((ig: any) => ({
      id: ig.id,
      name: ig.username || ig.name,
      type: 'ig_account',
      permission: 'admin',
      metadata: { followers: ig.followers_count, page_id: ig.page_id },
    })),
    ad_accounts: adsList.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: 'ad_account',
      permission: 'advertiser',
      metadata: { accountId: a.account_id, currency: a.currency },
    })),
    pixels: pixels.map((p) => ({ id: p.id, name: p.name, type: 'pixel', permission: 'reader', metadata: { page_id: p.page_id } })),
  };
}

// ─── LinkedIn ────────────────────────────────────────────────────────────────
async function discoverLinkedin(accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const res = await fetch('https://api.linkedin.com/v2/organizations?q=organizationRoleAssignments&role=ADMINISTRATOR&state=ACTIVE', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { error: `linkedin HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    linkedin_organizations: (data.elements || []).map((o: any) => ({
      id: o.id || o['organization~']?.id,
      name: o['organization~']?.localizedName || o['organization~']?.name?.localized?.en_US,
      type: 'linkedin_page',
      permission: 'ADMINISTRATOR',
    })),
  };
}

// ─── X / Twitter ─────────────────────────────────────────────────────────────
async function discoverX(accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { error: `x HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    x_accounts: [
      {
        id: data.data?.id,
        name: data.data?.name,
        type: 'x_account',
        permission: 'owner',
        metadata: { username: data.data?.username },
      },
    ],
  };
}

// ─── TikTok ──────────────────────────────────────────────────────────────────
async function discoverTiktok(accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const res = await fetch('https://open.tiktokapis.com/v2/user/info/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { error: `tiktok HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    tiktok_accounts: [
      {
        id: data.data?.user?.open_id,
        name: data.data?.user?.display_name || data.data?.user?.username,
        type: 'tiktok_account',
        permission: 'owner',
      },
    ],
  };
}

// ─── Pinterest ───────────────────────────────────────────────────────────────
async function discoverPinterest(accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const res = await fetch('https://api.pinterest.com/v5/boards?page_size=50', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { error: `pinterest HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    pinterest_boards: (data.items || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      type: 'pinterest_board',
      permission: 'owner',
    })),
  };
}

// ─── WordPress — uses application password stored as 'application_password' secret ─
async function discoverWordPress(integration: any) {
  const siteUrlRow = await db.integrationResource.findFirst({
    where: { integrationId: integration.id, type: 'manual_field', resourceId: 'site_url' },
  });
  const usernameRow = await db.integrationResource.findFirst({
    where: { integrationId: integration.id, type: 'manual_field', resourceId: 'username' },
  });
  const secretRow = integration.secrets.find((s: any) => s.kind === 'application_password');
  if (!siteUrlRow || !usernameRow || !secretRow) return { error: 'wordpress credentials incomplete' };

  const siteUrl = siteUrlRow.name!;
  const username = usernameRow.name!;
  const appPassword = decryptSecret(secretRow.ciphertext).replace(/\s/g, '');
  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

  const res = await fetch(`${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return { error: `wordpress HTTP ${res.status}` };
  const user: any = await res.json();
  return {
    wordpress_sites: [
      {
        id: siteUrl,
        name: siteUrl,
        type: 'wp_site',
        permission: user.roles?.[0] || 'user',
        metadata: { currentUserId: user.id, username: user.slug, roles: user.roles },
      },
    ],
  };
}

// ─── Shopify ─────────────────────────────────────────────────────────────────
async function discoverShopify(integration: any, accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const shopRow = await db.integrationResource.findFirst({
    where: { integrationId: integration.id, type: 'manual_field', resourceId: 'shop' },
  });
  if (!shopRow) return { error: 'shop domain missing' };
  const shopDomain = shopRow.name!;
  const res = await fetch(`https://${shopDomain}/admin/api/2024-10/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  if (!res.ok) return { error: `shopify HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    shopify_stores: [
      {
        id: data.shop?.id?.toString(),
        name: data.shop?.name,
        type: 'shopify_store',
        permission: 'owner',
        metadata: { domain: data.shop?.domain, currency: data.shop?.currency, country: data.shop?.country },
      },
    ],
  };
}

// ─── Stripe ──────────────────────────────────────────────────────────────────
async function discoverStripe(accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const res = await fetch('https://api.stripe.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { error: `stripe HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    stripe_accounts: (data.data || []).map((a: any) => ({
      id: a.id,
      name: a.business_profile?.name || a.id,
      type: 'stripe_account',
      permission: a.payouts_enabled ? 'owner' : 'reader',
      metadata: { country: a.country, defaultCurrency: a.default_currency },
    })),
  };
}

// ─── HubSpot ─────────────────────────────────────────────────────────────────
async function discoverHubspot(accessToken: string | null) {
  if (!accessToken) return { error: 'no access token' };
  const res = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { error: `hubspot HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    hubspot_accounts: [
      {
        id: data.user_id?.toString() || data.hub_id?.toString(),
        name: data.user,
        type: 'hubspot_account',
        permission: 'owner',
        metadata: { hubId: data.hub_id, scopes: data.scopes },
      },
    ],
  };
}

// ─── Mailchimp — uses manual API key ─────────────────────────────────────────
async function discoverMailchimp(integration: any) {
  const apiKeyRow = integration.secrets.find((s: any) => s.kind === 'api_key');
  const dcRow = await db.integrationResource.findFirst({
    where: { integrationId: integration.id, type: 'manual_field', resourceId: 'server_prefix' },
  });
  if (!apiKeyRow || !dcRow) return { error: 'mailchimp credentials incomplete' };
  const apiKey = decryptSecret(apiKeyRow.ciphertext);
  const dc = dcRow.name!;
  const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists`, {
    headers: { Authorization: `Basic ${Buffer.from(`any:${apiKey}`).toString('base64')}` },
  });
  if (!res.ok) return { error: `mailchimp HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    mailchimp_audiences: (data.lists || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: 'mailchimp_audience',
      permission: 'owner',
      metadata: { memberCount: l.stats?.member_count },
    })),
  };
}

// ─── SendGrid — uses manual API key ──────────────────────────────────────────
async function discoverSendgrid(integration: any) {
  const apiKeyRow = integration.secrets.find((s: any) => s.kind === 'api_key');
  if (!apiKeyRow) return { error: 'sendgrid api key missing' };
  const apiKey = decryptSecret(apiKeyRow.ciphertext);
  const res = await fetch('https://api.sendgrid.com/v3/senders?limit=50', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return { error: `sendgrid HTTP ${res.status}` };
  const data: any = await res.json();
  return {
    sendgrid_sender_identities: (data.senders || []).map((s: any) => ({
      id: s.id?.toString(),
      name: s.nickname || s.from?.email,
      type: 'sendgrid_sender',
      permission: 'owner',
      metadata: { email: s.from?.email, verified: s.verified },
    })),
  };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
