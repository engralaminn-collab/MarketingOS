import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { type, status } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;

    const content = await db.content.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const data = await req.json();
    // Prisma stores engagement as String, so JSON.stringify objects
    const createData: any = { ...data, creatorId: payload.userId, companyId: payload.companyId };
    if (data.engagement && typeof data.engagement === 'object') {
      createData.engagement = JSON.stringify(data.engagement);
    }
    if (data.scheduledAt) createData.scheduledAt = new Date(data.scheduledAt);
    if (data.publishedAt) createData.publishedAt = new Date(data.publishedAt);
    createData.aiGenerated = data.aiGenerated || false;
    const content = await db.content.create({ data: createData });

    // Fire event: content created (or content.published if status=published)
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: content.status === 'published' ? 'content.published' : 'content.created',
      title: content.status === 'published' ? 'Content published' : 'New content created',
      description: `"${content.title}" (${content.type}${content.platform ? ', ' + content.platform : ''})`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { title: content.title, type: content.type, platform: content.platform, status: content.status },
    });

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
