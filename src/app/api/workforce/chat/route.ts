import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { executeWithEmployee, getEmployee } from '@/lib/workforce/engine';

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const raw: unknown = await req.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
  const body = raw as Record<string, unknown>;
  const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const conversationId = body.conversationId === undefined || body.conversationId === null ? undefined : body.conversationId;
  if (!employeeId || employeeId.length > 128 || !message || message.length > 8_000 || (conversationId !== undefined && (typeof conversationId !== 'string' || conversationId.length > 128))) {
    return NextResponse.json({ error: 'Valid employeeId, message and conversationId are required.' }, { status: 400 });
  }
  try {
    const employee = await getEmployee(employeeId);
    if (!employee || employee.companyId !== actor.companyId) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    if (conversationId) {
      const conversation = await db.workforceConversation.findFirst({ where: { id: conversationId, companyId: actor.companyId, userId: actor.userId, employeeId: employee.id }, select: { id: true } });
      if (!conversation) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    await db.employee.update({ where: { id: employee.id }, data: { status: 'working', lastActiveAt: new Date() } });
    const startedAt = Date.now();
    try {
      const result = await executeWithEmployee(employeeId, message, conversationId, actor.companyId, actor.userId);
      return NextResponse.json({ response: result.response, conversationId: result.conversationId, employee: { id: employee.id, employeeId: employee.employeeId, name: result.employeeName, title: result.employeeTitle, avatar: employee.avatar }, modelUsed: result.model, provider: result.provider, tokensUsed: result.tokensUsed, latencyMs: Date.now() - startedAt });
    } finally {
      await db.employee.update({ where: { id: employee.id }, data: { status: 'idle' } }).catch(() => undefined);
    }
  } catch {
    return NextResponse.json({ error: 'Workforce chat failed. Check the configured model and try again.' }, { status: 500 });
  }
}
