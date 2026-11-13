import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';

/** Fail closed until consent, suppression and human approval are enforced. */
export async function rejectUnsafeOutbound(req: NextRequest, channel: 'SMS' | 'SMS broadcast' | 'voice call') {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ error: `${channel} is disabled: consent, opt-out suppression and approved outbound delivery are not implemented. Nothing was sent or queued.` }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

/** The previous OTP implementation stored and returned the code and never sent it. */
export async function rejectUnsafeOtp(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ error: 'SMS OTP is unavailable. Use a trusted provider directly; no code was generated, sent, stored or verified.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
