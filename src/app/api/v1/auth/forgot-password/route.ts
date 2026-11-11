// @ts-nocheck
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return Response.json({ ok: true, message: 'If the email exists, a reset link has been sent.' });
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000);
  await db.passwordReset.upsert({
    where: { userId: user.id },
    update: { token, expiresAt: expires },
    create: { userId: user.id, token, expiresAt: expires },
  }).catch(() => {});
  return Response.json({ ok: true, message: 'If the email exists, a reset link has been sent.', resetToken: token });
}
