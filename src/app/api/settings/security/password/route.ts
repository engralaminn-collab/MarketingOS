import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, verifyPassword, hashPassword } from '@/lib/auth';

// POST /api/settings/security/password — change current user's password
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both currentPassword and newPassword are required' }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

    const newHash = await hashPassword(String(newPassword));
    await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

    await db.auditLog.create({
      data: {
        action: 'password_change',
        resource: 'Account',
        details: 'Password changed',
        userId: payload.userId,
        companyId: payload.companyId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/settings/security/password]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
