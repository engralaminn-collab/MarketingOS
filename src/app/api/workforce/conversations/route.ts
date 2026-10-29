import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const employeeId = searchParams.get('employeeId') || undefined;

    const where: Record<string, unknown> = { companyId, userId: payload.userId };

    if (employeeId) {
      // Resolve employee by employeeId string or DB id
      const emp = await db.employee.findFirst({
        where: {
          companyId,
          OR: [
            { id: employeeId },
            { employeeId },
          ],
        },
        select: { id: true },
      });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      where.employeeId = emp.id;
    }

    const [conversations, total] = await Promise.all([
      db.workforceConversation.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true, employeeId: true, name: true, title: true, avatar: true,
              department: { select: { id: true, name: true, code: true, color: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.workforceConversation.count({ where }),
    ]);

    // Parse last message for preview (don't send full messages in list)
    const conversationsWithPreview = conversations.map((conv) => {
      let lastMessage: { role: string; content: string; timestamp?: string } | null = null;
      try {
        const messages = JSON.parse(conv.messages);
        if (Array.isArray(messages) && messages.length > 0) {
          lastMessage = messages[messages.length - 1];
        }
      } catch {
        // ignore
      }

      return {
        id: conv.id,
        employee: conv.employee,
        messageCount: conv.messageCount,
        totalTokens: conv.totalTokens,
        lastMessage: lastMessage
          ? { role: lastMessage.role, content: lastMessage.content.substring(0, 200), timestamp: lastMessage.timestamp }
          : null,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    return NextResponse.json({
      conversations: conversationsWithPreview,
      total,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
