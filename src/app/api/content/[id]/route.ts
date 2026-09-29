import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// PATCH /api/content/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const existing = await db.content.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const update: any = {};
    const allowedFields = ['title', 'type', 'status', 'platform', 'body', 'mediaUrl', 'mediaType', 'thumbnailUrl', 'hashtags', 'scheduledAt', 'publishedAt', 'campaignId'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'scheduledAt' || field === 'publishedAt') {
          update[field] = data[field] ? new Date(data[field]) : null;
        } else {
          update[field] = data[field];
        }
      }
    }
    if (data.engagement !== undefined) {
      update.engagement = JSON.stringify(data.engagement);
    }

    const content = await db.content.update({ where: { id }, data: update });
    return NextResponse.json({ content });
  } catch (err) {
    console.error('[PATCH /api/content/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/content/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id } = await params;
    const existing = await db.content.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.content.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/content/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
