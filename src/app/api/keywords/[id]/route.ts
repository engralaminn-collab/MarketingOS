import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (!hasPermission(payload.role, 'seo_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.keywordTracker.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.keywordTracker.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[DELETE /api/keywords/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 });
  }
}
