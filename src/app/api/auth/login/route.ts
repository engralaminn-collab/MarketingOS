import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createToken, hashPassword, passwordNeedsUpgrade } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Transparent password upgrade: re-hash with bcrypt if legacy
    if (passwordNeedsUpgrade(user.passwordHash)) {
      const newHash = await hashPassword(password);
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    const companyUser = await db.companyUser.findFirst({
      where: { userId: user.id },
      include: { company: true },
    });

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: companyUser?.role || 'viewer',
      companyId: companyUser?.companyId || '',
    });

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        action: 'user.login',
        resource: 'auth',
        details: `${user.name} logged in`,
        userId: user.id,
        companyId: companyUser?.companyId,
      },
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: companyUser?.role || 'viewer',
        companyId: companyUser?.companyId || '',
        companyName: companyUser?.company.name || '',
        plan: companyUser?.company.plan || 'free',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
