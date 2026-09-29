import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [
      socialAccounts,
      totalLeads,
      newLeads,
      totalContent,
      publishedContent,
      activeCampaigns,
      totalDeals,
      wonDeals,
      seoChallenges,
      aiAgents,
      recentContent,
      recentLeads,
      campaigns,
    ] = await Promise.all([
      db.socialAccount.count({ where: { companyId, status: 'active' } }),
      db.lead.count({ where: { companyId } }),
      db.lead.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
      db.content.count({ where: { companyId } }),
      db.content.count({ where: { companyId, status: 'published' } }),
      db.campaign.count({ where: { companyId, status: 'active' } }),
      db.deal.count({ where: { companyId } }),
      db.deal.count({ where: { companyId, stage: 'won' } }),
      db.seoChallenge.findMany({ where: { companyId }, include: { dailyTasks: true } }),
      db.aiAgent.count({ where: { companyId, isEnabled: true } }),
      db.content.findMany({ where: { companyId }, take: 5, orderBy: { createdAt: 'desc' } }),
      db.lead.findMany({ where: { companyId }, take: 5, orderBy: { createdAt: 'desc' } }),
      db.campaign.findMany({ where: { companyId }, include: { contents: true } }),
    ]);

    // Calculate revenue from won deals
    const wonDealsData = await db.deal.findMany({ where: { companyId, stage: 'won' } });
    const revenue = wonDealsData.reduce((sum, d) => sum + d.value, 0);

    // Engagement analytics from content engagement data
    const allContent = await db.content.findMany({ where: { companyId } });
    let totalLikes = 0, totalShares = 0, totalComments = 0, totalClicks = 0;
    for (const c of allContent) {
      try {
        const eng = JSON.parse(c.engagement || '{}');
        totalLikes += eng.likes || 0;
        totalShares += eng.shares || 0;
        totalComments += eng.comments || 0;
        totalClicks += eng.clicks || 0;
      } catch { /* skip unparseable */ }
    }

    // Lead funnel
    const leadByStatus = await db.lead.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    });

    // Deal pipeline
    const dealByStage = await db.deal.groupBy({
      by: ['stage'],
      where: { companyId },
      _count: true,
      _sum: { value: true },
    });

    // Content by type
    const contentByType = await db.content.groupBy({
      by: ['type'],
      where: { companyId },
      _count: true,
    });

    // SEO progress
    const seoProgress = seoChallenges[0]
      ? Math.round((seoChallenges[0].dailyTasks.filter(t => t.status === 'completed').length / seoChallenges[0].duration) * 100)
      : 0;

    // Revenue trend — real monthly aggregation from won deals
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const wonDealsRange = await db.deal.findMany({
      where: { companyId, stage: 'won', closeDate: { gte: sixMonthsAgo } },
      select: { closeDate: true, value: true },
    });
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const revenueByMonth = new Map<string, number>();
    for (const d of wonDealsRange) {
      if (d.closeDate) {
        const key = monthNames[d.closeDate.getMonth()];
        revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + d.value);
      }
    }
    const revenueTrend: { month: string; revenue: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const key = monthNames[d.getMonth()];
      revenueTrend.push({ month: key, revenue: revenueByMonth.get(key) || 0 });
    }

    // Platform distribution — real count from socialAccount table
    const platformGroups = await db.socialAccount.groupBy({
      by: ['platform'],
      where: { companyId },
      _count: true,
    });
    const totalPlatforms = platformGroups.reduce((s, g) => s + g._count, 0) || 1;
    const PLATFORM_COLORS: Record<string, string> = {
      facebook: '#1877F2', instagram: '#E4405F', linkedin: '#0A66C2',
      youtube: '#FF0000', x: '#000000', tiktok: '#000000',
      pinterest: '#E60023', reddit: '#FF4500',
    };
    const platformDistribution = platformGroups
      .sort((a, b) => b._count - a._count)
      .slice(0, 6)
      .map(g => ({
        name: g.platform,
        value: Math.round((g._count / totalPlatforms) * 100),
        color: PLATFORM_COLORS[g.platform] || '#6B7280',
      }));

    // Shape leadFunnel using `stage` key (frontend expects stage, not status)
    const leadFunnel = leadByStatus.map(l => ({ stage: l.status, count: l._count }));

    // Shape dealPipeline: each stage gets a color
    const PIPELINE_COLORS: Record<string, string> = {
      prospect: '#f97316', qualified: '#3b82f6', proposal: '#10b981',
      negotiation: '#f59e0b', won: '#10b981', lost: '#ef4444',
      closed_won: '#10b981', closed_lost: '#ef4444',
    };
    const dealPipeline = dealByStage.map(d => ({
      stage: d.stage,
      value: d._sum.value || 0,
      deals: d._count,
      color: PIPELINE_COLORS[d.stage] || '#6B7280',
    }));

    // Shape activeCampaignsList (frontend calls this `activeCampaigns`)
    const activeCampaignsList = campaigns.map(c => {
      let reach = 0, impressions = 0, clicks = 0, conversions = 0;
      try {
        const m = JSON.parse(c.metrics || '{}');
        reach = m.reach || 0;
        impressions = m.impressions || 0;
        clicks = m.clicks || 0;
        conversions = m.conversions || 0;
      } catch { /* skip */ }
      return {
        id: c.id,
        name: c.name,
        platform: c.type,
        status: c.status,
        reach,
        engagement: clicks,
        conversions,
        startDate: c.startDate?.toISOString() || c.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      // `overview` and `kpi` both populated — view reads `kpi`
      overview: {
        connectedSocialAccounts: socialAccounts,
        totalLeads,
        newLeads30d: newLeads,
        contentCreated: totalContent,
        publishedContent,
        activeCampaigns,
        totalDeals,
        wonDeals,
        revenue,
        aiAgentsActive: aiAgents,
        seoProgress,
      },
      kpi: {
        connectedSocialAccounts: socialAccounts,
        totalLeads,
        newLeads30d: newLeads,
        contentCreated: totalContent,
        publishedContent,
        activeCampaigns,
        revenue,
        aiAgentsActive: aiAgents,
        seoProgress,
      },
      engagement: {
        likes: totalLikes,
        shares: totalShares,
        comments: totalComments,
        clicks: totalClicks,
      },
      leadFunnel,
      dealPipeline,
      contentByType: contentByType.map(c => ({ type: c.type, count: c._count })),
      recentContent: recentContent.map(c => ({
        id: c.id,
        title: c.title,
        type: c.type,
        platform: c.platform || 'unknown',
        status: c.status,
        publishedAt: c.publishedAt?.toISOString() || c.createdAt.toISOString(),
        engagement: (() => {
          try {
            const e = JSON.parse(c.engagement || '{}');
            return (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
          } catch { return 0; }
        })(),
      })),
      recentLeads: recentLeads.map(l => ({
        id: l.id,
        name: l.name,
        email: l.email || '',
        source: l.source || 'Unknown',
        score: l.score,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
      })),
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        budget: c.budget,
        contentCount: c.contents.length,
        metrics: (() => { try { return JSON.parse(c.metrics || '{}'); } catch { return {}; } })(),
      })),
      activeCampaigns: activeCampaignsList,
      seoChallenge: seoChallenges[0] ? {
        id: seoChallenges[0].id,
        name: seoChallenges[0].name,
        currentDay: seoChallenges[0].currentDay,
        duration: seoChallenges[0].duration,
        score: seoChallenges[0].score,
        results: (() => { try { return JSON.parse(seoChallenges[0].results || '{}'); } catch { return {}; } })(),
      } : null,
      revenueTrend,
      platformDistribution,
      aiInsights: [] as any[],  // empty array — view handles gracefully
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
