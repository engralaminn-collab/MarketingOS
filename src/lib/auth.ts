import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

let _jwtSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    _jwtSecret = new TextEncoder().encode('dev-only-jwt-secret-do-not-use-in-prod');
  } else {
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    _jwtSecret = new TextEncoder().encode(secret);
  }
  return _jwtSecret;
}

const BCRYPT_ROUNDS = 12;
const LEGACY_SALT = 'marketing-os-salt-2024';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

async function legacyHash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + LEGACY_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (isLegacyHash(hash)) {
    const computed = await legacyHash(password);
    return computed === hash;
  }
  return bcrypt.compare(password, hash);
}

export function passwordNeedsUpgrade(hash: string): boolean {
  return isLegacyHash(hash);
}

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
  superadmin: 'Super Admin',
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
  teacher: 'Teacher',
  accountant: 'Accountant',
  student: 'Student',
  parent: 'Parent',
  employee: 'Employee',
  staff: 'Staff',
};

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  company_owner: 90,
  admin: 80,
  manager: 70,
  accountant: 65,
  teacher: 65,
  social_media_manager: 60,
  content_manager: 60,
  seo_manager: 60,
  ai_agent_manager: 60,
  customer_support: 50,
  employee: 40,
  staff: 40,
  team_member: 40,
  client_user: 30,
  parent: 25,
  student: 20,
  viewer: 10,
};

const ROLE_ALIASES: Record<string, string> = { superadmin: 'super_admin' };
const DOMAIN_ROLE_MEMBERS: Record<string, ReadonlySet<string>> = {
  teacher: new Set(['super_admin', 'company_owner', 'admin', 'manager', 'teacher']),
  accountant: new Set(['super_admin', 'company_owner', 'admin', 'manager', 'accountant']),
  student: new Set(['super_admin', 'company_owner', 'admin', 'manager', 'teacher', 'student']),
  employee: new Set(['super_admin', 'company_owner', 'admin', 'manager', 'employee', 'staff']),
  staff: new Set(['super_admin', 'company_owner', 'admin', 'manager', 'staff']),
  parent: new Set(['super_admin', 'company_owner', 'admin', 'manager', 'teacher', 'parent']),
};

function normalizeRole(role: string): string {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return ROLE_ALIASES[normalized] || normalized;
}

/**
 * Unknown actors and unknown minimum roles fail closed. Academic roles have
 * explicit membership rules so an unrelated role cannot pass due to a default
 * rank of zero.
 */
export function hasPermission(userRole: string, requiredRole: string): boolean {
  const actor = normalizeRole(userRole);
  const required = normalizeRole(requiredRole);
  if (!Object.hasOwn(ROLE_HIERARCHY, actor) || !Object.hasOwn(ROLE_HIERARCHY, required)) return false;
  const explicitMembers = DOMAIN_ROLE_MEMBERS[required];
  if (explicitMembers) return explicitMembers.has(actor);
  return ROLE_HIERARCHY[actor] >= ROLE_HIERARCHY[required];
}

export interface TokenClaims {
  userId: string;
  email: string;
  role: string;
  companyId?: string;
  institutionId?: string;
  sessionId: string;
}

export interface VerifiedToken extends Record<string, unknown> {
  userId: string;
  email: string;
  role: string;
  companyId?: string;
  institutionId?: string;
  sid?: string;
  apiKeyId?: string;
}

export async function createToken(payload: TokenClaims): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    companyId: payload.companyId || '',
    institutionId: payload.institutionId || '',
    sid: payload.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(getJwtSecret());
}

/** Create a revocable DB-backed session, then sign a JWT tied to its ID. */
export async function createSessionToken(
  request: Request,
  claims: Omit<TokenClaims, 'sessionId'>,
): Promise<{ token: string; sessionId: string }> {
  const { db } = await import('./db');
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ipAddress = (forwardedFor || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || '').slice(0, 64) || null;
  const deviceInfo = (request.headers.get('user-agent') || 'Unknown device').slice(0, 255);
  const session = await db.userSession.create({
    data: {
      userId: claims.userId,
      deviceInfo,
      ipAddress,
      location: null,
    },
    select: { id: true },
  });

  try {
    const token = await createToken({ ...claims, sessionId: session.id });
    return { token, sessionId: session.id };
  } catch (error) {
    await db.userSession.delete({ where: { id: session.id } }).catch(() => undefined);
    throw error;
  }
}

const API_KEY_PREFIX = 'mos_live_sk_';
const API_KEY_LOOKUP_PREFIX_LENGTH = API_KEY_PREFIX.length + 20;
const API_KEY_LENGTH = API_KEY_PREFIX.length + 64;
const API_KEY_LAST_USED_THROTTLE_MS = 60_000;

export async function verifyToken(token: string): Promise<VerifiedToken | null> {
  if (typeof token !== 'string' || token.length === 0) return null;
  if (token.startsWith(API_KEY_PREFIX)) return verifyApiKey(token);

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string' ||
        typeof payload.role !== 'string' || typeof payload.sid !== 'string') return null;

    const { db } = await import('./db');
    const companyId = typeof payload.companyId === 'string' ? payload.companyId : '';
    const institutionId = typeof payload.institutionId === 'string' ? payload.institutionId : '';
    const session = await db.userSession.findUnique({
      where: { id: payload.sid },
      select: {
        id: true,
        userId: true,
        lastActiveAt: true,
        user: {
          select: {
            isActive: true,
            role: true,
            isSuperAdmin: true,
            institutionId: true,
            institution: { select: { isActive: true } },
            companyUsers: {
              where: { companyId: companyId || '__none__' },
              select: { role: true, company: { select: { isActive: true } } },
              take: 1,
            },
          },
        },
      },
    });

    if (!session || session.userId !== payload.userId || !session.user.isActive) return null;

    if (companyId) {
      const membership = Array.isArray(session.user.companyUsers) ? session.user.companyUsers[0] : null;
      if (!membership || !membership.company.isActive) return null;
      payload.role = session.user.isSuperAdmin ? 'super_admin' : membership.role;
    } else if (institutionId) {
      if (session.user.institutionId !== institutionId || !session.user.institution?.isActive) return null;
      payload.role = session.user.isSuperAdmin ? 'super_admin' : session.user.role;
    } else {
      return null;
    }

    const verified = payload as VerifiedToken;
    if (Date.now() - session.lastActiveAt.getTime() > 60_000) {
      void db.userSession.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } }).catch(() => undefined);
    }
    return verified;
  } catch {
    return null;
  }
}

async function verifyApiKey(token: string): Promise<VerifiedToken | null> {
  if (token.length !== API_KEY_LENGTH || !/^mos_live_sk_[a-f0-9]{64}$/i.test(token)) return null;
  try {
    const { db } = await import('./db');
    const precisePrefix = token.slice(0, API_KEY_LOOKUP_PREFIX_LENGTH);
    // New keys have an indexed, 80-bit random lookup prefix. The constant-prefix
    // fallback keeps the first generation of keys working during rotation.
    const prefixesToCheck = [precisePrefix, API_KEY_PREFIX];
    for (const keyPrefix of prefixesToCheck) {
      const keys = await db.apiKey.findMany({ where: { keyPrefix }, orderBy: { createdAt: 'desc' }, take: 10 });
      for (const key of keys) {
        if (!(await bcrypt.compare(token, key.hashedKey)) || !key.createdById) continue;
        const [user, membership] = await Promise.all([
          db.user.findUnique({ where: { id: key.createdById }, select: { id: true, email: true, isActive: true, isSuperAdmin: true } }),
          db.companyUser.findFirst({
            where: { userId: key.createdById, companyId: key.companyId },
            select: { role: true, company: { select: { isActive: true } } },
          }),
        ]);
        if (!user?.isActive || !membership?.company.isActive) return null;

        if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > API_KEY_LAST_USED_THROTTLE_MS) {
          void db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
        }
        return {
          userId: user.id,
          email: user.email,
          role: user.isSuperAdmin ? 'super_admin' : membership.role,
          companyId: key.companyId,
          institutionId: '',
          apiKeyId: key.id,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export interface SessionUser {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  companyId: string;
  institutionId: string;
  sessionId: string | null;
  role: string;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  try {
    const authorization = request.headers.get('authorization');
    let token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/(?:^|;\s*)mos_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;
    const role = typeof payload.role === 'string' ? payload.role : '';
    return {
      userId: payload.userId,
      email: payload.email,
      isSuperAdmin: role === 'super_admin' || role === 'superadmin',
      companyId: typeof payload.companyId === 'string' ? payload.companyId : '',
      institutionId: typeof payload.institutionId === 'string' ? payload.institutionId : '',
      sessionId: typeof payload.sid === 'string' ? payload.sid : null,
      role,
    };
  } catch {
    return null;
  }
}
