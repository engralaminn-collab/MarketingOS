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
    const department = searchParams.get('department') || undefined;
    const level = searchParams.get('level') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    // Build where clause
    const where: Record<string, unknown> = { companyId };

    if (department) {
      where.departmentId = department;
    }
    if (level) {
      where.level = level;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { title: { contains: search } },
        { employeeId: { contains: search } },
        { skills: { contains: search } },
      ];
    }

    // Build orderBy
    const orderBy: Record<string, string> = {};
    if (['name', 'title', 'level', 'status', 'totalTasks', 'completedTasks', 'successRate', 'avgLatencyMs', 'createdAt', 'lastActiveAt'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.createdAt = 'asc';
    }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true,
              parentId: true,
              level: true,
              icon: true,
              color: true,
            },
          },
          reportsTo: {
            select: {
              id: true,
              employeeId: true,
              name: true,
              title: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.employee.count({ where }),
    ]);

    return NextResponse.json({
      employees,
      total,
      page,
      limit,
      filters: { department, level, status, search, sortBy, sortOrder },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
