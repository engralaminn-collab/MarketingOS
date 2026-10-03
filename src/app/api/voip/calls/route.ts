import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const calls = await db.smsMessage.findMany({ where: { companyId: payload.companyId, providerMessageId: { startsWith: 'voip_' } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ data: calls.map(c => ({ id: c.id, to: c.to, status: c.status, body: c.body, leadId: c.leadId, createdAt: c.createdAt.toISOString() })) });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
