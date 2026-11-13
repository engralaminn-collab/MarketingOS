import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';

/** GET /api/agency/agents — the 2,000-agent roster, searchable and paged. */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const department = searchParams.get('department') || 'all';
  const level = searchParams.get('level') || 'all';
  const autonomy = searchParams.get('autonomy') || 'all';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 60) || 60, 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') || 0) || 0, 0);

  const where: Record<string, unknown> = { companyId: actor.companyId };
  if (department !== 'all') where.departmentCode = department;
  if (level !== 'all') where.level = level;
  if (autonomy !== 'all') where.autonomy = autonomy;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { role: { contains: q } },
      { mission: { contains: q } },
      { code: { contains: q } },
      { departmentCode: { contains: q } },
    ];
  }

  const [rows, total, byLevel, byAutonomyFmt] = await Promise.all([
    db.agentSpec.findMany({ where, orderBy: { code: 'asc' }, take: limit, skip: offset }),
    db.agentSpec.count({ where }),
    db.agentSpec.groupBy({ by: ['level'], where: { companyId: actor.companyId }, _count: true }),
    db.agentSpec.groupBy({ by: ['autonomy'], where: { companyId: actor.companyId }, _count: true }),
  ]);

  return NextResponse.json({
    data: rows.map((row) => ({
      ...row,
      skills: JSON.parse(row.skills || '[]'),
      capabilities: JSON.parse(row.capabilities || '[]'),
      tools: JSON.parse(row.tools || '[]'),
      guardrails: JSON.parse(row.guardrails || '[]'),
      inputChannels: JSON.parse(row.inputChannels || '[]'),
      outputChannels: JSON.parse(row.outputChannels || '[]'),
    })),
    meta: {
      total,
      limit,
      offset,
      byLevel: Object.fromEntries(byLevel.map((row) => [row.level, row._count])),
      byAutonomy: Object.fromEntries(byAutonomyFmt.map((row) => [row.autonomy, row._count])),
    },
  });
}
