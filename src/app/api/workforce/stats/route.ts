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

    // Run all queries in parallel for performance
    const [
      totalEmployees,
      activeEmployees,
      workingEmployees,
      busyEmployees,
      offlineEmployees,
      totalDepartments,
      totalTasks,
      completedTasks,
      failedTasks,
      pendingTasks,
      runningTasks,
      totalConversations,
      totalKnowledgeNodes,
      totalSops,
      totalMemories,
      employeesByLevel,
      employeesByDepartment,
      topPerformers,
      recentActivity,
    ] = await Promise.all([
      // Employee counts
      db.employee.count({ where: { companyId, isEnabled: true } }),
      db.employee.count({ where: { companyId, isEnabled: true, isAvailable: true, status: 'idle' } }),
      db.employee.count({ where: { companyId, isEnabled: true, status: 'working' } }),
      db.employee.count({ where: { companyId, isEnabled: true, status: 'busy' } }),
      db.employee.count({ where: { companyId, isEnabled: true, status: 'offline' } }),

      // Department count
      db.department.count({ where: { companyId } }),

      // Task counts
      db.taskExecution.count({ where: { companyId } }),
      db.taskExecution.count({ where: { companyId, status: 'completed' } }),
      db.taskExecution.count({ where: { companyId, status: 'failed' } }),
      db.taskExecution.count({ where: { companyId, status: 'pending' } }),
      db.taskExecution.count({ where: { companyId, status: 'running' } }),

      // Conversations
      db.workforceConversation.count({ where: { companyId } }),

      // Knowledge
      db.knowledgeNode.count({ where: { companyId } }),
      db.sop.count({ where: { companyId } }),
      db.employeeMemory.count({ where: { companyId } }),

      // Employee by level
      db.employee.groupBy({
        by: ['level'],
        where: { companyId, isEnabled: true },
        _count: { id: true },
      }),

      // Employee by department
      db.employee.findMany({
        where: { companyId, isEnabled: true },
        select: {
          department: { select: { id: true, name: true, code: true, color: true, icon: true } },
        },
      }),

      // Top performers (by completed tasks)
      db.employee.findMany({
        where: { companyId, isEnabled: true, completedTasks: { gt: 0 } },
        select: {
          id: true, employeeId: true, name: true, title: true, avatar: true,
          level: true, successRate: true, completedTasks: true, avgLatencyMs: true,
          department: { select: { id: true, name: true, code: true, color: true } },
        },
        orderBy: { completedTasks: 'desc' },
        take: 10,
      }),

      // Recent activity (last 20 task executions)
      db.taskExecution.findMany({
        where: { companyId },
        include: {
          assignedEmployee: {
            select: { id: true, employeeId: true, name: true, title: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Compute success rate and avg latency from completed tasks
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let avgLatencyMs = 0;
    if (completedTasks > 0) {
      const latencyResult = await db.taskExecution.aggregate({
        where: { companyId, status: 'completed', latencyMs: { gt: 0 } },
        _avg: { latencyMs: true },
      });
      avgLatencyMs = Math.round(latencyResult._avg.latencyMs || 0);
    }

    // Compute department distribution
    const deptMap = new Map<string, { department: string; code: string; count: number; color: string | null; icon: string | null }>();
    for (const emp of employeesByDepartment) {
      if (!emp.department) continue;
      const key = emp.department.id;
      const existing = deptMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        deptMap.set(key, {
          department: emp.department.name,
          code: emp.department.code,
          count: 1,
          color: emp.department.color,
          icon: emp.department.icon,
        });
      }
    }

    return NextResponse.json({
      employees: {
        total: totalEmployees,
        active: activeEmployees,
        working: workingEmployees,
        busy: busyEmployees,
        offline: offlineEmployees,
        disabled: totalEmployees - activeEmployees - workingEmployees - busyEmployees - offlineEmployees,
      },
      employeesByLevel: employeesByLevel.map((e) => ({
        level: e.level,
        count: e._count.id,
      })),
      employeesByDepartment: Array.from(deptMap.values()),
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
        pending: pendingTasks,
        running: runningTasks,
        successRate,
      },
      avgLatencyMs,
      departments: {
        total: totalDepartments,
      },
      conversations: {
        total: totalConversations,
      },
      knowledge: {
        nodes: totalKnowledgeNodes,
        sops: totalSops,
        memories: totalMemories,
      },
      topPerformers,
      recentActivity,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
