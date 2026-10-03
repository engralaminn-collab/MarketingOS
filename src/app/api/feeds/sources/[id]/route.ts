import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const source = await db.feedSource.findFirst({
      where: { id, companyId: payload.companyId },
    });
    if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // FeedItem rows cascade-delete via the schema
    await db.feedSource.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[DELETE /api/feeds/sources/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete feed source' }, { status: 500 });
  }
}
