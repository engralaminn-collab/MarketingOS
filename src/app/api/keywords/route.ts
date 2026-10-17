import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

function numericField(value: unknown, field: string, minimum: number, maximum: number): { value?: number; error?: string } {
  if (value === undefined) return {};
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    return { error: `${field} must be a whole number from ${minimum} to ${maximum}` };
  }
  return { value: parsed };
}

// GET /api/keywords — list manually maintained keyword plans for this company.
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const keywords = await db.keywordTracker.findMany({
      where: { companyId: actor.companyId },
      orderBy: [{ searchVolume: 'desc' }, { keyword: 'asc' }],
    });

    return NextResponse.json({
      data: keywords.map((keyword) => ({
        id: keyword.id,
        keyword: keyword.keyword,
        searchVolume: keyword.searchVolume,
        difficulty: keyword.difficulty,
        trend: keyword.trend,
        lastPosition: keyword.lastPosition,
        competitorPositions: (() => { try { return JSON.parse(keyword.competitorPositions || '{}'); } catch { return {}; } })(),
        updatedAt: keyword.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[GET /api/keywords]', error);
    return NextResponse.json({ error: 'Failed to fetch keyword plans' }, { status: 500 });
  }
}

// POST /api/keywords — add or update a manually researched keyword plan.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'seo_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const keyword = typeof input.keyword === 'string' ? input.keyword.trim().toLowerCase() : '';
    if (!keyword || keyword.length > 200) return NextResponse.json({ error: 'Keyword is required and must be at most 200 characters' }, { status: 400 });

    const searchVolume = numericField(input.searchVolume, 'Monthly volume estimate', 0, 1_000_000_000);
    const difficulty = numericField(input.difficulty, 'Difficulty estimate', 0, 100);
    const lastPosition: { value?: number | null; error?: string } = input.lastPosition === null
      ? { value: null }
      : numericField(input.lastPosition, 'Position estimate', 1, 1_000);
    const trend = input.trend;
    if (searchVolume.error || difficulty.error || lastPosition.error) {
      return NextResponse.json({ error: searchVolume.error || difficulty.error || lastPosition.error }, { status: 400 });
    }
    if (trend !== undefined && !['up', 'down', 'stable'].includes(String(trend))) {
      return NextResponse.json({ error: 'Trend must be up, down, or stable' }, { status: 400 });
    }

    const tracker = await db.keywordTracker.upsert({
      where: { companyId_keyword: { companyId: actor.companyId, keyword } },
      create: {
        keyword,
        searchVolume: searchVolume.value ?? 0,
        difficulty: difficulty.value ?? 0,
        trend: trend === undefined ? 'stable' : String(trend),
        lastPosition: lastPosition.value ?? null,
        companyId: actor.companyId,
      },
      update: {
        searchVolume: searchVolume.value,
        difficulty: difficulty.value,
        trend: trend === undefined ? undefined : String(trend),
        lastPosition: lastPosition.value,
      },
    });

    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'keyword.tracked',
      title: 'Keyword plan saved',
      description: `Manually recorded "${keyword}" (volume estimate: ${tracker.searchVolume}/mo, difficulty estimate: ${tracker.difficulty})`,
      resourceType: 'keyword',
      resourceId: tracker.id,
      link: '/market-intelligence',
      metadata: { keyword, searchVolumeEstimate: tracker.searchVolume, difficultyEstimate: tracker.difficulty },
    });

    return NextResponse.json({
      data: {
        id: tracker.id,
        keyword: tracker.keyword,
        searchVolume: tracker.searchVolume,
        difficulty: tracker.difficulty,
        trend: tracker.trend,
        lastPosition: tracker.lastPosition,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/keywords]', error);
    return NextResponse.json({ error: 'Failed to save keyword plan' }, { status: 500 });
  }
}
