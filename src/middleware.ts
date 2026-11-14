import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that legitimately do NOT require a JWT token
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/v1/auth/',
  '/api/health',
  '/api/v1/webhooks/',
  '/api/cron/',
];

const PUBLIC_EXACT = [
  '/api',
  '/api/health',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true;
  // OAuth callbacks: /api/v1/integrations/<id>/callback
  if (/^\/api\/v1\/integrations\/[^/]+\/callback/.test(pathname)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api')) {
    const res = NextResponse.next();
    addSecurityHeaders(res);
    return res;
  }

  // Public routes: skip auth, add headers
  if (isPublic(pathname)) {
    const res = NextResponse.next();
    addSecurityHeaders(res);
    return res;
  }

  // Protected routes: verify JWT
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized — missing token' },
      { status: 401, headers: corsHeaders() }
    );
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    await jwtVerify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized — invalid token' },
      { status: 401, headers: corsHeaders() }
    );
  }

  const res = NextResponse.next();
  addSecurityHeaders(res);
  return res;
}

function addSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  // CORS
  res.headers.set('Access-Control-Allow-Origin', 'https://marketing.alolabs.net');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Max-Age', '86400');
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': 'https://marketing.alolabs.net',
  };
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
