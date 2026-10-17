import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid or revoked session' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const companyId = typeof payload.companyId === 'string' ? payload.companyId : '';
    const companyUser = companyId
      ? await db.companyUser.findFirst({ where: { userId: user.id, companyId }, include: { company: true } })
      : null;
    const institution = user.institutionId
      ? await db.institution.findUnique({ where: { id: user.institutionId } })
      : null;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: payload.role,
        companyId: companyUser?.companyId || '',
        companyName: companyUser?.company.name || '',
        institutionId: institution?.id || '',
        institutionName: institution?.name || '',
        isSuperAdmin: user.isSuperAdmin || payload.role === 'super_admin',
        plan: companyUser?.company.plan || 'free',
      },
    });
  } catch (error) {
    console.error('[GET /api/auth/me]', error);
    return NextResponse.json({ error: 'Unable to load session' }, { status: 500 });
  }
}
