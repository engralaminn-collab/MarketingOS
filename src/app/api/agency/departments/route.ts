import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';

/**
 * GET /api/agency/departments
 * Departments with their runtime model profile, staffing, agent count and SOPs.
 * This is the "each department is its own model" view of the org.
 */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [departments, runtimes, employees, agents, sops] = await Promise.all([
    db.department.findMany({ where: { companyId: actor.companyId }, orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }] }),
    db.departmentRuntime.findMany(),
    db.employee.groupBy({ by: ['departmentId'], where: { companyId: actor.companyId }, _count: true }),
    db.agentSpec.groupBy({ by: ['departmentId'], where: { companyId: actor.companyId }, _count: true }),
    db.sop.groupBy({ by: ['departmentId'], where: { companyId: actor.companyId, isActive: true, departmentId: { not: null } }, _count: true }),
  ]);

  const runtimeByDept = new Map(runtimes.map((row) => [row.departmentId, row]));
  const employeesByDept = new Map(employees.map((row) => [row.departmentId, row._count]));
  const agentsByDept = new Map(agents.map((row) => [row.departmentId, row._count]));
  const sopsByDept = new Map(sops.map((row) => [row.departmentId, row._count]));

  const data = departments.map((dept) => {
    const runtime = runtimeByDept.get(dept.id);
    return {
      id: dept.id,
      name: dept.name,
      code: dept.code,
      level: dept.level,
      description: dept.description,
      color: dept.color,
      icon: dept.icon,
      parentId: dept.parentId,
      employees: employeesByDept.get(dept.id) ?? 0,
      agents: agentsByDept.get(dept.id) ?? 0,
      sops: sopsByDept.get(dept.id) ?? 0,
      runtime: runtime
        ? {
            modelName: runtime.modelName,
            modelTier: runtime.modelTier,
            provider: runtime.provider,
            isolationMode: runtime.isolationMode,
            fallbackPolicy: runtime.fallbackPolicy,
            temperature: runtime.temperature,
            maxTokens: runtime.maxTokens,
            systemPrompt: runtime.systemPrompt,
            guardrails: JSON.parse(runtime.guardrails || '[]'),
            knowledgeScope: JSON.parse(runtime.knowledgeScope || '[]'),
            sopIds: JSON.parse(runtime.sopIds || '[]'),
            isActive: runtime.isActive,
          }
        : null,
    };
  });

  return NextResponse.json({
    data,
    meta: {
      total: data.length,
      withRuntime: data.filter((d) => d.runtime).length,
      localOnly: data.filter((d) => d.runtime?.isolationMode === 'local').length,
      models: Array.from(new Set(data.map((d) => d.runtime?.modelName).filter(Boolean))),
    },
  });
}
