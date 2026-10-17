import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/analytics?period=30d
// Returns real analytics aggregations from the database — no mocks.
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const companyId = payload.companyId;
    const period = new URL(req.url).searchParams.get('period') || '30d';
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '1y' ? 365 : 30;
    const since = new Date(Date.now() - days * 86400000);

    const [
      content,
      campaigns,
      leads,
      deals,
      contactsCount,
      tickets,
    ] = await Promise.all([
      db.content.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
      db.campaign.findMany({ where: { companyId } }),
      db.lead.findMany({ where: { companyId, createdAt: { gte: since } } }),
      db.deal.findMany({ where: { companyId } }),
      db.contact.count({ where: { companyId } }),
      db.ticket.findMany({ where: { companyId, createdAt: { gte: since } } }),
    ]);

    // ─── Overview ──────────────────────────────────────────────────────────
    let totalReach = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    for (const c of campaigns) {
      try {
        const m = JSON.parse(c.metrics || '{}');
        totalReach += m.reach || 0;
        totalClicks += m.clicks || 0;
        totalConversions += m.conversions || 0;
      } catch { /* skip */ }
    }
    let totalLikes = 0, totalComments = 0, totalShares = 0;
    for (const c of content) {
      try {
        const e = JSON.parse(c.engagement || '{}');
        totalLikes += e.likes || 0;
        totalComments += e.comments || 0;
        totalShares += e.shares || 0;
      } catch { /* skip */ }
    }
    const totalEngagement = totalLikes + totalComments + totalShares + totalClicks;
    const revenue = deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value, 0);
    const pipelineValue = deals.filter((d) => !['won', 'lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);
    const marketingSpend = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
    const conversionRate = totalReach > 0 ? (totalConversions / totalReach) * 100 : 0;
    const costPerLead = leads.length > 0 ? marketingSpend / leads.length : 0;
    const roi = marketingSpend > 0 ? ((revenue - marketingSpend) / marketingSpend) * 100 : 0;

    // ─── Engagement over time ─────────────────────────────────────────────
    const engagementOverTime: { date: string; engagement: number; reach: number }[] = [];
    const dayBuckets: Record<string, { engagement: number; reach: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dayBuckets[key] = { engagement: 0, reach: 0 };
    }
    for (const c of content) {
      const key = new Date(c.createdAt).toISOString().slice(0, 10);
      if (dayBuckets[key]) {
        try {
          const e = JSON.parse(c.engagement || '{}');
          dayBuckets[key].engagement += (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
        } catch { /* skip */ }
        dayBuckets[key].reach += 1;
      }
    }
    for (const [date, v] of Object.entries(dayBuckets)) {
      engagementOverTime.push({ date: date.slice(5), ...v });
    }

    // ─── Content type performance ─────────────────────────────────────────
    const typeMap: Record<string, { impressions: number; clicks: number; conversions: number; engagement: number }> = {};
    for (const c of content) {
      const t = c.type || 'other';
      if (!typeMap[t]) typeMap[t] = { impressions: 0, clicks: 0, conversions: 0, engagement: 0 };
      try {
        const e = JSON.parse(c.engagement || '{}');
        typeMap[t].engagement += (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
      } catch { /* skip */ }
      typeMap[t].impressions += 1;
    }
    const contentTypePerformance = Object.entries(typeMap).map(([type, v]) => ({ type, ...v }));

    // ─── Platform comparison ──────────────────────────────────────────────
    const platformMap: Record<string, { reach: number; engagement: number; conversions: number }> = {};
    for (const c of content) {
      const p = c.platform || 'unknown';
      if (!platformMap[p]) platformMap[p] = { reach: 0, engagement: 0, conversions: 0 };
      try {
        const e = JSON.parse(c.engagement || '{}');
        platformMap[p].engagement += (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
      } catch { /* skip */ }
      platformMap[p].reach += 1;
    }
    const platformComparison = Object.entries(platformMap).map(([platform, v]) => ({ platform, ...v }));

    // ─── Campaign ROI ─────────────────────────────────────────────────────
    const campaignROI = campaigns.map((c) => {
      let reach = 0, clicks = 0, conversions = 0;
      try {
        const m = JSON.parse(c.metrics || '{}');
        reach = m.reach || 0;
        clicks = m.clicks || 0;
        conversions = m.conversions || 0;
      } catch { /* skip */ }
      const spend = c.budget || 0;
      const avgDeal = deals.length > 0 ? deals.reduce((s, d) => s + d.value, 0) / deals.length : 0;
      const campaignRevenue = conversions * avgDeal;
      const cRoi = spend > 0 ? ((campaignRevenue - spend) / spend) * 100 : 0;
      return {
        name: c.name,
        spend,
        revenue: campaignRevenue,
        roi: Math.round(cRoi),
      };
    });

    // ─── Top content ──────────────────────────────────────────────────────
    const topContent = content
      .map((c) => {
        let engagement = 0;
        try {
          const e = JSON.parse(c.engagement || '{}');
          engagement = (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
        } catch { /* skip */ }
        return {
          id: c.id,
          title: c.title,
          type: c.type,
          platform: c.platform || 'unknown',
          engagement,
          reach: 0,
          conversions: 0,
        };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 8);

    return NextResponse.json({
      overview: {
        totalReach,
        totalEngagement,
        conversionRate: Math.round(conversionRate * 100) / 100,
        revenue,
        costPerLead: Math.round(costPerLead * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        pipelineValue,
        leadsCount: leads.length,
        contactsCount,
        ticketsCount: tickets.length,
      },
      engagementOverTime,
      contentTypePerformance,
      platformComparison,
      campaignROI,
      topContent,
    });
  } catch (err) {
    console.error('[GET /api/analytics]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
