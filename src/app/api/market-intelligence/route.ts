import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/market-intelligence — radar overview: competitors, keywords, recent alerts
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const [competitors, keywords, recentEvents] = await Promise.all([
      db.competitor.findMany({
        where: { companyId: payload.companyId },
        orderBy: [{ threatLevel: 'desc' }, { createdAt: 'desc' }],
      }),
      db.keywordTracker.findMany({
        where: { companyId: payload.companyId },
        orderBy: [{ searchVolume: 'desc' }, { keyword: 'asc' }],
      }),
      db.activity.findMany({
        where: {
          companyId: payload.companyId,
          OR: [
            { type: 'competitor.added' },
            { type: 'competitor.updated' },
            { type: 'keyword.tracked' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    // Compute threat matrix — group competitors by threat level
    const threatGroups = {
      high: competitors.filter((c) => c.threatLevel === 'high'),
      medium: competitors.filter((c) => c.threatLevel === 'medium'),
      low: competitors.filter((c) => c.threatLevel === 'low'),
    };

    // Compute keyword stats
    const totalSearchVolume = keywords.reduce((sum, k) => sum + k.searchVolume, 0);
    const avgDifficulty = keywords.length > 0
      ? Math.round(keywords.reduce((sum, k) => sum + k.difficulty, 0) / keywords.length)
      : 0;

    // Top opportunities — high volume, low difficulty
    const opportunities = keywords
      .map((k) => ({
        ...k,
        opportunityScore: k.searchVolume > 0 ? Math.round((k.searchVolume / (k.difficulty + 1)) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 5);

    return NextResponse.json({
      data: {
        summary: {
          totalCompetitors: competitors.length,
          highThreatCompetitors: threatGroups.high.length,
          mediumThreatCompetitors: threatGroups.medium.length,
          lowThreatCompetitors: threatGroups.low.length,
          totalKeywords: keywords.length,
          totalSearchVolume,
          avgDifficulty,
        },
        competitors: competitors.map((c) => ({
          id: c.id,
          name: c.name,
          website: c.website,
          description: c.description,
          strengths: (() => { try { return JSON.parse(c.strengths || '[]'); } catch { return []; } })(),
          weaknesses: (() => { try { return JSON.parse(c.weaknesses || '[]'); } catch { return []; } })(),
          pricing: c.pricing,
          marketShare: c.marketShare,
          threatLevel: c.threatLevel,
          updatedAt: c.updatedAt.toISOString(),
        })),
        threatGroups,
        keywords: keywords.map((k) => ({
          id: k.id,
          keyword: k.keyword,
          searchVolume: k.searchVolume,
          difficulty: k.difficulty,
          trend: k.trend,
          lastPosition: k.lastPosition,
          competitorPositions: (() => { try { return JSON.parse(k.competitorPositions || '{}'); } catch { return {}; } })(),
          updatedAt: k.updatedAt.toISOString(),
        })),
        opportunities,
        recentEvents: recentEvents.map((e) => ({
          id: e.id,
          type: e.type,
          description: e.description,
          createdAt: e.createdAt.toISOString(),
          user: e.user,
        })),
      },
    });
  } catch (err) {
    console.error('[GET /api/market-intelligence]', err);
    return NextResponse.json({ error: 'Failed to fetch market intelligence' }, { status: 500 });
  }
}
