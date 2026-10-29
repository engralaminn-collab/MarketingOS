import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

/**
 * Internal CRM counts are not provider analytics or recognized revenue.
 * Until verified ingestion and attribution exist, marketing KPIs are null,
 * never a budget, post count, placeholder zero, or inferred deal value.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requestedPeriod = new URL(req.url).searchParams.get('period') || '30d';
  const periods: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  if (!Object.hasOwn(periods, requestedPeriod)) return NextResponse.json({ error: 'Invalid analytics period.' }, { status: 400 });
  const now = new Date();
  const since = new Date(now.getTime() - periods[requestedPeriod] * 86_400_000);
  try {
    const [leads, contacts, tickets, wonDeals, pipelineDeals] = await Promise.all([
      db.lead.count({ where: { companyId: actor.companyId, createdAt: { gte: since, lte: now } } }),
      db.contact.count({ where: { companyId: actor.companyId } }),
      db.ticket.count({ where: { companyId: actor.companyId, createdAt: { gte: since, lte: now } } }),
      db.deal.aggregate({ where: { companyId: actor.companyId, stage: 'won' }, _sum: { value: true }, _count: true }),
      db.deal.aggregate({ where: { companyId: actor.companyId, stage: { notIn: ['won', 'lost'] } }, _sum: { value: true }, _count: true }),
    ]);
    return NextResponse.json({
      period: { name: requestedPeriod, from: since.toISOString(), to: now.toISOString() },
      overview: {
        totalReach: null, totalEngagement: null, conversionRate: null, revenue: null, costPerLead: null, roi: null,
        leadsCount: leads, contactsCount: contacts, ticketsCount: tickets,
        wonDealValue: wonDeals._sum.value ?? 0, wonDealCount: wonDeals._count,
        pipelineValue: pipelineDeals._sum.value ?? 0, pipelineDealCount: pipelineDeals._count,
      },
      engagementOverTime: [], contentTypePerformance: [], platformComparison: [], campaignROI: [], topContent: [],
      provenance: {
        marketingMetrics: 'unavailable: no verified provider analytics or spend ingestion',
        revenue: 'unavailable: won deal amounts are CRM entries, not verified payments or campaign-attributed revenue',
        crm: 'workspace database; leads and tickets in selected period, contacts and deal values all-time',
        currency: 'not specified by the CRM schema',
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not fetch analytics.' }, { status: 500 });
  }
}
