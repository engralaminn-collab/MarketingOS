import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const { id } = await context.params;

    const conversation = await db.workforceConversation.findFirst({
      where: { id, companyId, userId: payload.userId },
      include: {
        employee: {
          select: {
            id: true, employeeId: true, name: true, title: true, avatar: true,
            department: { select: { id: true, name: true, code: true, color: true } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.companyId !== companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse messages JSON
    let messages: unknown[] = [];
    try {
      messages = JSON.parse(conversation.messages);
    } catch {
      // keep empty array
    }

    // Parse context fields
    let skillsLoaded: string[] = [];
    let knowledgeLoaded: string[] = [];
    let memoryAccessed: string[] = [];
    let sopsLoaded: string[] = [];
    try { skillsLoaded = JSON.parse(conversation.skillsLoaded); } catch { /* keep */ }
    try { knowledgeLoaded = JSON.parse(conversation.knowledgeLoaded); } catch { /* keep */ }
    try { memoryAccessed = JSON.parse(conversation.memoryAccessed); } catch { /* keep */ }
    try { sopsLoaded = JSON.parse(conversation.sopsLoaded); } catch { /* keep */ }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        employee: conversation.employee,
        messageCount: conversation.messageCount,
        messages,
        skillsLoaded,
        knowledgeLoaded,
        memoryAccessed,
        sopsLoaded,
        taskContext: conversation.taskContext,
        totalTokens: conversation.totalTokens,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
