import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, verifyPassword, hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both current and new passwords are required' }, { status: 400 });
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      return NextResponse.json({ error: 'New password must be between 12 and 128 characters' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.userSession.deleteMany({ where: { userId: user.id, ...(payload.sid ? { id: { not: payload.sid } } : {}) } }),
    ]);

    await db.auditLog.create({
      data: {
        action: 'password_change',
        resource: 'Account',
        details: 'Password changed; other active sessions revoked',
        userId: payload.userId,
        companyId: payload.companyId,
      },
    }).catch((error) => console.error('[password change] audit log failed:', error));

    return NextResponse.json({ success: true, revokedOtherSessions: true });
  } catch (error) {
    console.error('[POST /api/settings/security/password]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
