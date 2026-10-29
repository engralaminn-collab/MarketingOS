import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/social/inbox — unified social media inbox
// Returns all messages from all platforms + CRM tickets + internal messages in one view
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId || !payload.userId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const companyMembers = await db.companyUser.findMany({ where: { companyId: payload.companyId }, select: { userId: true } });
    const companyMemberIds = companyMembers.map((membership) => membership.userId);

    // Get CRM tickets (as social conversations)
    const tickets = await db.ticket.findMany({
      where: { companyId: payload.companyId, status: { in: ['open', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
    });

    // Get internal messages (team conversations)
    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: payload.userId, recipientId: { in: companyMemberIds } },
          { recipientId: payload.userId, senderId: { in: companyMemberIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Get SMS messages
    const smsMessages = await db.smsMessage.findMany({
      // Legacy OTP rows contain raw codes; never expose them in inboxes.
      where: { companyId: payload.companyId, OR: [{ providerMessageId: null }, { NOT: { providerMessageId: { startsWith: 'otp_' } } }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get social accounts (connected platforms)
    const socialAccounts = await db.socialAccount.findMany({
      where: { companyId: payload.companyId, status: 'active', accessToken: { startsWith: 'enc:v1:' } },
      select: { platform: true, accountName: true, status: true },
    });

    // Combine all conversations into one inbox
    const inbox: any[] = [];

    // Add tickets
    for (const t of tickets) {
      inbox.push({
        id: t.id,
        type: 'ticket',
        platform: 'crm',
        subject: t.subject,
        snippet: t.description?.slice(0, 100) || '',
        priority: t.priority,
        status: t.status,
        unread: false,
        createdAt: t.createdAt.toISOString(),
        lastMessage: t.messages[0]?.content?.slice(0, 100) || null,
      });
    }

    // Add internal messages
    for (const m of messages) {
      inbox.push({
        id: m.id,
        type: 'message',
        platform: 'internal',
        subject: m.sender?.name || 'Unknown',
        snippet: m.content.slice(0, 100),
        priority: 'normal',
        status: m.isRead ? 'read' : 'unread',
        unread: !m.isRead,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
      });
    }

    // Add SMS messages
    for (const s of smsMessages) {
      inbox.push({
        id: s.id,
        type: 'sms',
        platform: 'sms',
        subject: s.to,
        snippet: s.body.slice(0, 100),
        priority: 'normal',
        status: s.providerMessageId?.startsWith('broadcast_') ? 'legacy_unverified' : s.status,
        unread: s.status === 'queued',
        createdAt: s.createdAt.toISOString(),
      });
    }

    // Sort by date
    inbox.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Stats
    const stats = {
      total: inbox.length,
      unread: inbox.filter(i => i.unread).length,
      tickets: tickets.length,
      messages: messages.filter(m => !m.isRead).length,
      sms: smsMessages.length,
      platforms: socialAccounts.map(a => ({ platform: a.platform, name: a.accountName, status: a.status })),
    };

    return NextResponse.json({ data: { inbox, stats } });
  } catch (err) {
    console.error('[GET /api/social/inbox]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
