// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const { token, newPassword } = await request.json();
  if (!token || !newPassword || newPassword.length < 8) return Response.json({ error: 'Token and password (min 8 chars) required' }, { status: 400 });
  const reset = await db.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.expiresAt < new Date()) return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
  const hash = await hashPassword(newPassword);
  await db.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } });
  await db.passwordReset.delete({ where: { id: reset.id } });
  return Response.json({ ok: true, message: 'Password reset successful' });
}
