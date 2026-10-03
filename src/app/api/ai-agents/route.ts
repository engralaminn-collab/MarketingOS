import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const agents = await db.aiAgent.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ agents });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id, isEnabled } = await req.json();
    const agent = await db.aiAgent.update({
      where: { id, companyId: payload.companyId },
      data: { isEnabled },
    });

    return NextResponse.json({ agent });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}