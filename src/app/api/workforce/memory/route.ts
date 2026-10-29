import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const params = new URL(req.url).searchParams;
  const employeeId = params.get('employeeId') || '';
  const rawLimit = Number(params.get('limit') || '20');
  const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 100)) : 20;
  if (!employeeId || employeeId.length > 128) return NextResponse.json({ error: 'employeeId is required.' }, { status: 400 });
  try {
    const emp = await db.employee.findFirst({ where: { companyId: actor.companyId, OR: [{ id: employeeId }, { employeeId }] }, select: { id: true } });
    if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    const memories = await db.employeeMemory.findMany({
      where: { companyId: actor.companyId, employeeId: emp.id, ...(params.get('type') ? { memoryType: params.get('type')! } : {}) },
      orderBy: { updatedAt: 'desc' }, take: limit,
    });
    return NextResponse.json({ memories, note: 'Only approved, unexpired memories may be used by the workforce.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Could not fetch memories.' }, { status: 500 }); }
}
