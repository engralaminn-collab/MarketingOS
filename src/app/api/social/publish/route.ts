import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { decryptCredential, isEncryptedCredential } from '@/lib/credential-vault';

const META_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';
const PUBLISHABLE_PLATFORMS = new Set(['Facebook', 'Instagram', 'LinkedIn', 'X', 'Pinterest', 'Telegram']);

type PublishResponse = { id?: string; post_id?: string; error?: { message?: string }; data?: { id?: string } };

function clean(value: unknown, max = 10_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function parseProviderResponse(response: Response): Promise<PublishResponse> {
  return response.json().catch(() => ({})) as Promise<PublishResponse>;
}

async function postForm(url: string, token: string, fields: Record<string, string>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const payload = await parseProviderResponse(response);
  if (!response.ok) {
    const message = clean(payload.error?.message, 300);
    throw new Error(`Meta rejected the post (HTTP ${response.status})${message ? `: ${message}` : ''}`);
  }
  return { ...payload, id: payload.id || response.headers.get('x-restli-id') || undefined };
}

async function postJson(url: string, token: string, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const payload = await parseProviderResponse(response);
  if (!response.ok) {
    const message = clean(payload.error?.message, 300);
    throw new Error(`Platform rejected the post (HTTP ${response.status})${message ? `: ${message}` : ''}`);
  }
  return { ...payload, id: payload.id || response.headers.get('x-restli-id') || undefined };
}

/**
 * Publish one saved content item to one verified social account.
 * A platform post ID is returned only after the platform confirms acceptance.
 * Supported adapters: Facebook Pages, Instagram professional accounts,
 * LinkedIn member text posts, X text posts, Pinterest image pins, Telegram.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await verifyToken(token);
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  if (!hasPermission(actor.role, 'social_media_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const input = await req.json().catch(() => null);
  const contentId = clean(input?.contentId, 128);
  const socialAccountId = clean(input?.socialAccountId, 128);
  const destinationId = clean(input?.destinationId, 300);
  if (!contentId || !socialAccountId) {
    return NextResponse.json({ error: 'contentId and socialAccountId are required' }, { status: 400 });
  }

  try {
    const [content, account] = await Promise.all([
      db.content.findFirst({
        where: { id: contentId, companyId: actor.companyId },
        select: { id: true, title: true, body: true, mediaUrl: true, status: true, engagement: true },
      }),
      db.socialAccount.findFirst({
        where: { id: socialAccountId, companyId: actor.companyId, status: 'active' },
        select: { id: true, platform: true, accountId: true, accessToken: true },
      }),
    ]);
    if (!content) return NextResponse.json({ error: 'Content not found in this workspace' }, { status: 404 });
    if (!account) return NextResponse.json({ error: 'Active social account not found in this workspace' }, { status: 404 });
    if (!PUBLISHABLE_PLATFORMS.has(account.platform)) {
      return NextResponse.json({
        error: `Publishing is not implemented for ${account.platform} yet. No post was sent.`,
        supportedPlatforms: [...PUBLISHABLE_PLATFORMS],
      }, { status: 501 });
    }
    if (!isEncryptedCredential(account.accessToken)) {
      return NextResponse.json({ error: 'Social credential is not securely encrypted. Reconnect this account before publishing.' }, { status: 409 });
    }

    let accessToken: string;
    try {
      accessToken = decryptCredential(account.accessToken);
    } catch {
      return NextResponse.json({ error: 'Could not decrypt the stored social credential. Reconnect the account.' }, { status: 503 });
    }

    const message = clean(content.body, 20_000);
    const title = clean(content.title, 250);
    if (!message) return NextResponse.json({ error: 'Content body is empty' }, { status: 400 });
    const mediaUrl = content.mediaUrl ? httpsUrl(content.mediaUrl) : null;
    if (content.mediaUrl && !mediaUrl) return NextResponse.json({ error: 'Media URL must be a valid public HTTPS URL' }, { status: 400 });

    let engagement: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(content.engagement || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) engagement = parsed;
    } catch {
      engagement = {};
    }
    const publishedTo = Array.isArray(engagement.publishedTo) ? engagement.publishedTo as Array<Record<string, unknown>> : [];
    if (publishedTo.some((item) => item.socialAccountId === account.id)) {
      return NextResponse.json({ error: 'This content is already marked as published to this social account; duplicate publishing was blocked.' }, { status: 409 });
    }
    let providerPostId = '';
    const provider = account.platform;

    switch (account.platform) {
      case 'Facebook': {
        const pageId = account.accountId;
        if (!pageId) return NextResponse.json({ error: 'Facebook Page ID is missing. Reconnect a Page token with pages_manage_posts.' }, { status: 409 });
        const endpoint = mediaUrl
          ? `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pageId)}/photos`
          : `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pageId)}/feed`;
        const params = mediaUrl ? { url: mediaUrl, caption: message } : { message, ...(httpsUrl(message) ? { link: httpsUrl(message) } : {}) };
        const formParams = mediaUrl
          ? { url: mediaUrl, caption: message }
          : { message, ...(httpsUrl(message) ? { link: httpsUrl(message)! } : {}) };
        const payload = await postForm(endpoint, accessToken, formParams);
        providerPostId = clean(payload.id || payload.post_id, 300);
        break;
      }
      case 'Instagram': {
        const igUserId = account.accountId;
        if (!igUserId) return NextResponse.json({ error: 'Instagram professional account ID is missing' }, { status: 409 });
        if (!mediaUrl) return NextResponse.json({ error: 'Instagram feed publishing requires a publicly accessible HTTPS image in the content media URL' }, { status: 400 });
        const createUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(igUserId)}/media`;
        const container = await postForm(createUrl, accessToken, { image_url: mediaUrl, caption: message });
        const creationId = clean(container.id, 300);
        if (!creationId) throw new Error('Instagram did not return a media container ID');
        const published = await postForm(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(igUserId)}/media_publish`,
          accessToken,
          { creation_id: creationId },
        );
        providerPostId = clean(published.id, 300);
        break;
      }
      case 'LinkedIn': {
        const author = account.accountId?.startsWith('urn:li:') ? account.accountId : account.accountId ? `urn:li:person:${account.accountId}` : '';
        if (!author) return NextResponse.json({ error: 'LinkedIn author ID is missing' }, { status: 409 });
        const payload = await postJson('https://api.linkedin.com/rest/posts', accessToken, {
          author,
          commentary: message,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }, {
          'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202601',
          'X-Restli-Protocol-Version': '2.0.0',
        });
        providerPostId = clean(payload.id, 300);
        break;
      }
      case 'X': {
        const payload = await postJson('https://api.x.com/2/tweets', accessToken, { text: message });
        providerPostId = clean(payload.data?.id, 300);
        break;
      }
      case 'Pinterest': {
        if (!destinationId) return NextResponse.json({ error: 'Pinterest publishing requires destinationId set to a board ID' }, { status: 400 });
        if (!mediaUrl) return NextResponse.json({ error: 'Pinterest pins require a public HTTPS image in the content media URL' }, { status: 400 });
        const payload = await postJson('https://api.pinterest.com/v5/pins', accessToken, {
          board_id: destinationId,
          title: title.slice(0, 100),
          description: message.slice(0, 800),
          media_source: { source_type: 'image_url', url: mediaUrl },
          link: httpsUrl(message) || undefined,
        });
        providerPostId = clean(payload.id, 300);
        break;
      }
      case 'Telegram': {
        if (!destinationId) return NextResponse.json({ error: 'Telegram publishing requires destinationId set to a chat or channel ID' }, { status: 400 });
        const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(accessToken)}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: destinationId, text: message, disable_web_page_preview: false }),
          signal: AbortSignal.timeout(20_000),
          cache: 'no-store',
        });
        const payload = await parseProviderResponse(response) as PublishResponse & { ok?: boolean; result?: { message_id?: number } };
        if (!response.ok || payload.ok !== true) {
          throw new Error(`Telegram rejected the post (HTTP ${response.status})${clean(payload.error?.message, 300) ? `: ${clean(payload.error?.message, 300)}` : ''}`);
        }
        providerPostId = String(payload.result?.message_id || '');
        break;
      }
    }

    if (!providerPostId) {
      return NextResponse.json({ error: `${provider} did not return a post ID; publication was not marked successful` }, { status: 502 });
    }

    publishedTo.push({ socialAccountId: account.id, platform: account.platform, postId: providerPostId, publishedAt: new Date().toISOString() });
    await db.content.update({
      where: { id: content.id },
      data: { status: 'published', publishedAt: new Date(), engagement: JSON.stringify({ ...engagement, publishedTo }) },
    });
    await db.socialAccount.update({ where: { id: account.id }, data: { lastSyncedAt: new Date() } });

    return NextResponse.json({
      data: { status: 'published', platform: account.platform, postId: providerPostId, contentId: content.id, socialAccountId: account.id },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[POST /api/social/publish]', error instanceof Error ? error.message : 'Unknown publishing error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Social publishing failed' }, { status: 502 });
  }
}
