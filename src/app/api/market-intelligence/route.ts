import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function parseJson<T>(value: string | null, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(value || '');
    return parsed as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: string | null, limit = 600): string {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function safeExternalLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// GET /api/market-intelligence — company competitors, manual keyword plans and feed signals
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const companyId = payload.companyId;

    const [competitors, keywords, recentEvents, feedItems, leads] = await Promise.all([
      db.competitor.findMany({
        where: { companyId },
        orderBy: [{ threatLevel: 'desc' }, { createdAt: 'desc' }],
      }),
      db.keywordTracker.findMany({
        where: { companyId },
        orderBy: [{ searchVolume: 'desc' }, { keyword: 'asc' }],
      }),
      db.activity.findMany({
        where: { companyId, OR: [{ type: 'competitor.added' }, { type: 'competitor.updated' }, { type: 'keyword.tracked' }] },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      db.feedItem.findMany({
        where: { companyId, source: { isActive: true } },
        orderBy: { publishedAt: 'desc' },
        take: 40,
        include: { source: { select: { name: true } } },
      }),
      db.lead.findMany({
        where: { companyId, companyName: { not: null } },
        select: { companyName: true },
        take: 500,
      }),
    ]);

    const threatGroups = {
      high: competitors.filter((competitor) => competitor.threatLevel === 'high'),
      medium: competitors.filter((competitor) => competitor.threatLevel === 'medium'),
      low: competitors.filter((competitor) => competitor.threatLevel === 'low'),
    };
    const totalSearchVolume = keywords.reduce((sum, keyword) => sum + (Number.isFinite(keyword.searchVolume) ? keyword.searchVolume : 0), 0);
    const avgDifficulty = keywords.length ? Math.round(keywords.reduce((sum, keyword) => sum + (Number.isFinite(keyword.difficulty) ? keyword.difficulty : 0), 0) / keywords.length) : 0;
    const opportunities = keywords
      .map((keyword) => ({
        ...keyword,
        // Heuristic over user-entered volume/difficulty, not a measured provider score.
        opportunityScore: keyword.searchVolume > 0 ? Math.round((keyword.searchVolume / (keyword.difficulty + 1)) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 5);

    const entityNames = new Map<string, { name: string; kind: 'competitor' | 'CRM company' }>();
    for (const competitor of competitors) {
      const name = competitor.name.trim();
      if (name.length >= 3) entityNames.set(normalizeForMatch(name), { name, kind: 'competitor' });
    }
    for (const lead of leads) {
      const name = lead.companyName?.trim();
      const normalized = name ? normalizeForMatch(name) : '';
      if (name && normalized.length >= 3 && !entityNames.has(normalized)) entityNames.set(normalized, { name, kind: 'CRM company' });
    }

    const signals = feedItems.map((item) => {
      const searchableText = normalizeForMatch(`${item.title} ${cleanText(item.description, 2_000)}`);
      const matchedEntities = [...entityNames.entries()]
        .filter(([normalized]) => searchableText.includes(normalized))
        .map(([, entity]) => entity)
        .slice(0, 5);
      return {
        id: item.id,
        title: cleanText(item.title, 240),
        description: cleanText(item.description, 500),
        link: safeExternalLink(item.link),
        sourceName: item.source.name,
        publishedAt: item.publishedAt.toISOString(),
        isRead: item.isRead,
        isStarred: item.isStarred,
        matchedEntities,
      };
    });

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
          totalFeedSignals: signals.length,
          matchedFeedSignals: signals.filter((signal) => signal.matchedEntities.length > 0).length,
        },
        competitors: competitors.map((competitor) => ({
          id: competitor.id,
          name: competitor.name,
          website: safeExternalLink(competitor.website || ''),
          description: competitor.description,
          strengths: parseJson(competitor.strengths, [] as string[]),
          weaknesses: parseJson(competitor.weaknesses, [] as string[]),
          pricing: competitor.pricing,
          marketShare: competitor.marketShare,
          threatLevel: competitor.threatLevel,
          updatedAt: competitor.updatedAt.toISOString(),
        })),
        threatGroups,
        keywords: keywords.map((keyword) => ({
          id: keyword.id,
          keyword: keyword.keyword,
          searchVolume: keyword.searchVolume,
          difficulty: keyword.difficulty,
          trend: keyword.trend,
          lastPosition: keyword.lastPosition,
          competitorPositions: parseJson(keyword.competitorPositions, {} as Record<string, number>),
          updatedAt: keyword.updatedAt.toISOString(),
        })),
        opportunities,
        recentEvents: recentEvents.map((event) => ({
          id: event.id,
          type: event.type,
          description: event.description,
          createdAt: event.createdAt.toISOString(),
          user: event.user,
        })),
        signals,
        signalMatching: 'Name-based matches against manually tracked competitors and CRM company names; no AI analysis or sentiment inference is performed.',
      },
    });
  } catch (error) {
    console.error('[GET /api/market-intelligence]', error);
    return NextResponse.json({ error: 'Failed to fetch market intelligence' }, { status: 500 });
  }
}
