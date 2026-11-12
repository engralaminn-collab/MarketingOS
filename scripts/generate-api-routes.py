#!/usr/bin/env python3
"""
Generate all API route files for the Universal Lead Discovery Engine.
Follows the existing v1-middleware pattern (getSessionContext, ok, unauthorized, etc.).
"""
import os

ROUTES_DIR = '/home/z/my-project/src/app/api/v1'

# Each route: (relative_path, content)
ROUTES = []

# ── 1. Industries ──────────────────────────────────────────────────────────
ROUTES.append(('industries/route.ts', '''/**
 * GET /api/v1/industries — list industry taxonomy (global + tenant-custom)
 * POST /api/v1/industries — add a custom industry (tenant-scoped)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { listIndustryTree, addCustomIndustry } from '@/lib/industry-taxonomy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const tree = await listIndustryTree(ctx.companyId);
  return ok({ industries: tree });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const body = await request.json().catch(() => null);
  if (!body?.name) return badRequest('name is required');
  const industry = await addCustomIndustry(ctx.companyId, body.name, body.parentId, body.description);
  return ok({ industry });
}
'''))

# ── 2. Countries ───────────────────────────────────────────────────────────
ROUTES.append(('countries/route.ts', '''/**
 * GET /api/v1/countries — list country reference data (with privacy-law guidance)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { listCountries } from '@/lib/industry-taxonomy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const region = url.searchParams.get('region') || undefined;
  const countries = await listCountries(region);
  return ok({ countries });
}
'''))

# ── 3. Data Providers ──────────────────────────────────────────────────────
ROUTES.append(('data-providers/route.ts', '''/**
 * GET /api/v1/data-providers — list the free-first data provider registry
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { listDataProviders } from '@/lib/data-providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const providers = await listDataProviders({
    companyId: ctx.companyId,
    category: url.searchParams.get('category') || undefined,
    integrationStatus: url.searchParams.get('integrationStatus') || undefined,
  });
  return ok({ providers });
}
'''))

# ── 4. Discovery Campaigns ────────────────────────────────────────────────
ROUTES.append(('discovery/campaigns/route.ts', '''/**
 * GET /api/v1/discovery/campaigns — list discovery campaigns (Mode A + Mode B)
 * POST /api/v1/discovery/campaigns — create a discovery campaign
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { createDiscoveryCampaign, listDiscoveryCampaigns } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const campaigns = await listDiscoveryCampaigns(ctx.companyId, status);
  return ok({ campaigns });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.mode) return badRequest('name and mode (universal|targeted) are required');
  const campaign = await createDiscoveryCampaign(ctx.companyId, body);
  return ok({ campaign });
}
'''))

ROUTES.append(('discovery/campaigns/[id]/route.ts', '''/**
 * GET /api/v1/discovery/campaigns/[id] — get a campaign
 * PATCH /api/v1/discovery/campaigns/[id] — update campaign status
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok, forbidden } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const campaign = await db.discoveryCampaign.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!campaign) return notFound('Campaign not found');
  return ok({ campaign });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const updated = await db.discoveryCampaign.updateMany({
    where: { id, companyId: ctx.companyId },
    data: { ...(body?.status ? { status: body.status } : {}), ...(body?.autonomyLevel ? { autonomyLevel: body.autonomyLevel } : {}) },
  });
  if (updated.count === 0) return notFound('Campaign not found');
  return ok({ updated: true });
}
'''))

# ── 5. Discovery Opportunities ────────────────────────────────────────────
ROUTES.append(('discovery/opportunities/route.ts', '''/**
 * GET /api/v1/discovery/opportunities — list market opportunities (Mode A output)
 * POST /api/v1/discovery/opportunities — record a market opportunity with evidence
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { listMarketOpportunities, recordMarketOpportunity } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const opportunities = await listMarketOpportunities(ctx.companyId, {
    opportunityType: url.searchParams.get('opportunityType') || undefined,
    industryId: url.searchParams.get('industryId') || undefined,
    minConfidence: url.searchParams.get('minConfidence') || undefined,
    limit: parseInt(url.searchParams.get('limit') || '50'),
  });
  return ok({ opportunities });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.evidence || body.evidence.length === 0) {
    return badRequest('title and at least one evidence snippet are required — no invented data.');
  }
  const opportunity = await recordMarketOpportunity(ctx.companyId, body);
  return ok({ opportunity });
}
'''))

# ── 6. Discovery Run ──────────────────────────────────────────────────────
ROUTES.append(('discovery/run/route.ts', '''/**
 * POST /api/v1/discovery/run — run universal discovery (Mode A)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { runUniversalDiscovery } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const result = await runUniversalDiscovery(ctx.companyId, {
    industryIds: body.industryIds,
    countryIds: body.countryIds,
    campaignId: body.campaignId,
  });
  return ok(result);
}
'''))

# ── 7. Discovery Summary ──────────────────────────────────────────────────
ROUTES.append(('discovery/summary/route.ts', '''/**
 * GET /api/v1/discovery/summary — discovery dashboard summary
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { getDiscoverySummary } from '@/lib/discovery-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const summary = await getDiscoverySummary(ctx.companyId);
  return ok(summary);
}
'''))

# ── 8. Lead Discovery ─────────────────────────────────────────────────────
ROUTES.append(('leads/discover/route.ts', '''/**
 * POST /api/v1/leads/discover — record a discovered lead with full provenance
 * GET /api/v1/leads/discover — list discovered leads
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { recordDiscoveredLead, listDiscoveredLeads } from '@/lib/lead-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const leads = await listDiscoveredLeads(ctx.companyId, {
    campaignId: url.searchParams.get('campaignId') || undefined,
    reviewStatus: url.searchParams.get('reviewStatus') || undefined,
    minScore: url.searchParams.get('minScore') ? parseInt(url.searchParams.get('minScore')!) : undefined,
    limit: parseInt(url.searchParams.get('limit') || '50'),
  });
  return ok({ discoveredLeads: leads });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.businessName || !body?.sourceUrl) {
    return badRequest('businessName and sourceUrl are required (source provenance is mandatory).');
  }
  const result = await recordDiscoveredLead(ctx.companyId, body);
  return ok(result);
}
'''))

# ── 9. Lead Score Breakdown ───────────────────────────────────────────────
ROUTES.append(('leads/[id]/score/route.ts', '''/**
 * GET /api/v1/leads/[id]/score — get explainable lead score breakdown
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';
import { getLeadScoreBreakdown } from '@/lib/buyer-intent';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  // Verify tenant ownership
  const lead = await db.lead.findFirst({ where: { id, companyId: ctx.companyId }, select: { id: true } });
  if (!lead) return notFound('Lead not found');
  const breakdown = await getLeadScoreBreakdown(id);
  return ok(breakdown);
}
'''))

# ── 10. Lead Review ───────────────────────────────────────────────────────
ROUTES.append(('leads/[id]/review/route.ts', '''/**
 * POST /api/v1/leads/[id]/review — review a discovered lead (human-in-the-loop)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, badRequest, ok } from '@/lib/v1-middleware';
import { reviewDiscoveredLead } from '@/lib/lead-discovery';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.reviewStatus || !['reviewed', 'approved', 'rejected'].includes(body.reviewStatus)) {
    return badRequest('reviewStatus must be reviewed|approved|rejected');
  }
  // Find the discovered lead by leadId
  const dl = await db.discoveredLead.findFirst({ where: { leadId: id, companyId: ctx.companyId } });
  if (!dl) return notFound('Discovered lead not found for this lead');
  const result = await reviewDiscoveredLead(dl.id, ctx.companyId, body.reviewStatus, body.note);
  return ok(result);
}
'''))

# ── 11. Verify Contact Permission ─────────────────────────────────────────
ROUTES.append(('leads/[id]/verify-contact/route.ts', '''/**
 * POST /api/v1/leads/[id]/verify-contact — verify contact permission (consent + DNC + opt-out)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';
import { verifyContactPermission } from '@/lib/lead-discovery';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const lead = await db.lead.findFirst({ where: { id, companyId: ctx.companyId }, select: { id: true } });
  if (!lead) return notFound('Lead not found');
  const result = await verifyContactPermission(id, ctx.companyId);
  return ok(result);
}
'''))

# ── 12. Approvals ─────────────────────────────────────────────────────────
ROUTES.append(('approvals/route.ts', '''/**
 * GET /api/v1/approvals — list pending approval requests
 * POST /api/v1/approvals — create an approval request
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { requestApproval, listPendingApprovals, ApprovalRequest } from '@/lib/approval-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const requestType = url.searchParams.get('requestType') as any || undefined;
  const requests = await listPendingApprovals(ctx.companyId, requestType);
  return ok({ approvalRequests: requests });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.requestType || !body?.action) {
    return badRequest('requestType and action are required');
  }
  const result = await requestApproval(ctx.companyId, {
    ...body,
    requesterId: ctx.userId,
  });
  return ok(result);
}
'''))

ROUTES.append(('approvals/[id]/route.ts', '''/**
 * POST /api/v1/approvals/[id]/approve — approve a request
 * POST /api/v1/approvals/[id]/reject — reject a request
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, notFound, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { approveRequest, rejectRequest } from '@/lib/approval-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  // Only admins/managers can approve
  if (ctx.role === 'viewer' || ctx.role === 'client_user' || ctx.role === 'team_member') {
    return forbidden('Insufficient role to approve/reject');
  }
  const { id } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'approve';
  const body = await request.json().catch(() => ({}));
  try {
    if (action === 'reject') {
      const result = await rejectRequest(id, ctx.userId, body.note);
      return ok(result);
    } else {
      const result = await approveRequest(id, ctx.userId, body.note);
      return ok(result);
    }
  } catch (err: any) {
    return badRequest(err.message || 'Approval action failed');
  }
}
'''))

# ── 13. Cost Summary ──────────────────────────────────────────────────────
ROUTES.append(('cost/summary/route.ts', '''/**
 * GET /api/v1/cost/summary — cost intelligence dashboard (USD, free-first tracking)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { getCostSummary } from '@/lib/cost-intelligence';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  const summary = await getCostSummary(ctx.companyId, days);
  return ok(summary);
}
'''))

# ── 14. SEO Audit ─────────────────────────────────────────────────────────
ROUTES.append(('seo-audit/route.ts', '''/**
 * GET /api/v1/seo-audit — list website audits
 * POST /api/v1/seo-audit — run a real SEO audit on a URL
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { auditWebsite, listWebsiteAudits } from '@/lib/seo-audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const audits = await listWebsiteAudits(ctx.companyId, limit);
  return ok({ audits });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.url) return badRequest('url is required');
  try {
    const result = await auditWebsite(ctx.companyId, body.url);
    return ok(result);
  } catch (err: any) {
    return badRequest(err.message || 'SEO audit failed');
  }
}
'''))

# ── 15. Compliance ────────────────────────────────────────────────────────
ROUTES.append(('compliance/consent/route.ts', '''/**
 * GET /api/v1/compliance/consent — list consent records
 * POST /api/v1/compliance/consent — capture consent
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { captureConsent } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const consents = await db.consent.findMany({
    where: { companyId: ctx.companyId, ...(url.searchParams.get('subjectId') ? { subjectId: url.searchParams.get('subjectId')! } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok({ consents });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.subjectId || !body?.kind || !body?.method) {
    return badRequest('subjectId, kind, and method are required');
  }
  const consent = await captureConsent({ ...body, companyId: ctx.companyId, capturedBy: ctx.userId });
  return ok({ consent });
}
'''))

ROUTES.append(('compliance/opt-out/route.ts', '''/**
 * POST /api/v1/compliance/opt-out — process an opt-out request (DNC + revoke consent)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { processOptOut } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.leadId && !body?.phoneNumber) {
    return badRequest('leadId or phoneNumber is required');
  }
  const result = await processOptOut({
    companyId: ctx.companyId,
    leadId: body.leadId,
    phoneNumber: body.phoneNumber,
    reason: body.reason,
    source: body.source,
  });
  return ok(result);
}
'''))

ROUTES.append(('compliance/retention/route.ts', '''/**
 * GET /api/v1/compliance/retention — list retention policies
 * POST /api/v1/compliance/retention — set a retention policy
 * POST /api/v1/compliance/retention/enforce — enforce retention (delete/anonymize expired data)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { setRetentionPolicy, enforceRetention } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const policies = await db.dataRetentionPolicy.findMany({ where: { companyId: ctx.companyId } });
  return ok({ policies });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user') return forbidden('Insufficient role');
  const body = await request.json().catch(() => null);
  if (!body?.dataType || body?.retentionDays === undefined) {
    return badRequest('dataType and retentionDays are required');
  }
  const policy = await setRetentionPolicy({
    companyId: ctx.companyId,
    dataType: body.dataType,
    retentionDays: body.retentionDays,
    deletionAction: body.deletionAction,
  });
  return ok({ policy });
}
'''))

ROUTES.append(('compliance/retention/enforce/route.ts', '''/**
 * POST /api/v1/compliance/retention/enforce — enforce retention policies (delete/anonymize expired data)
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok, forbidden } from '@/lib/v1-middleware';
import { enforceRetention } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (ctx.role === 'viewer' || ctx.role === 'client_user' || ctx.role === 'team_member') {
    return forbidden('Insufficient role');
  }
  const result = await enforceRetention(ctx.companyId);
  return ok(result);
}
'''))

ROUTES.append(('compliance/summary/route.ts', '''/**
 * GET /api/v1/compliance/summary — compliance dashboard summary
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';
import { getComplianceSummary } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const summary = await getComplianceSummary(ctx.companyId);
  return ok(summary);
}
'''))

# ── 16. Social Audience Metrics ───────────────────────────────────────────
ROUTES.append(('social/audience-metrics/route.ts', '''/**
 * GET /api/v1/social/audience-metrics — list social audience metrics
 * POST /api/v1/social/audience-metrics — record a metrics snapshot
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');
  const metrics = await db.socialAudienceMetric.findMany({
    where: { companyId: ctx.companyId, ...(platform ? { platform } : {}) },
    orderBy: { recordedAt: 'desc' },
    take: 100,
  });
  return ok({ metrics });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.platform || body?.followersCount === undefined) {
    return badRequest('platform and followersCount are required');
  }
  const metric = await db.socialAudienceMetric.create({
    data: {
      socialAccountId: body.socialAccountId || 'unknown',
      platform: body.platform,
      followersCount: body.followersCount,
      followingCount: body.followingCount || null,
      postsCount: body.postsCount || null,
      engagementRate: body.engagementRate || null,
      avgLikesPerPost: body.avgLikesPerPost || null,
      avgCommentsPerPost: body.avgCommentsPerPost || null,
      growthDelta: body.growthDelta || 0,
      topHashtags: body.topHashtags ? JSON.stringify(body.topHashtags) : null,
      bestPostingTime: body.bestPostingTime || null,
      companyId: ctx.companyId,
    },
  });
  return ok({ metric });
}
'''))

# ── 17. Content Calendar ──────────────────────────────────────────────────
ROUTES.append(('social/content-calendar/route.ts', '''/**
 * GET /api/v1/social/content-calendar — list content calendar items
 * POST /api/v1/social/content-calendar — create a calendar item
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');
  const items = await db.contentCalendarItem.findMany({
    where: { companyId: ctx.companyId, ...(platform ? { platform } : {}) },
    orderBy: { scheduledAt: 'asc' },
    take: 100,
  });
  return ok({ items });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body?.platform || !body?.scheduledAt || !body?.title) {
    return badRequest('platform, scheduledAt, and title are required');
  }
  const item = await db.contentCalendarItem.create({
    data: {
      platform: body.platform,
      scheduledAt: new Date(body.scheduledAt),
      title: body.title,
      contentId: body.contentId || null,
      status: body.status || 'draft',
      aiGenerated: body.aiGenerated || false,
      hashtags: body.hashtags ? JSON.stringify(body.hashtags) : null,
      approvalRequired: body.approvalRequired !== false,
      companyId: ctx.companyId,
    },
  });
  return ok({ item });
}
'''))

# ── 18. Admin Integration Center ──────────────────────────────────────────
ROUTES.append(('admin/integration-center/route.ts', '''/**
 * GET /api/v1/admin/integration-center — global super admin integration center
 *   (provider registry health, free/paid tier monitoring, global audit logs)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok, forbidden } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && ctx.role !== 'company_owner' && ctx.role !== 'admin') {
    return forbidden('Super admin or company admin access required');
  }
  const [providers, integrations, globalAuditLogs, costEvents] = await Promise.all([
    db.dataProvider.findMany({ orderBy: { sourceReliability: 'desc' }, take: 50 }),
    db.integration.findMany({
      where: ctx.isSuperAdmin ? {} : { companyId: ctx.companyId },
      include: { secrets: true, healthChecks: { orderBy: { checkedAt: 'desc' }, take: 1 } },
      take: 50,
    }),
    db.auditLog.findMany({
      where: ctx.isSuperAdmin ? {} : { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.costEvent.findMany({
      where: ctx.isSuperAdmin ? {} : { companyId: ctx.companyId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }),
  ]);

  // Mask secrets before returning
  const maskedIntegrations = integrations.map(i => ({
    ...i,
    secrets: i.secrets.map(s => ({ ...s, ciphertext: '[REDACTED]', maskedValue: s.maskedValue })),
  }));

  return ok({
    providers,
    integrations: maskedIntegrations,
    recentAuditLogs: globalAuditLogs,
    recentCostEvents: costEvents,
    isGlobalView: ctx.isSuperAdmin,
  });
}
'''))

# ── Write all files ────────────────────────────────────────────────────────
for rel_path, content in ROUTES:
    full_path = os.path.join(ROUTES_DIR, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w') as f:
        f.write(content)
    print(f"  ✓ {rel_path}")

print(f"\n✅ Generated {len(ROUTES)} API route files")
