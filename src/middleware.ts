import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// ── Public routes (no JWT required) ──
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/v1/auth/',
  '/api/health',
  '/api/v1/webhooks/',
  '/api/cron/',
];
const PUBLIC_EXACT = ['/api', '/api/health', '/api/readiness'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return true;
  if (/^\/api\/v1\/integrations\/[^/]+\/callback/.test(pathname)) return true;
  return false;
}

// ── Edge-compatible rate limiter (in-memory Map) ──
interface RLEntry { count: number; resetAt: number }
const rlStore = new Map<string, RLEntry>();

function getRLLimit(pathname: string): { limit: number; windowMs: number } {
  if (pathname.includes('/auth/login') || pathname.includes('/auth/register') || pathname.includes('/auth/forgot')) {
    return { limit: 5, windowMs: 15 * 60_000 };
  }
  if (pathname.includes('/api/agency/backups') || pathname.includes('/api/admin')) {
    return { limit: 10, windowMs: 60_000 };
  }
  return { limit: 60, windowMs: 60_000 };
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number; resetAt: number } {
  const { limit, windowMs } = getRLLimit(pathname);
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const entry = rlStore.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    rlStore.set(key, { count: 1, resetAt });
    // Lazy cleanup: delete stale entries when store grows large
    if (rlStore.size > 5000) {
      for (const [k, v] of rlStore) {
        if (v.resetAt < now) rlStore.delete(k);
      }
    }
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ── Security headers ──
function addSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Access-Control-Allow-Origin', 'https://marketing.alolabs.net');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Max-Age', '86400');
}

function corsHeaders(): Record<string, string> {
  return { 'Access-Control-Allow-Origin': 'https://marketing.alolabs.net' };
}

// ── Main middleware ──
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Non-API routes: just add security headers
  if (!pathname.startsWith('/api')) {
    const res = NextResponse.next();
    addSecurityHeaders(res);
    return res;
  }

  // Rate limiting (applies to ALL API routes)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  const rl = checkRateLimit(ip, pathname);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          ...corsHeaders(),
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
        },
      },
    );
  }

  // Public API routes: skip auth
  if (isPublic(pathname)) {
    const res = NextResponse.next();
    addSecurityHeaders(res);
    res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return res;
  }

  // Protected routes: verify JWT
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized — missing token' },
      { status: 401, headers: corsHeaders() },
    );
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    await jwtVerify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized — invalid token' },
      { status: 401, headers: corsHeaders() },
    );
  }

  const res = NextResponse.next();
  addSecurityHeaders(res);
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  return res;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
