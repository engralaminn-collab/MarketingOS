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

    // Get all departments for this company
    const departments = await db.department.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        parentId: true,
        level: true,
        icon: true,
        color: true,
        sortOrder: true,
        _count: {
          select: { employees: { where: { isEnabled: true } } },
        },
      },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });

    // Aggregate stats per department from employees
    const empStats = await db.employee.findMany({
      where: { companyId, isEnabled: true },
      select: { departmentId: true, successRate: true, completedTasks: true },
    });

    const taskCountByDept = new Map<string, number>();
    const successSumByDept = new Map<string, number>();
    const successCountByDept = new Map<string, number>();

    for (const emp of empStats) {
      const deptId = emp.departmentId;
      taskCountByDept.set(deptId, (taskCountByDept.get(deptId) || 0) + emp.completedTasks);
      if (emp.successRate > 0) {
        successSumByDept.set(deptId, (successSumByDept.get(deptId) || 0) + emp.successRate);
        successCountByDept.set(deptId, (successCountByDept.get(deptId) || 0) + 1);
      }
    }

    // Build flat list with stats for tree building on frontend
    const departmentsWithStats = departments.map((dept) => {
      const totalTasks = taskCountByDept.get(dept.id) || 0;
      const successSum = successSumByDept.get(dept.id) || 0;
      const successCount = successCountByDept.get(dept.id) || 0;
      const avgSuccessRate = successCount > 0 ? Math.round(successSum / successCount) : 0;

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        parentId: dept.parentId,
        level: dept.level,
        icon: dept.icon,
        color: dept.color,
        sortOrder: dept.sortOrder,
        employeeCount: dept._count.employees,
        totalTasks,
        avgSuccessRate,
      };
    });

    return NextResponse.json({ departments: departmentsWithStats });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
