import { createHmac } from 'node:crypto';
import { db } from '@/lib/db';

// One attempt plus three retries, then a temporary account lock.
const MAX_FAILURES = 4;
const LOCK_MS = 15 * 60_000;

/** Stable opaque key: neither an account identifier nor a password is persisted. */
export function loginAccountHash(identifier: string): string {
  const key = process.env.JWT_SECRET || 'dev-only-jwt-secret-do-not-use-in-prod';
  return createHmac('sha256', key).update(identifier).digest('hex');
}

export async function loginLockRemaining(accountHash: string, now = new Date()): Promise<number> {
  const attempt = await db.authLoginAttempt.findUnique({ where: { accountHash } });
  if (!attempt) return 0;
  const remaining = attempt.lockedUntil ? attempt.lockedUntil.getTime() - now.getTime() : 0;
  if (remaining > 0) return remaining;
  if ((attempt.lockedUntil && remaining <= 0) || now.getTime() - attempt.updatedAt.getTime() >= LOCK_MS) {
    // The predicates avoid deleting a concurrently renewed lock or failure.
    await db.authLoginAttempt.deleteMany({
      where: { accountHash, updatedAt: attempt.updatedAt },
    });
  }
  return 0;
}

/** Record a failed login and notify the affected company's admins only on transition to locked. */
export async function recordLoginFailure(accountHash: string, userId: string | null): Promise<number> {
  const now = new Date();
  const attempt = await db.authLoginAttempt.upsert({
    where: { accountHash },
    create: { accountHash, failures: 1 },
    update: { failures: { increment: 1 } },
  });
  if (attempt.lockedUntil && attempt.lockedUntil.getTime() > now.getTime()) {
    return attempt.lockedUntil.getTime() - now.getTime();
  }
  if (attempt.failures < MAX_FAILURES) return 0;

  const lockedUntil = new Date(now.getTime() + LOCK_MS);
  const locked = await db.authLoginAttempt.updateMany({
    where: { accountHash, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: { lockedUntil },
  });
  if (locked.count && userId) {
    // These are in-app notifications, not email. Unknown accounts do not notify anyone.
    const memberships = await db.companyUser.findMany({ where: { userId }, select: { companyId: true } });
    const companyIds = memberships.map((membership) => membership.companyId);
    if (companyIds.length) {
      const admins = await db.companyUser.findMany({
        where: { companyId: { in: companyIds }, user: { isActive: true }, OR: [{ role: { in: ['super_admin', 'superadmin', 'company_owner', 'admin'] } }, { user: { isSuperAdmin: true } }] },
        select: { userId: true },
      });
      const recipientIds = [...new Set(admins.map((admin) => admin.userId))];
      await db.$transaction([
        ...recipientIds.map((recipientId) => db.notification.create({
          data: {
            userId: recipientId,
            type: 'system',
            title: 'Temporary sign-in lock',
            message: 'A company account was temporarily locked after repeated failed sign-in attempts. Review the audit log.',
          },
        })),
        ...companyIds.map((companyId) => db.auditLog.create({
          data: { companyId, userId, action: 'user.login_locked', resource: 'auth', details: 'Account temporarily locked after repeated failed sign-in attempts.' },
        })),
      ]);
    }
  }
  return LOCK_MS;
}

export async function clearLoginFailures(accountHash: string): Promise<void> {
  await db.authLoginAttempt.deleteMany({ where: { accountHash, lockedUntil: null } });
}
