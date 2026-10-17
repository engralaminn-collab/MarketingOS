import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { encryptCredential, isEncryptedCredential } from '@/lib/credential-vault';
import { verifySocialCredential } from '@/lib/social-provider';

const PLATFORMS = ['Facebook', 'Instagram', 'LinkedIn', 'X', 'YouTube', 'TikTok', 'Pinterest', 'Telegram'];

const PLATFORM_REQUIREMENTS: Record<string, { oauthUrl?: string; scopes: string[]; needsBusinessVerification: boolean; setupGuide: string[] }> = {
  Facebook: { oauthUrl: 'https://developers.facebook.com', scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic', 'instagram_content_publish'], needsBusinessVerification: true, setupGuide: ['Create a Facebook App in Meta Developer Portal', 'Add Facebook Login product', 'Configure OAuth redirect URI', 'Request required permissions', 'Submit for app review'] },
  Instagram: { oauthUrl: 'https://developers.facebook.com', scopes: ['instagram_basic', 'instagram_content_publish'], needsBusinessVerification: true, setupGuide: ['Connect Instagram to a Facebook Page', 'Use Facebook Graph API for Instagram', 'Request instagram_content_publish permission'] },
  LinkedIn: { oauthUrl: 'https://developer.linkedin.com', scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'], needsBusinessVerification: false, setupGuide: ['Create LinkedIn App in Developer Portal', 'Set OAuth 2.0 redirect URL', 'Request marketing developer platform access'] },
  X: { oauthUrl: 'https://developer.twitter.com', scopes: ['tweet.read', 'tweet.write', 'users.read'], needsBusinessVerification: false, setupGuide: ['Create X Developer Account', 'Create a Project and App', 'Set up OAuth 2.0', 'Enable Elevated access for posting'] },
  YouTube: { oauthUrl: 'https://console.cloud.google.com', scopes: ['youtube.readonly', 'youtube.upload'], needsBusinessVerification: false, setupGuide: ['Create Google Cloud Project', 'Enable YouTube Data API v3', 'Configure OAuth consent screen', 'Create OAuth 2.0 credentials'] },
  TikTok: { oauthUrl: 'https://developers.tiktok.com', scopes: ['user.info.basic', 'video.publish'], needsBusinessVerification: true, setupGuide: ['Register as TikTok Developer', 'Create an app', 'Set up webhooks', 'Apply for video.publish scope'] },
  Pinterest: { oauthUrl: 'https://developers.pinterest.com', scopes: ['boards:read', 'pins:read', 'pins:write'], needsBusinessVerification: false, setupGuide: ['Create Pinterest Developer Account', 'Create an App', 'Get OAuth credentials'] },
  Telegram: { oauthUrl: 'https://my.telegram.org', scopes: [], needsBusinessVerification: false, setupGuide: ['Create a Telegram Bot via @BotFather', 'Get Bot API Token', 'Set webhook URL for bot'] },
};

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!payload.companyId) return NextResponse.json({ error: 'No company associated' }, { status: 400 });

    // Read tokens only server-side to detect legacy plaintext/base64 credentials.
    // Never serialize accessToken or refreshToken into the browser response.
    const records = await db.socialAccount.findMany({
      where: { companyId: payload.companyId },
      orderBy: { connectedAt: 'desc' },
    });
    const accounts = records.map(({ accessToken, refreshToken, ...account }) => ({
      ...account,
      status: isEncryptedCredential(accessToken) ? account.status : 'needs_reconnect',
      credentialStoredSecurely: isEncryptedCredential(accessToken),
      hasRefreshToken: Boolean(refreshToken),
    }));

    const connectedPlatforms = accounts.filter(a => a.status === 'active').map(a => a.platform);
    const missingPlatforms = PLATFORMS.filter(p => !connectedPlatforms.includes(p));

    return NextResponse.json({
      accounts,
      platforms: PLATFORMS,
      connectedPlatforms,
      missingPlatforms,
      requirements: PLATFORM_REQUIREMENTS,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!payload.companyId) return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    const { platform, accountName, accountHandle, accessToken, scopes } = await req.json();
    if (!PLATFORMS.includes(platform) || typeof accessToken !== 'string' || !accessToken.trim()) {
      return NextResponse.json({ error: 'A supported platform and access token are required' }, { status: 400 });
    }
    if (accessToken.length > 10000) return NextResponse.json({ error: 'Access token is too long' }, { status: 400 });

    let verification: Awaited<ReturnType<typeof verifySocialCredential>>;
    try {
      verification = await verifySocialCredential(platform, accessToken.trim());
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Platform rejected the credential' }, { status: 502 });
    }

    let encryptedAccessToken: string;
    try {
      encryptedAccessToken = encryptCredential(accessToken.trim());
    } catch (error) {
      console.error('[social-accounts] credential encryption is not configured:', error instanceof Error ? error.message : 'unknown error');
      return NextResponse.json({ error: 'Secure credential storage is not configured. Set CREDENTIAL_ENCRYPTION_KEY before connecting social accounts.' }, { status: 503 });
    }

    const account = await db.socialAccount.create({
      data: {
        platform,
        accountName: typeof accountName === 'string' && accountName.trim() && !accountName.startsWith('My ') ? accountName.trim().slice(0, 160) : (verification.accountName || `My ${platform}`).slice(0, 160),
        accountHandle: typeof accountHandle === 'string' && accountHandle.trim() ? accountHandle.slice(0, 160) : null,
        accountId: verification.accountId,
        accessToken: encryptedAccessToken,
        scopes: JSON.stringify(Array.isArray(scopes) ? scopes.filter((s: unknown) => typeof s === 'string').slice(0, 100) : []),
        // Mark active only after a live read-only identity check succeeds.
        status: 'active',
        lastSyncedAt: new Date(),
        companyId: payload.companyId,
      },
      select: {
        id: true, platform: true, accountName: true, accountHandle: true, accountId: true, avatarUrl: true,
        status: true, scopes: true, lastSyncedAt: true, connectedAt: true, createdAt: true, updatedAt: true,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    if (!payload.companyId) return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const result = await db.socialAccount.deleteMany({ where: { id, companyId: payload.companyId } });
    if (result.count === 0) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
