import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// ─── JWT Secret (MUST be set in production) ───────────────────────────────────

let _jwtSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // Development-only fallback — never used in production
    _jwtSecret = new TextEncoder().encode('dev-only-jwt-secret-do-not-use-in-prod');
  } else {
    _jwtSecret = new TextEncoder().encode(secret);
  }
  return _jwtSecret;
}

// ─── Password Hashing (bcryptjs) ─────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const LEGACY_SALT = 'marketing-os-salt-2024';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Detects whether a hash is bcrypt or legacy SHA-256.
 * bcrypt hashes start with "$2"; legacy hashes are 64-char hex strings.
 */
function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

/** Legacy SHA-256 hash used before migration to bcrypt. */
async function legacyHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + LEGACY_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a password against both bcrypt and legacy SHA-256 hashes.
 * Returns { valid, needsUpgrade } — if needsUpgrade is true, the caller
 * should re-hash the password with bcrypt and persist the new hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (isLegacyHash(hash)) {
    // Legacy verification
    const computed = await legacyHash(password);
    return computed === hash;
  }
  return bcrypt.compare(password, hash);
}

/** Returns true if the stored hash needs to be upgraded to bcrypt. */
export function passwordNeedsUpgrade(hash: string): boolean {
  return isLegacyHash(hash);
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export const ROLES = [
  'super_admin',
  'company_owner',
  'admin',
  'manager',
  'social_media_manager',
  'content_manager',
  'seo_manager',
  'ai_agent_manager',
  'customer_support',
  'team_member',
  'client_user',
  'viewer',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  company_owner: 'Company Owner',
  admin: 'Admin',
  manager: 'Manager',
  social_media_manager: 'Social Media Manager',
  content_manager: 'Content Manager',
  seo_manager: 'SEO Manager',
  ai_agent_manager: 'AI Agent Manager',
  customer_support: 'Customer Support',
  team_member: 'Team Member',
  client_user: 'Client User',
  viewer: 'Viewer',
};

// ─── JWT Token ───────────────────────────────────────────────────────────────

export async function createToken(payload: { userId: string; email: string; role: string; companyId?: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

// ─── Permission Check ────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  company_owner: 90,
  admin: 80,
  manager: 70,
  social_media_manager: 60,
  content_manager: 60,
  seo_manager: 60,
  ai_agent_manager: 60,
  customer_support: 50,
  team_member: 40,
  client_user: 30,
  viewer: 20,
};

export function hasPermission(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

// ─── Session User Extraction (used by api-middleware) ───────────────────────

export interface SessionUser {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  companyId: string;
  role: string;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    // Fallback: check cookie
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/mos_token=([^;]+)/);
      token = match ? match[1] : undefined;
    }

    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    return {
      userId: payload.userId || '',
      email: payload.email || '',
      isSuperAdmin: payload.role === 'super_admin',
      companyId: payload.companyId || '',
      role: payload.role || '',
    };
  } catch {
    return null;
  }
}
