// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, createToken } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email || !password) return Response.json({ error: 'Email and password required' }, { status: 400 });
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  const companyUser = await db.companyUser.findFirst({ where: { userId: user.id }, include: { company: true } });
  const token = await createToken({ userId: user.id, email: user.email, role: companyUser?.role || 'team_member', companyId: companyUser?.companyId || '' });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return Response.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: companyUser?.role, companyId: companyUser?.companyId, companyName: companyUser?.company?.name } });
}
