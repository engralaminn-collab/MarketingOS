import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { verifySocialCredential } from '@/lib/social-provider';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const platform = typeof body.platform === 'string' ? body.platform : '';
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
    if (!platform || !accessToken) {
      return NextResponse.json({ error: 'Platform and access token are required' }, { status: 400 });
    }

    const result = await verifySocialCredential(platform, accessToken);
    return NextResponse.json({
      verified: true,
      platform: result.platform,
      accountId: result.accountId,
      accountName: result.accountName,
      note: 'The token was accepted by the platform identity endpoint. Publishing scopes still depend on app review and granted permissions.',
    });
  } catch (error) {
    return NextResponse.json({
      verified: false,
      error: error instanceof Error ? error.message : 'Platform credential verification failed',
    }, { status: 502 });
  }
}
