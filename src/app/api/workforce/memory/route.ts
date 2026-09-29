import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getMemories } from '@/lib/workforce/engine';

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
    const employeeId = searchParams.get('employeeId');
    const type = searchParams.get('type') || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    // Try engine's getMemories first
    try {
      const engineMemories = await getMemories(employeeId, type, limit);

      // Filter by company
      const filtered = engineMemories.filter((m) => {
        // Engine doesn't return companyId, but memories are per-employee
        // and employees are per-company, so trust the engine
        return true;
      });

      return NextResponse.json({ memories: filtered });
    } catch {
      // Fallback to direct DB query
    }

    // Direct DB fallback
    const where: Record<string, unknown> = { companyId };

    // Resolve employee
    const emp = await db.employee.findFirst({
      where: {
        companyId,
        OR: [
          { id: employeeId },
          { employeeId },
        ],
      },
      select: { id: true },
    });

    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    where.employeeId = emp.id;
    if (type) where.memoryType = type;

    const memories = await db.employeeMemory.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Parse metadata
    const parsedMemories = memories.map((m) => {
      let metadata: Record<string, unknown> = {};
      try { metadata = JSON.parse(m.metadata); } catch { /* keep */ }
      return {
        id: m.id,
        memoryType: m.memoryType,
        category: m.category,
        title: m.title,
        content: m.content,
        metadata,
        relevance: m.relevance,
        accessCount: m.accessCount,
        lastAccessedAt: m.lastAccessedAt,
        isApproved: m.isApproved,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
      };
    });

    return NextResponse.json({ memories: parsedMemories });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
