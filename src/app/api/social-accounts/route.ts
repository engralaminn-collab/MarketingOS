import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptSecret, isEncryptedSecret } from '@/lib/credentials';
import { hasPermission, verifyToken } from '@/lib/auth';
import { SocialTokenVerificationError, verifySocialAccessToken } from '@/lib/social-provider';

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

function accountDto(account: { id: string; platform: string; accountName: string; accountHandle: string | null; status: string; lastSyncedAt: Date | null; connectedAt: Date }) {
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

    const storedAccounts = await db.socialAccount.findMany({
      where: { companyId: payload.companyId },
      orderBy: { connectedAt: 'desc' },
      select: { id: true, platform: true, accountName: true, accountHandle: true, status: true, lastSyncedAt: true, connectedAt: true, accessToken: true },
    });
    // Legacy/demo rows used plaintext or Base64 placeholders. They must not be
    // reported as validated connections and the secret is never serialized.
    const accounts = storedAccounts.map(({ accessToken, ...account }) => ({
      ...account,
      status: account.status === 'active' && isEncryptedSecret(accessToken) ? 'active' : 'needs_revalidation',
    }));
    const connectedPlatforms = accounts.filter((account) => account.status === 'active').map((account) => account.platform);
    const missingPlatforms = PLATFORMS.filter((platform) => !connectedPlatforms.includes(platform));

    return NextResponse.json({
      accounts: accounts.map(accountDto),
      platforms: PLATFORMS,
      connectedPlatforms,
      missingPlatforms,
      requirements: PLATFORM_REQUIREMENTS,
      publishingAdaptersAvailable: false,
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

    const body = await req.json();
    const platform = typeof body?.platform === 'string' ? body.platform : '';
    const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
    if (!PLATFORMS.includes(platform) || !accessToken) {
      return NextResponse.json({ error: 'A supported platform and access token are required' }, { status: 400 });
    }

    let encryptedToken: string;
    try {
      encryptedToken = encryptSecret(accessToken);
    } catch (error) {
      console.error('[POST /api/social-accounts] credential encryption unavailable:', error);
      return NextResponse.json({ error: 'Social credentials cannot be stored until CREDENTIAL_ENCRYPTION_KEY is configured' }, { status: 503 });
    }

    let verifiedAccount;
    try {
      verifiedAccount = await verifySocialAccessToken(platform, accessToken);
    } catch (error) {
      const status = error instanceof SocialTokenVerificationError ? error.httpStatus : 503;
      const message = error instanceof SocialTokenVerificationError ? error.message : 'Unable to verify the token with the provider';
      return NextResponse.json({ error: message }, { status });
    }

    const requestedName = typeof body.accountName === 'string' ? body.accountName.trim().slice(0, 120) : '';
    const requestedHandle = typeof body.accountHandle === 'string' ? body.accountHandle.trim().slice(0, 120) : '';
    const accountName = (verifiedAccount.name || requestedName || `My ${platform}`).slice(0, 120);
    const accountHandle = verifiedAccount.handle || requestedHandle || null;
    const existing = await db.socialAccount.findFirst({
      where: { companyId: payload.companyId, platform, accountId: verifiedAccount.id },
      select: { id: true },
    });

    const saved = existing
      ? await db.socialAccount.update({
          where: { id: existing.id },
          data: { accountName, accountHandle, accessToken: encryptedToken, scopes: JSON.stringify([]), status: 'active', lastSyncedAt: null },
          select: { id: true, platform: true, accountName: true, accountHandle: true, status: true, lastSyncedAt: true, connectedAt: true },
        })
      : await db.socialAccount.create({
          data: { platform, accountName, accountHandle, accountId: verifiedAccount.id, accessToken: encryptedToken, scopes: JSON.stringify([]), status: 'active', lastSyncedAt: null, companyId: payload.companyId },
          select: { id: true, platform: true, accountName: true, accountHandle: true, status: true, lastSyncedAt: true, connectedAt: true },
        });

    return NextResponse.json({
      account: accountDto(saved),
      tokenVerified: true,
      publishingEnabled: false,
      syncEnabled: false,
      message: 'Token verified and encrypted. Publishing and automatic sync are not implemented.',
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('[POST /api/social-accounts]', error);
    return NextResponse.json({ error: 'Unable to save social account' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'social_media_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    const account = await db.socialAccount.findFirst({ where: { id, companyId: payload.companyId }, select: { id: true } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    await db.socialAccount.delete({ where: { id: account.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/social-accounts]', error);
    return NextResponse.json({ error: 'Unable to disconnect social account' }, { status: 500 });
  }
}
