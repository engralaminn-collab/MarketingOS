import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createToken, hashPassword, ROLE_LABELS, ROLES, verifyToken } from '@/lib/auth';
import { ipFromRequest, rateLimiter } from '@/lib/security';

const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const INVITABLE_ROLES = new Set<string>(ROLES.filter((role) => role !== 'super_admin' && role !== 'company_owner'));

class InvitationFlowError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getSessionMetadata(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ipAddress = (forwardedFor || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || '').slice(0, 64) || null;
  const deviceInfo = (req.headers.get('user-agent') || 'Unknown device').slice(0, 255);
  return { ipAddress, deviceInfo };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest) {
  const ipLimit = rateLimiter(`invite-preview:${ipFromRequest(req)}`, { maxRequests: 30, windowMs: 60_000 });
  if (!ipLimit.allowed) return jsonError('Too many invitation lookups. Please try again later.', 429);

  const rawToken = req.nextUrl.searchParams.get('token') || '';
  if (!INVITE_TOKEN_PATTERN.test(rawToken)) return jsonError('Invitation link is invalid', 400);

  try {
    const invitation = await db.invitation.findUnique({
      where: { token: hashInvitationToken(rawToken) },
      include: { company: { select: { id: true, name: true, plan: true, isActive: true } } },
    });
    if (!invitation || invitation.acceptedAt) return jsonError('Invitation is invalid or has already been used', 404);
    if (invitation.expiresAt <= new Date()) return jsonError('This invitation has expired', 410);
    if (!invitation.company.isActive) return jsonError('This workspace is not active', 410);

    const existingUser = await db.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    return NextResponse.json({
      invitation: {
        email: invitation.email,
        companyName: invitation.company.name,
        role: ROLE_LABELS[invitation.role] || invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
        accountExists: Boolean(existingUser),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[GET /api/team/accept]', error);
    return jsonError('Unable to load this invitation', 500);
  }
}

export async function POST(req: NextRequest) {
  const ipLimit = rateLimiter(`invite-accept-ip:${ipFromRequest(req)}`, { maxRequests: 10, windowMs: 60 * 60_000 });
  if (!ipLimit.allowed) return jsonError('Too many attempts. Please try again later.', 429);

  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 16 * 1024) return jsonError('Request is too large', 413);
    const body = await req.json();
    const rawToken = typeof body?.token === 'string' ? body.token : '';
    if (!INVITE_TOKEN_PATTERN.test(rawToken)) return jsonError('Invitation link is invalid', 400);
    const hashedToken = hashInvitationToken(rawToken);
    const tokenLimit = rateLimiter(`invite-accept-token:${hashedToken}`, { maxRequests: 5, windowMs: 60 * 60_000 });
    if (!tokenLimit.allowed) return jsonError('Too many attempts for this invitation. Please try again later.', 429);

    const authorization = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const actor = authorization ? await verifyToken(authorization) : null;
    if (authorization && (!actor?.userId || !actor.sid || actor.apiKeyId)) {
      return jsonError('Please sign in with a user account before accepting this invitation', 401);
    }

    const snapshot = await db.invitation.findUnique({
      where: { token: hashedToken },
      include: { company: { select: { id: true, name: true, plan: true, isActive: true } } },
    });
    if (!snapshot || snapshot.acceptedAt) return jsonError('Invitation is invalid or has already been used', 404);
    if (snapshot.expiresAt <= new Date()) return jsonError('This invitation has expired', 410);
    if (!snapshot.company.isActive) return jsonError('This workspace is not active', 410);
    if (!INVITABLE_ROLES.has(snapshot.role)) return jsonError('This invitation has an unsupported role', 400);

    const normalizedEmail = snapshot.email.trim().toLowerCase();
    if (actor) {
      const actorUser = await db.user.findUnique({ where: { id: actor.userId }, select: { id: true, email: true, name: true, isActive: true, isSuperAdmin: true } });
      if (!actorUser?.isActive) return jsonError('Account is not active', 403);
      if (actorUser.email.trim().toLowerCase() !== normalizedEmail) {
        return jsonError(`Sign in with the invited address ${normalizedEmail}`, 403);
      }
    } else {
      const existingUser = await db.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
      if (existingUser) return jsonError('An account already exists for this email. Sign in with that account to accept the invitation.', 409);

      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!name || name.length > 120) return jsonError('Name must be between 1 and 120 characters', 400);
      if (password.length < 12 || password.length > 128) return jsonError('Password must be between 12 and 128 characters', 400);
    }

    const passwordHash = actor ? null : await hashPassword(body.password);
    const now = new Date();
    const sessionMetadata = getSessionMetadata(req);

    const result = await db.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { id: snapshot.id },
        include: { company: { select: { id: true, name: true, plan: true, isActive: true } } },
      });
      if (!invitation || invitation.token !== hashedToken || invitation.acceptedAt) {
        throw new InvitationFlowError('Invitation is invalid or has already been used', 409);
      }
      if (invitation.expiresAt <= now || !invitation.company.isActive) {
        throw new InvitationFlowError('This invitation has expired or the workspace is inactive', 410);
      }

      let user;
      if (actor) {
        user = await tx.user.findUnique({ where: { id: actor.userId }, select: { id: true, email: true, name: true, avatar: true, isActive: true, isSuperAdmin: true } });
        if (!user?.isActive || user.email.trim().toLowerCase() !== normalizedEmail) {
          throw new InvitationFlowError('Sign in with the invited email address to accept this invitation', 403);
        }
      } else {
        const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
        if (existingUser) throw new InvitationFlowError('An account already exists for this email. Sign in to accept the invitation.', 409);
        const name = body.name.trim();
        user = await tx.user.create({ data: { email: normalizedEmail, name, passwordHash: passwordHash! } });
      }

      const currentMembership = await tx.companyUser.findFirst({
        where: { userId: user.id, companyId: invitation.companyId },
        select: { role: true },
      });
      const role = currentMembership?.role || invitation.role;
      if (!currentMembership) {
        await tx.companyUser.create({ data: { userId: user.id, companyId: invitation.companyId, role } });
      }

      const accepted = await tx.invitation.updateMany({
        where: { id: invitation.id, token: hashedToken, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (accepted.count !== 1) throw new InvitationFlowError('Invitation has already been accepted or expired', 409);

      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
      const session = await tx.userSession.create({
        data: { userId: user.id, ...sessionMetadata },
        select: { id: true },
      });
      const sessionToken = await createToken({
        userId: user.id,
        email: user.email,
        role: user.isSuperAdmin ? 'super_admin' : role,
        companyId: invitation.companyId,
        sessionId: session.id,
      });

      await tx.auditLog.create({
        data: {
          action: 'accept_invitation',
          resource: `Invitation: ${normalizedEmail}`,
          details: `Joined workspace as ${ROLE_LABELS[role] || role}`,
          userId: user.id,
          companyId: invitation.companyId,
        },
      });

      return {
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.isSuperAdmin ? 'super_admin' : role,
          companyId: invitation.companyId,
          companyName: invitation.company.name,
          institutionId: '',
          institutionName: '',
          isSuperAdmin: user.isSuperAdmin,
          plan: invitation.company.plan,
        },
      };
    });

    return NextResponse.json({ accepted: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof InvitationFlowError) return jsonError(error.message, error.status);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return jsonError('An account with this email already exists. Sign in to accept the invitation.', 409);
    }
    console.error('[POST /api/team/accept]', error);
    return jsonError('Unable to accept this invitation', 500);
  }
}
