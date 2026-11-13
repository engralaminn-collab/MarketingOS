import { hasPermission } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';

/** GET /api/agency/sops — the SOP library with per-department coverage. */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  const category = searchParams.get('category');
  const q = (searchParams.get('q') || '').trim();

  const where: Record<string, unknown> = { companyId: actor.companyId, isActive: true, departmentId: null, applicableRoles: '[]' };
  if (departmentId) return NextResponse.json({ error: 'Department-specific SOP access is unavailable until role-aware policies are implemented.' }, { status: 403 });
  if (category && category !== 'all') where.category = category;
  if (q) where.OR = [{ name: { contains: q } }, { description: { contains: q } }, { category: { contains: q } }];

  const [rows, departments, total, categories] = await Promise.all([
    db.sop.findMany({ where, orderBy: [{ departmentId: 'asc' }, { name: 'asc' }], take: 400 }),
    db.department.findMany({ where: { companyId: actor.companyId }, select: { id: true, name: true, code: true } }),
    db.sop.count({ where: { companyId: actor.companyId, isActive: true, departmentId: null, applicableRoles: '[]' } }),
    db.sop.groupBy({ by: ['category'], where: { companyId: actor.companyId, isActive: true, departmentId: null, applicableRoles: '[]' }, _count: true }),
  ]);

  const deptById = new Map(departments.map((d) => [d.id, d]));
  return NextResponse.json({
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      departmentId: row.departmentId,
      departmentName: row.departmentId ? deptById.get(row.departmentId)?.name ?? null : 'Cross-functional',
      departmentCode: row.departmentId ? deptById.get(row.departmentId)?.code ?? null : null,
      steps: JSON.parse(row.steps || '[]'),
      preconditions: JSON.parse(row.preconditions || '[]'),
      applicableRoles: JSON.parse(row.applicableRoles || '[]'),
      version: row.version,
      usageCount: row.usageCount,
      successRate: row.successRate,
    })),
    meta: {
      total,
      returned: rows.length,
      departmentsWithSop: new Set(rows.map((row) => row.departmentId).filter(Boolean)).size,
      departments: departments.length,
      categories: Object.fromEntries(categories.map((row) => [row.category, row._count])),
    },
  });
}
