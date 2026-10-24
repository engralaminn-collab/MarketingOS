import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const allMessages = await db.message.findMany({
      where: {
        OR: [
          { senderId: payload.userId, recipient: { companyUsers: { some: { companyId: payload.companyId } } } },
          { recipientId: payload.userId, sender: { companyUsers: { some: { companyId: payload.companyId } } } },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
        recipient: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5_000,
    });

    const threadMap = new Map<string, { otherUser: unknown; lastMessage: unknown; unreadCount: number }>();
    for (const message of allMessages) {
      const otherUserId = message.senderId === payload.userId ? message.recipientId : message.senderId;
      const otherUser = message.senderId === payload.userId ? message.recipient : message.sender;
      const existing = threadMap.get(otherUserId);
      const contributesUnread = message.recipientId === payload.userId && !message.isRead;
      if (!existing) {
        threadMap.set(otherUserId, {
          otherUser,
          lastMessage: {
            id: message.id,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
            isRead: message.isRead,
            senderId: message.senderId,
          },
          unreadCount: contributesUnread ? 1 : 0,
        });
      } else if (contributesUnread) {
        existing.unreadCount++;
      }
    }

    return NextResponse.json({ data: Array.from(threadMap.values()) });
  } catch (error) {
    console.error('[GET /api/messages]', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.userId || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const senderId = payload.userId;
    const companyId = payload.companyId;

    const body = await req.json();
    if (!Array.isArray(body?.recipientIds) || body.recipientIds.length === 0 || body.recipientIds.length > 50) {
      return NextResponse.json({ error: 'recipientIds must contain between 1 and 50 user IDs' }, { status: 400 });
    }
    if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 10_000) {
      return NextResponse.json({ error: 'Message content must contain 1 to 10,000 characters' }, { status: 400 });
    }

    const rawRecipientIds: unknown[] = Array.isArray(body.recipientIds) ? body.recipientIds : [];
    const recipientIds: string[] = Array.from(
      new Set(rawRecipientIds.filter((id): id is string => typeof id === 'string' && id.length <= 64)),
    );
    if (recipientIds.length !== rawRecipientIds.length || recipientIds.includes(senderId)) {
      return NextResponse.json({ error: 'Recipient list is invalid' }, { status: 400 });
    }

    const authorizedRecipients = await db.companyUser.findMany({
      where: {
        companyId,
        userId: { in: recipientIds },
        user: { isActive: true },
      },
      select: { userId: true },
    });
    if (authorizedRecipients.length !== recipientIds.length) {
      return NextResponse.json({ error: 'One or more recipients are not active members of this company' }, { status: 404 });
    }

    const content = body.content.trim();
    const messages = await db.$transaction((tx) => Promise.all(
      recipientIds.map((recipientId) => tx.message.create({
        data: { content, senderId, recipientId, isRead: false },
        include: {
          sender: { select: { id: true, name: true, email: true, avatar: true } },
          recipient: { select: { id: true, name: true, email: true, avatar: true } },
        },
      })),
    ));

    await Promise.all(messages.map((message) => emitEvent({
      companyId,
      userId: senderId,
      type: 'message.sent',
      title: 'New message',
      description: `${message.sender.name} sent you a message: "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
      resourceType: 'message',
      resourceId: message.id,
      link: '/messages',
      recipientIds: [message.recipientId],
      metadata: { content },
    })));

    return NextResponse.json({ data: messages }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/messages]', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
