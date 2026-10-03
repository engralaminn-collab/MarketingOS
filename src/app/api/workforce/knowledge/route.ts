import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { retrieveKnowledge } from '@/lib/workforce/engine';
import { db } from '@/lib/db';

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
    const query = searchParams.get('query') || '';
    const departmentId = searchParams.get('departmentId') || undefined;
    const category = searchParams.get('category') || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Try engine's retrieveKnowledge first
    try {
      const results = await retrieveKnowledge(
        query,
        departmentId,
        undefined,
        limit
      );

      // Filter by company if we can (knowledge nodes have companyId)
      if (results.length > 0) {
        const validIds = new Set(
          (await db.knowledgeNode.findMany({
            where: { id: { in: results.map((r) => r.id) }, companyId },
            select: { id: true },
          })).map((n) => n.id)
        );

        const filtered = results.filter((r) => validIds.has(r.id));
        return NextResponse.json({ knowledge: filtered });
      }

      return NextResponse.json({ knowledge: [] });
    } catch {
      // Fallback to direct DB query
    }

    // Direct DB fallback
    const where: Record<string, unknown> = { companyId };

    if (departmentId) where.departmentId = departmentId;
    if (category) where.category = category;

    if (query) {
      where.OR = [
        { title: { contains: query } },
        { summary: { contains: query } },
        { content: { contains: query } },
      ];
    }

    const nodes = await db.knowledgeNode.findMany({
      where,
      orderBy: { accessCount: 'desc' },
      take: limit,
    });

    // Parse JSON fields
    const parsedNodes = nodes.map((node) => {
      let tags: string[] = [];
      try { tags = JSON.parse(node.tags); } catch { /* keep */ }

      return {
        id: node.id,
        title: node.title,
        content: node.content,
        summary: node.summary,
        nodeType: node.nodeType,
        tags,
        category: node.category,
        departmentId: node.departmentId,
        accessLevel: node.accessLevel,
        accessCount: node.accessCount,
        rating: node.rating,
        sourceUrl: node.sourceUrl,
        sourceType: node.sourceType,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };
    });

    return NextResponse.json({ knowledge: parsedNodes });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
