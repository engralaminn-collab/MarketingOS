import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { encryptCredential, isEncryptedCredential } from '@/lib/credential-vault';
import { verifySocialCredential } from '@/lib/social-provider';

const PLATFORMS = ['Facebook', 'Instagram', 'LinkedIn', 'X', 'YouTube', 'TikTok', 'Pinterest', 'Telegram'];

const PLATFORM_REQUIREMENTS: Record<string, { oauthUrl?: string; scopes: string[]; needsBusinessVerification: boolean; setupGuide: string[] }> = {
  Facebook: { oauthUrl: 'https://developers.facebook.com', scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'], needsBusinessVerification: true, setupGuide: ['Create a Facebook App in Meta Developer Portal', 'Configure the app and redirect URI', 'Request permissions and complete Meta app review'] },
  Instagram: { oauthUrl: 'https://developers.facebook.com', scopes: ['instagram_basic', 'instagram_content_publish'], needsBusinessVerification: true, setupGuide: ['Use a professional Instagram account linked to a Facebook Page', 'Configure Instagram Graph API access', 'Request and receive required Meta permissions'] },
  LinkedIn: { oauthUrl: 'https://developer.linkedin.com', scopes: ['r_liteprofile', 'w_member_social'], needsBusinessVerification: false, setupGuide: ['Create a LinkedIn App', 'Request the required products and scopes', 'Use a valid OAuth access token'] },
  X: { oauthUrl: 'https://developer.x.com', scopes: ['tweet.read', 'tweet.write', 'users.read'], needsBusinessVerification: false, setupGuide: ['Create an X Developer App', 'Enable user-context authentication', 'Request required scopes'] },
  YouTube: { oauthUrl: 'https://console.cloud.google.com', scopes: ['youtube.readonly', 'youtube.upload'], needsBusinessVerification: false, setupGuide: ['Create a Google Cloud project', 'Enable YouTube Data API v3', 'Configure OAuth and required scopes'] },
  TikTok: { oauthUrl: 'https://developers.tiktok.com', scopes: ['user.info.basic', 'video.publish'], needsBusinessVerification: true, setupGuide: ['Register a TikTok developer app', 'Request user info and publish scopes', 'Complete TikTok review requirements'] },
  Pinterest: { oauthUrl: 'https://developers.pinterest.com', scopes: ['user_accounts:read', 'boards:read', 'pins:read', 'pins:write'], needsBusinessVerification: false, setupGuide: ['Create a Pinterest developer app', 'Request the required API scopes', 'Use an authorized access token'] },
  Telegram: { oauthUrl: 'https://my.telegram.org', scopes: [], needsBusinessVerification: false, setupGuide: ['Create a Telegram bot via @BotFather', 'Copy its token', 'Add the bot to the channel or group with appropriate access'] },
};

const SAFE_ACCOUNT_SELECT = {
  id: true,
  platform: true,
  accountName: true,
  accountHandle: true,
  accountId: true,
  avatarUrl: true,
  status: true,
  scopes: true,
  lastSyncedAt: true,
  connectedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function accountDto(account: {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  status: string;
  lastSyncedAt: Date | null;
  connectedAt: Date;
}) {
  return {
    id: account.id,
    platform: account.platform,
    accountName: account.accountName,
    accountHandle: account.accountHandle,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt?.toISOString() || null,
    connectedAt: account.connectedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const records = await db.socialAccount.findMany({
      where: { companyId: payload.companyId },
      orderBy: { connectedAt: 'desc' },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountHandle: true,
        status: true,
        lastSyncedAt: true,
        connectedAt: true,
        accessToken: true,
        refreshToken: true,
      },
    });
    const accounts = records.map(({ accessToken, refreshToken, ...account }) => ({
      ...account,
      status: isEncryptedCredential(accessToken) ? account.status : 'needs_reconnect',
      credentialStoredSecurely: isEncryptedCredential(accessToken),
      hasRefreshToken: Boolean(refreshToken),
    }));

    const connectedPlatforms = accounts.filter((a) => a.status === 'active').map((a) => a.platform);
    const missingPlatforms = PLATFORMS.filter((p) => !connectedPlatforms.includes(p));

    return NextResponse.json({
      accounts: accounts.map(accountDto),
      platforms: PLATFORMS,
      connectedPlatforms,
      missingPlatforms,
      requirements: PLATFORM_REQUIREMENTS,
      publishingAdaptersAvailable: true,
      publishingPlatformsAvailable: ['Facebook', 'Instagram', 'LinkedIn', 'X', 'Pinterest', 'Telegram'],
      syncAdaptersAvailable: false,
    });
  } catch (error) {
    console.error('[GET /api/social-accounts]', error);
    return NextResponse.json({ error: 'Unable to load social accounts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId || !payload.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'social_media_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const platform = typeof input.platform === 'string' ? input.platform.trim() : '';
    const accessToken = typeof input.accessToken === 'string' ? input.accessToken.trim() : '';
    const accountName = typeof input.accountName === 'string' ? input.accountName.trim() : '';
    const accountHandle = typeof input.accountHandle === 'string' ? input.accountHandle.trim() : '';
    const rawScopes = input.scopes;

    if (!PLATFORMS.includes(platform) || !accessToken) {
      return NextResponse.json({ error: 'A supported platform and access token are required' }, { status: 400 });
    }
    if (accessToken.length > 10_000) {
      return NextResponse.json({ error: 'Access token is too long' }, { status: 400 });
    }
    if (rawScopes !== undefined && !Array.isArray(rawScopes)) {
      return NextResponse.json({ error: 'Scopes must be an array of strings' }, { status: 400 });
    }

    let verification: Awaited<ReturnType<typeof verifySocialCredential>>;
    try {
      verification = await verifySocialCredential(platform, accessToken);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Platform rejected the credential' },
        { status: 502 },
      );
    }

    let encryptedAccessToken: string;
    try {
      encryptedAccessToken = encryptCredential(accessToken);
    } catch (error) {
      console.error(
        '[social-accounts] credential encryption is not configured:',
        error instanceof Error ? error.message : 'unknown error',
      );
      return NextResponse.json(
        { error: 'Secure credential storage is not configured. Set CREDENTIAL_ENCRYPTION_KEY before connecting social accounts.' },
        { status: 503 },
      );
    }

    const sanitizedScopes = Array.isArray(rawScopes)
      ? rawScopes.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim().slice(0, 120)).slice(0, 100)
      : [];

    const account = await db.socialAccount.create({
      data: {
        platform,
        accountName:
          accountName && !accountName.startsWith('My ')
            ? accountName.slice(0, 160)
            : (verification.accountName || `My ${platform}`).slice(0, 160),
        accountHandle: accountHandle ? accountHandle.slice(0, 160) : null,
        accountId: verification.accountId,
        accessToken: encryptedAccessToken,
        scopes: JSON.stringify(sanitizedScopes),
        // Mark active only after a live read-only identity check succeeds.
        status: 'active',
        lastSyncedAt: new Date(),
        companyId: payload.companyId,
      },
      select: SAFE_ACCOUNT_SELECT,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId || !payload.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'social_media_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const accountIdToUpdate = typeof input.id === 'string' ? input.id.trim() : '';
    if (!accountIdToUpdate) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const existing = await db.socialAccount.findFirst({
      where: { id: accountIdToUpdate, companyId: payload.companyId },
      select: { id: true, platform: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof input.accountName === 'string' && input.accountName.trim()) {
      updateData.accountName = input.accountName.trim().slice(0, 160);
    }
    if (input.accountHandle !== undefined) {
      if (input.accountHandle === null || input.accountHandle === '') {
        updateData.accountHandle = null;
      } else if (typeof input.accountHandle === 'string') {
        updateData.accountHandle = input.accountHandle.trim().slice(0, 160);
      } else {
        return NextResponse.json({ error: 'Invalid accountHandle' }, { status: 400 });
      }
    }
    if (input.scopes !== undefined) {
      if (!Array.isArray(input.scopes)) {
        return NextResponse.json({ error: 'Scopes must be an array of strings' }, { status: 400 });
      }
      updateData.scopes = JSON.stringify(
        input.scopes.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim().slice(0, 120)).slice(0, 100),
      );
    }
    if (input.accessToken !== undefined) {
      const nextToken = typeof input.accessToken === 'string' ? input.accessToken.trim() : '';
      if (!nextToken || nextToken.length > 10_000) {
        return NextResponse.json({ error: 'Invalid access token' }, { status: 400 });
      }
      let verification: Awaited<ReturnType<typeof verifySocialCredential>>;
      try {
        verification = await verifySocialCredential(existing.platform, nextToken);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Platform rejected the credential' },
          { status: 502 },
        );
      }
      try {
        updateData.accessToken = encryptCredential(nextToken);
      } catch {
        return NextResponse.json(
          { error: 'Secure credential storage is not configured. Set CREDENTIAL_ENCRYPTION_KEY before updating credentials.' },
          { status: 503 },
        );
      }
      updateData.accountId = verification.accountId;
      updateData.status = 'active';
      updateData.lastSyncedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      const owned = await tx.socialAccount.findFirst({
        where: { id: existing.id, companyId: payload.companyId },
        select: { id: true },
      });
      if (!owned) return null;
      return tx.socialAccount.update({
        where: { id: owned.id },
        data: updateData,
        select: SAFE_ACCOUNT_SELECT,
      });
    });

    if (!updated) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ account: updated });
  } catch (error) {
    console.error('[PATCH /api/social-accounts]', error);
    return NextResponse.json({ error: 'Unable to update social account' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId || !payload.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'social_media_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const id = typeof (body as Record<string, unknown>).id === 'string' ? ((body as Record<string, unknown>).id as string).trim() : '';
    if (!id) return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });

    const deleted = await db.$transaction(async (tx) => {
      const account = await tx.socialAccount.findFirst({
        where: { id, companyId: payload.companyId },
        select: { id: true },
      });
      if (!account) return false;
      await tx.socialAccount.delete({ where: { id: account.id } });
      return true;
    });

    if (!deleted) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/social-accounts]', error);
    return NextResponse.json({ error: 'Unable to disconnect social account' }, { status: 500 });
  }
}
