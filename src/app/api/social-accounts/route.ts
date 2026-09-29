import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

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

    const accounts = await db.socialAccount.findMany({
      where: { companyId: payload.companyId },
      orderBy: { connectedAt: 'desc' },
    });

    const connectedPlatforms = accounts.map(a => a.platform);
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

    const { platform, accountName, accountHandle, accessToken, scopes } = await req.json();
    if (!platform || !accessToken) {
      return NextResponse.json({ error: 'Platform and access token required' }, { status: 400 });
    }

    const account = await db.socialAccount.create({
      data: {
        platform,
        accountName: accountName || `My ${platform}`,
        accountHandle,
        accessToken: btoa(accessToken),
        scopes: JSON.stringify(scopes || []),
        status: 'active',
        lastSyncedAt: new Date(),
        companyId: payload.companyId,
      },
    });

    return NextResponse.json({ account });
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

    const { id } = await req.json();
    await db.socialAccount.delete({ where: { id, companyId: payload.companyId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
