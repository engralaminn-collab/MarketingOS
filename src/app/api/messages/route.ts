import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/messages — list current user's threads (most recent message per partner)
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Get all messages where I'm sender or recipient
    const allMessages = await db.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
        recipient: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group into threads — one thread per "other user"
    const threadMap = new Map<string, {
      otherUser: any;
      lastMessage: any;
      unreadCount: number;
    }>();

    for (const msg of allMessages) {
      const otherUserId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      const otherUser = msg.senderId === userId ? msg.recipient : msg.sender;
      const existing = threadMap.get(otherUserId);

      // unreadCount = messages where I'm the recipient and isRead is false
      const contributesUnread = msg.recipientId === userId && !msg.isRead;

      if (!existing) {
        threadMap.set(otherUserId, {
          otherUser,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
            isRead: msg.isRead,
            senderId: msg.senderId,
          },
          unreadCount: contributesUnread ? 1 : 0,
        });
      } else {
        if (contributesUnread) existing.unreadCount++;
        // lastMessage is the most recent (since we sorted desc)
      }
    }

    // Return as array sorted by lastMessage createdAt desc (already in that order due to SQL ORDER BY)
    return NextResponse.json({
      data: Array.from(threadMap.values()),
    });
  } catch (err) {
    console.error('[GET /api/messages]', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/messages — send a message to one or more recipients
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { recipientIds, content } = body;
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: 'recipientIds array is required' }, { status: 400 });
    }
    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Create one message per recipient
    const messages = await Promise.all(
      recipientIds.map((recipientId: string) =>
        db.message.create({
          data: {
            content: String(content),
            senderId: payload.userId,
            recipientId,
            isRead: false,
          },
          include: {
            sender: { select: { id: true, name: true, email: true, avatar: true } },
            recipient: { select: { id: true, name: true, email: true, avatar: true } },
          },
        }),
      ),
    );

    // Fire notification + activity + webhook for each message
    for (const msg of messages) {
      await emitEvent({
        companyId: payload.companyId,
        userId: payload.userId,
        type: 'message.sent',
        title: 'New message',
        description: `${msg.sender.name} sent you a message: "${msg.content.slice(0, 60)}${msg.content.length > 60 ? '...' : ''}"`,
        resourceType: 'message',
        resourceId: msg.id,
        link: '/messages',
        recipientIds: [msg.recipientId],
        metadata: { content: msg.content },
      });
    }

    return NextResponse.json({ data: messages }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/messages]', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
