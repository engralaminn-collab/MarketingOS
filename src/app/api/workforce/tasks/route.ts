import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { routeTask } from '@/lib/workforce/engine';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(payload.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const companyId = payload.companyId;
    if (!companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const body = await req.json();
    const { title, description, type, complexity } = body;

    if (typeof title !== 'string' || !title.trim() || title.length > 160 || typeof description !== 'string' || !description.trim() || description.length > 8_000 || typeof type !== 'string' || !type.trim() || type.length > 64 || (complexity !== undefined && !['simple', 'standard', 'complex', 'enterprise'].includes(complexity))) {
      return NextResponse.json(
        { error: 'title, description, and type are required' },
        { status: 400 }
      );
    }

    // Use the engine's routeTask
    const result = await routeTask({
      title,
      description,
      type,
      complexity: complexity || undefined,
      companyId,
      userId: payload.userId,
    });

    // Fetch the full execution record from DB
    const execution = await db.taskExecution.findUnique({
      where: { taskId: result.executionId },
      include: {
        assignedEmployee: {
          select: {
            id: true, employeeId: true, name: true, title: true, avatar: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return NextResponse.json({ execution, result });
  } catch (error: unknown) {
    console.error('[POST /api/workforce/tasks] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const status = searchParams.get('status') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const taskType = searchParams.get('taskType') || undefined;
    const complexity = searchParams.get('complexity') || undefined;

    const where: Record<string, unknown> = { companyId };

    if (status) where.status = status;
    if (taskType) where.taskType = taskType;
    if (complexity) where.complexity = complexity;

    if (employeeId) {
      // Resolve employeeId (which could be the employeeId string or the DB id)
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
      if (emp) {
        where.assignedEmployeeId = emp.id;
      }
    }

    const [executions, total] = await Promise.all([
      db.taskExecution.findMany({
        where,
        include: {
          assignedEmployee: {
            select: {
              id: true, employeeId: true, name: true, title: true, avatar: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.taskExecution.count({ where }),
    ]);

    return NextResponse.json({
      executions,
      total,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
