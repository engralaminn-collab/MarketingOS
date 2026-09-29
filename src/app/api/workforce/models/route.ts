import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const models = await db.modelConfig.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: 'asc' }, { tier: 'asc' }],
    });

    // Parse JSON fields
    const parsedModels = models.map((model) => {
      let capabilities: string[] = [];
      let config: Record<string, unknown> = {};
      try { capabilities = JSON.parse(model.capabilities); } catch { /* keep */ }
      try { config = JSON.parse(model.config); } catch { /* keep */ }

      return {
        id: model.id,
        name: model.name,
        provider: model.provider,
        tier: model.tier,
        capabilities,
        maxTokens: model.maxTokens,
        costPer1kInput: model.costPer1kInput,
        costPer1kOutput: model.costPer1kOutput,
        avgLatencyMs: model.avgLatencyMs,
        qualityScore: model.qualityScore,
        isFallback: model.isFallback,
        fallbackFor: model.fallbackFor,
        config,
        sortOrder: model.sortOrder,
      };
    });

    return NextResponse.json({ models: parsedModels });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
