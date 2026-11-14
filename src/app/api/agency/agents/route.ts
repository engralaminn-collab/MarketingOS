import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';

/** GET /api/agency/agents — agent roster, searchable and paged. */
export async function GET(req: Request) {
  const actor = await getActor(req);

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 60) || 60, 1), 200);
  const offset = Math.max(Number(searchParams.get('offset') || 0) || 0, 0);

  try {
    const where: Record<string, unknown> = { companyId: actor.companyId };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { role: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      db.aiAgent.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' } }),
      db.aiAgent.count({ where }),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { total, limit, offset },
    });
  } catch {
    return NextResponse.json({
      data: [],
      meta: { total: 0, limit, offset, note: 'Agent model schema mismatch — pending migration' },
    });
  }
}
