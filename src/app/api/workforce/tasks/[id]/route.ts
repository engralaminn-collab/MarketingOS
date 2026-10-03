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

    const execution = await db.taskExecution.findUnique({
      where: { id },
      include: {
        assignedEmployee: {
          select: {
            id: true, employeeId: true, name: true, title: true, avatar: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Task execution not found' }, { status: 404 });
    }

    if (execution.companyId !== companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ execution });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
