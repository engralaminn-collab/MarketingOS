import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createSessionToken, hashPassword, passwordNeedsUpgrade } from '@/lib/auth';
import { ipFromRequest, isSecureTransport, rateLimiter } from '@/lib/security';
import { clearLoginFailures, loginAccountHash, loginLockRemaining, recordLoginFailure } from '@/lib/login-lock';

export async function POST(req: NextRequest) {
  if (!isSecureTransport(req)) return NextResponse.json({ error: 'A secure HTTPS connection is required.' }, { status: 426 });
  const ip = ipFromRequest(req);
  const ipLimit = rateLimiter(`auth-login-ip:${ip}`, { maxRequests: 30, windowMs: 15 * 60_000 });
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterMs);

  try {
    const body = await req.json();
    // Existing clients send `email`; the versioned endpoint also accepts account_id.
    const rawAccount = typeof body?.account_id === 'string' ? body.account_id : body?.email;
    const accountId = typeof rawAccount === 'string' ? rawAccount.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!accountId || !password || accountId.length > 254 || password.length > 128) {
      return NextResponse.json({ error: 'Account ID and password are required' }, { status: 400 });
    }

    const accountLimit = rateLimiter(`auth-login-account:${loginAccountHash(accountId)}`, { maxRequests: 10, windowMs: 15 * 60_000 });
    if (!accountLimit.allowed) return tooManyRequests(accountLimit.retryAfterMs);

    // Phone numbers are supported only in unambiguous E.164 form. Duplicate phone
    // records fail closed rather than signing in as an arbitrary user.
    const isPhone = /^\+[1-9]\d{1,14}$/.test(accountId);
    const phoneUsers = isPhone ? await db.user.findMany({ where: { phone: accountId }, take: 2 }) : [];
    const user = isPhone
      ? (phoneUsers.length === 1 ? phoneUsers[0] : null)
      : await db.user.findUnique({ where: { email: accountId } });
    // Email and phone aliases for the same account share a lock.
    const accountHash = loginAccountHash(user ? `user:${user.id}` : `unknown:${accountId}`);
    const remaining = await loginLockRemaining(accountHash);
    if (remaining > 0) return tooManyRequests(remaining);

    // Keep unknown-user attempts close to the cost of a real bcrypt check.
    const valid = user?.isActive ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
    if (!valid || !user) {
      const lockMs = await recordLoginFailure(accountHash, user?.id || null);
      if (lockMs > 0) return tooManyRequests(lockMs);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    // A concurrent failure may have locked this account while bcrypt ran.
    const lockedAfterVerify = await loginLockRemaining(accountHash);
    if (lockedAfterVerify > 0) return tooManyRequests(lockedAfterVerify);

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

    await clearLoginFailures(accountHash);
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
    // Do not log exception details from a credential-bearing request.
    console.error('[POST /api/auth/login] sign-in failed');
    void error;
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 });
  }
}

function tooManyRequests(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait before trying again.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}
