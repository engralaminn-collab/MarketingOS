import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { getEmployeeById } from '@/lib/workforce/engine';

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

    // Try engine first, fallback to direct DB query
    let employee = await getEmployeeById(id);

    if (!employee || employee.companyId !== companyId) {
      employee = await getEmployeeById(id);
    }

    if (!employee || employee.companyId !== companyId) {
      // Direct DB fallback
      const direct = await db.employee.findUnique({
        where: { id },
        include: {
          department: {
            select: {
              id: true, name: true, code: true, description: true,
              parentId: true, level: true, icon: true, color: true,
            },
          },
          reportsTo: {
            select: { id: true, employeeId: true, name: true, title: true },
          },
        },
      });
      if (!direct || direct.companyId !== companyId) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      employee = direct as typeof employee;
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get recent task executions (last 10)
    const recentExecutions = await db.taskExecution.findMany({
      where: { assignedEmployeeId: employee.id, companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        taskId: true,
        title: true,
        taskType: true,
        status: true,
        complexity: true,
        modelUsed: true,
        latencyMs: true,
        completedAt: true,
        createdAt: true,
      },
    });

    // Get KPI data
    const kpis = (() => {
      try { return JSON.parse(employee.kpis); } catch { return []; }
    })();
    const currentKpis = (() => {
      try { return JSON.parse(employee.currentKpis); } catch { return {}; }
    })();

    // Get memory summary counts by type
    const memoryCounts = await db.employeeMemory.groupBy({
      by: ['memoryType'],
      where: { employeeId: employee.id, companyId },
      _count: { id: true },
    });

    const memorySummary = memoryCounts.map((m) => ({
      type: m.memoryType,
      count: m._count.id,
    }));

    return NextResponse.json({
      employee,
      recentExecutions,
      kpis,
      currentKpis,
      memorySummary,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    const employee = await db.employee.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });

    if (!employee || employee.companyId !== companyId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.isEnabled === 'boolean') updateData.isEnabled = body.isEnabled;
    if (typeof body.isAvailable === 'boolean') updateData.isAvailable = body.isAvailable;
    if (typeof body.status === 'string') updateData.status = body.status;
    if (typeof body.name === 'string') updateData.name = body.name;
    if (typeof body.title === 'string') updateData.title = body.title;
    if (typeof body.mission === 'string') updateData.mission = body.mission;
    if (typeof body.preferredModel === 'string') updateData.preferredModel = body.preferredModel;
    if (typeof body.modelTier === 'string') updateData.modelTier = body.modelTier;

    if (body.kpis !== undefined) {
      updateData.kpis = typeof body.kpis === 'string' ? body.kpis : JSON.stringify(body.kpis);
    }
    if (body.currentKpis !== undefined) {
      updateData.currentKpis = typeof body.currentKpis === 'string' ? body.currentKpis : JSON.stringify(body.currentKpis);
    }
    if (body.skills !== undefined) {
      updateData.skills = typeof body.skills === 'string' ? body.skills : JSON.stringify(body.skills);
    }
    if (body.capabilities !== undefined) {
      updateData.capabilities = typeof body.capabilities === 'string' ? body.capabilities : JSON.stringify(body.capabilities);
    }
    if (body.tools !== undefined) {
      updateData.tools = typeof body.tools === 'string' ? body.tools : JSON.stringify(body.tools);
    }

    const updated = await db.employee.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ employee: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
