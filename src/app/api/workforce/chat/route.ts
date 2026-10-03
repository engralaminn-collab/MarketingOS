import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { executeWithEmployee, getEmployee } from '@/lib/workforce/engine';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const body = await req.json();
    const { employeeId, message, conversationId } = body;

    if (!employeeId || !message) {
      return NextResponse.json(
        { error: 'employeeId and message are required' },
        { status: 400 }
      );
    }

    // Verify the employee exists and belongs to this company
    const employee = await getEmployee(employeeId);
    if (!employee || employee.companyId !== companyId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Update employee status to working
    await db.employee.update({
      where: { id: employee.id },
      data: { status: 'working', lastActiveAt: new Date() },
    });

    const startTime = Date.now();

    // Use engine's executeWithEmployee
    const result = await executeWithEmployee(
      employeeId,
      message,
      conversationId || undefined,
      companyId
    );

    const latencyMs = Date.now() - startTime;

    // Update employee back to idle
    await db.employee.update({
      where: { id: employee.id },
      data: { status: 'idle' },
    });

    // Update conversation with userId if this was a new conversation
    if (!conversationId) {
      await db.workforceConversation.update({
        where: { id: result.conversationId },
        data: { userId: payload.userId, totalTokens: latencyMs },
      });
    }

    // Get model info used
    const modelUsed = employee.preferredModel || employee.modelTier || 'balanced';

    return NextResponse.json({
      response: result.response,
      conversationId: result.conversationId,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: result.employeeName,
        title: result.employeeTitle,
        avatar: employee.avatar,
      },
      modelUsed,
      tokensUsed: latencyMs,
    });
  } catch (error: unknown) {
    console.error('[POST /api/workforce/chat] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
