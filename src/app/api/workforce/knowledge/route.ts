import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { retrieveKnowledge } from '@/lib/workforce/engine';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const query = (params.get('query') || '').trim();
  if (query.length > 2_000) return NextResponse.json({ error: 'Query is too long.' }, { status: 400 });
  const rawLimit = Number(params.get('limit') || '20');
  const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 100)) : 20;
  try {
    if (query) return NextResponse.json({ knowledge: await retrieveKnowledge(actor.companyId, query, undefined, limit) });
    const nodes = await db.knowledgeNode.findMany({
      where: { companyId: actor.companyId, accessLevel: { in: ['public', 'company'] }, ...(params.get('category') ? { category: params.get('category')! } : {}) },
      orderBy: { updatedAt: 'desc' }, take: limit,
      select: { id: true, title: true, content: true, summary: true, nodeType: true, tags: true, category: true, departmentId: true, accessLevel: true, updatedAt: true },
    });
    return NextResponse.json({ knowledge: nodes, note: 'Restricted, department and role-specific knowledge is withheld until access controls are implemented.' });
  } catch { return NextResponse.json({ error: 'Could not fetch knowledge.' }, { status: 500 }); }
}
