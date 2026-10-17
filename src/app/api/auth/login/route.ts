import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createSessionToken, hashPassword, passwordNeedsUpgrade } from '@/lib/auth';
import { ipFromRequest, rateLimiter } from '@/lib/security';

export async function POST(req: NextRequest) {
  const ip = ipFromRequest(req);
  const ipLimit = rateLimiter(`auth-login-ip:${ip}`, { maxRequests: 30, windowMs: 15 * 60_000 });
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterMs);

  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password || email.length > 254 || password.length > 128) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const emailLimit = rateLimiter(`auth-login-email:${email}`, { maxRequests: 10, windowMs: 15 * 60_000 });
    if (!emailLimit.allowed) return tooManyRequests(emailLimit.retryAfterMs);

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      // Keep unknown-user attempts close to the cost of a real bcrypt check.
      await hashPassword(password);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    if (passwordNeedsUpgrade(user.passwordHash)) {
      const upgradedHash = await hashPassword(password);
      await db.user.update({ where: { id: user.id }, data: { passwordHash: upgradedHash } });
    }

    const companyUser = await db.companyUser.findFirst({
      where: { userId: user.id },
      include: { company: true },
      orderBy: { joinedAt: 'asc' },
    });
    const institution = !companyUser && user.institutionId
      ? await db.institution.findUnique({ where: { id: user.institutionId } })
      : null;

    if (companyUser && !companyUser.company.isActive) {
      return NextResponse.json({ error: 'This company account is inactive' }, { status: 403 });
    }
    if (!companyUser && (!institution?.isActive || !user.institutionId)) {
      return NextResponse.json({ error: 'This account is not assigned to an active company or institution' }, { status: 403 });
    }

    const role = user.isSuperAdmin ? 'super_admin' : companyUser?.role || user.role;
    const { token } = await createSessionToken(req, {
      userId: user.id,
      email: user.email,
      role,
      companyId: companyUser?.companyId || '',
      institutionId: user.institutionId || '',
    });

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    if (companyUser) {
      await db.auditLog.create({
        data: {
          action: 'user.login',
          resource: 'auth',
          details: `${user.name} logged in`,
          userId: user.id,
          companyId: companyUser.companyId,
        },
      }).catch((error) => console.error('[auth/login] audit log failed:', error));
    }

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role,
        companyId: companyUser?.companyId || '',
        companyName: companyUser?.company.name || '',
        institutionId: user.institutionId || '',
        institutionName: institution?.name || '',
        isSuperAdmin: user.isSuperAdmin || role === 'super_admin',
        plan: companyUser?.company.plan || 'free',
      },
    });
  } catch (error) {
    console.error('[POST /api/auth/login]', error);
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 });
  }
}

function tooManyRequests(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait before trying again.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}
