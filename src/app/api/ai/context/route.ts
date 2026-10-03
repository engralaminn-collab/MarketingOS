import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const messages = await db.aiChatMessage.findMany({ where: { userId: payload.userId }, orderBy: { createdAt: 'desc' }, take: 20 });
    const companyUser = await db.companyUser.findFirst({ where: { userId: payload.userId }, include: { company: true } });
    return NextResponse.json({ data: { messageCount: messages.length, recentMessages: messages.reverse().map(m => ({ role: m.role, content: m.content.slice(0, 200) })), company: companyUser?.company ? { name: companyUser.company.name, industry: companyUser.company.industry } : null } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
