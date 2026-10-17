import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

const CAMPAIGN_TYPES = ['social', 'email', 'sms', 'content', 'multi_channel'] as const;

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.companyId || !payload.userId) return null;
  return { companyId: payload.companyId, userId: payload.userId, role: payload.role };
}

function parseMetrics(value: string | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Old or malformed metric values are reported as empty, never estimated.
  }
  return {};
}

function campaignView(row: { id: string; name: string; type: string; status: string; budget: number | null; startDate: Date | null; endDate: Date | null; metrics: string; createdAt: Date; updatedAt: Date }) {
  const storedMetrics = parseMetrics(row.metrics);
  const numericMetric = (key: string) => {
    const value = storedMetrics[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  };
  return {
    ...row,
    budget: row.budget ?? 0,
    description: typeof storedMetrics.description === 'string' ? storedMetrics.description : '',
    metrics: {
      reach: numericMetric('reach'),
      impressions: numericMetric('impressions'),
      clicks: numericMetric('clicks'),
      conversions: numericMetric('conversions'),
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db.campaign.findMany({
      where: { companyId: actor.companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const campaigns = rows.map(campaignView);
    const summary = {
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
      totalBudget: campaigns.reduce((sum, campaign) => sum + campaign.budget, 0),
      totalReach: campaigns.reduce((sum, campaign) => sum + campaign.metrics.reach, 0),
      totalConversions: campaigns.reduce((sum, campaign) => sum + campaign.metrics.conversions, 0),
    };
    return NextResponse.json({ campaigns, summary });
  } catch (error) {
    console.error('[GET /api/campaigns]', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON request body is required' }, { status: 400 });

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    const budget = Number(body.budget);
    const startDate = typeof body.startDate === 'string' ? new Date(body.startDate) : null;
    const endDate = typeof body.endDate === 'string' ? new Date(body.endDate) : null;
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5_000) : '';

    if (!name || name.length > 160) return NextResponse.json({ error: 'Campaign name is required and must be 160 characters or fewer' }, { status: 400 });
    if (!CAMPAIGN_TYPES.includes(type as (typeof CAMPAIGN_TYPES)[number])) return NextResponse.json({ error: 'Campaign type is invalid' }, { status: 400 });
    if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000_000) return NextResponse.json({ error: 'Budget must be a valid non-negative amount' }, { status: 400 });
    if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) return NextResponse.json({ error: 'Valid start and end dates are required' }, { status: 400 });
    if (endDate < startDate) return NextResponse.json({ error: 'End date must be on or after the start date' }, { status: 400 });

    // Provider performance data is not enabled. Keep metrics explicitly empty/zero;
    // only preserve the human-entered campaign description in this JSON field.
    const metrics = JSON.stringify({ reach: 0, impressions: 0, clicks: 0, conversions: 0, description });
    const campaign = await db.campaign.create({
      data: {
        name,
        type,
        status: 'draft',
        budget,
        startDate,
        endDate,
        metrics,
        companyId: actor.companyId,
      },
    });

    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'campaign.created',
      title: 'Campaign draft created',
      description: `Campaign "${campaign.name}" created (${campaign.type})`,
      resourceType: 'campaign',
      resourceId: campaign.id,
      link: '/campaigns',
      metadata: { name, type, status: campaign.status },
    });

    return NextResponse.json({ campaign: campaignView(campaign) }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/campaigns]', error);
    return NextResponse.json({ error: 'Failed to create campaign draft' }, { status: 500 });
  }
}
