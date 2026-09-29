import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/messages/[id] — list all messages in the thread between me and user [id]
// (where [id] is the OTHER user's id — we return every message exchanged with them)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: otherUserId } = await params;
    const meId = payload.userId;

    // Fetch all messages between me and otherUser
    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: meId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: meId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark inbound unread messages as read
    const unreadIds = messages.filter((m) => m.recipientId === meId && !m.isRead).map((m) => m.id);
    if (unreadIds.length > 0) {
      await db.message.updateMany({
        where: { id: { in: unreadIds } },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({
      data: messages.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
        sender: m.sender,
        isRead: m.isRead,
      })),
    });
  } catch (err) {
    console.error('[GET /api/messages/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 });
  }
}
