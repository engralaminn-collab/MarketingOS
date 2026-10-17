import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { id: otherUserId } = await params;
    if (!otherUserId || otherUserId === payload.userId) return NextResponse.json({ error: 'Invalid thread' }, { status: 400 });

    const member = await db.companyUser.findFirst({
      where: { companyId: payload.companyId, userId: otherUserId, user: { isActive: true } },
      select: { id: true },
    });
    if (!member) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: payload.userId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: payload.userId },
        ],
        sender: { companyUsers: { some: { companyId: payload.companyId } } },
        recipient: { companyUsers: { some: { companyId: payload.companyId } } },
      },
      include: { sender: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 5_000,
    });

    const unreadIds = messages.filter((message) => message.recipientId === payload.userId && !message.isRead).map((message) => message.id);
    if (unreadIds.length > 0) {
      await db.message.updateMany({
        where: { id: { in: unreadIds }, recipientId: payload.userId },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({
      data: messages.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        senderId: message.senderId,
        sender: message.sender,
        isRead: message.isRead || unreadIds.includes(message.id),
      })),
    });
  } catch (error) {
    console.error('[GET /api/messages/[id]]', error);
    return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 });
  }
}
