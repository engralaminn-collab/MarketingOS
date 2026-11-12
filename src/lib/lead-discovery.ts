/**
 * MarketingOS — Public Lead Discovery Engine (Requirements 5, 6).
 *
 * Discovers potential business customers using permitted public business
 * information. Captures ONLY fields permitted by the source and applicable law.
 * Every discovered lead records full source provenance: source URL, provider,
 * discovery timestamp, applicable usage restrictions, confidence level, data
 * freshness, and review status.
 *
 * The engine NEVER collects private personal information, protected data, or
 * personal contact details without a lawful basis. It NEVER auto-contacts a
 * discovered lead — contact requires explicit consent + lawful-basis verification
 * (the `contactPermitted` flag, set by the compliance workflow).
 *
 * Sources are read from the DataProvider table (Requirement 4 registry). Only
 * providers with integrationStatus = "integrated" are actually queried; others
 * are listed as available-but-not-yet-connected.
 */
import { PrismaClient } from '@prisma/client';
import { computeDedupHash, findDuplicate } from './lead-dedup';
import { scoreLead, persistLeadScore, assessSignalStrength } from './buyer-intent';
const prisma = new PrismaClient();

export interface DiscoveredLeadInput {
  businessName: string;
  officialWebsite?: string;
  publicBusinessCategory?: string;
  businessLocation?: string;
  publicContactChannel?: string; // Only where permitted by source
  publiclyStatedProducts?: string[];
  publicBusinessProfile?: string;
  sourceUrl: string;
  sourceProviderSlug?: string;
  applicableUsageRestrictions?: string;
  confidenceLevel?: 'low' | 'medium' | 'high';
  evidenceOfRelevance?: { text: string; url?: string }[];
  campaignId?: string;
  countryId?: string;
}

export interface DiscoveryResult {
  discoveredLeadId: string;
  leadId?: string; // If promoted to CRM
  isDuplicate: boolean;
  duplicateOfId?: string;
  score: number;
  recommendation: string;
}

/**
 * Record a discovered lead with full provenance (Requirement 6 mandatory fields).
 * Automatically deduplicates against existing records.
 * Optionally scores the lead and promotes it to the CRM Lead table.
 */
export async function recordDiscoveredLead(
  companyId: string,
  input: DiscoveredLeadInput,
): Promise<DiscoveryResult> {
  // Resolve the source provider
  let providerId: string | null = null;
  if (input.sourceProviderSlug) {
    const provider = await prisma.dataProvider.findUnique({
      where: { slug: input.sourceProviderSlug },
    });
    if (provider) providerId = provider.id;
  }

  // Compute dedup hash (tenant-scoped)
  const dedupHash = computeDedupHash({
    businessName: input.businessName,
    website: input.officialWebsite,
    location: input.businessLocation,
    companyId,
  });

  // Check for duplicates (tenant-scoped)
  const existing = await findDuplicate(companyId, dedupHash);
  if (existing) {
    // Record a LeadActivity noting the re-discovery (source attribution) if it's a CRM Lead
    if ('score' in existing && existing.id) {
      await prisma.leadActivity.create({
        data: {
          leadId: existing.id,
          type: 're_discovered',
          content: `Re-discovered from ${input.sourceUrl} via ${input.sourceProviderSlug || 'manual'}`,
        },
      }).catch(() => null);
    }
    return {
      discoveredLeadId: existing.id,
      isDuplicate: true,
      duplicateOfId: existing.id,
      score: 'score' in existing ? (existing as any).score : 0,
      recommendation: 'duplicate',
    };
  }

  // Create the DiscoveredLead record with full provenance
  const discovered = await prisma.discoveredLead.create({
    data: {
      businessName: input.businessName,
      officialWebsite: input.officialWebsite || null,
      publicBusinessCategory: input.publicBusinessCategory || null,
      businessLocation: input.businessLocation || null,
      countryId: input.countryId || null,
      publicContactChannel: input.publicContactChannel || null,
      publiclyStatedProducts: input.publiclyStatedProducts ? JSON.stringify(input.publiclyStatedProducts) : null,
      publicBusinessProfile: input.publicBusinessProfile || null,
      sourceUrl: input.sourceUrl,
      sourceProviderId: providerId,
      discoveryTimestamp: new Date(),
      applicableUsageRestrictions: input.applicableUsageRestrictions || null,
      confidenceLevel: input.confidenceLevel || 'medium',
      dataFreshness: 'fresh',
      reviewStatus: 'pending',
      evidenceOfRelevance: input.evidenceOfRelevance ? JSON.stringify(input.evidenceOfRelevance) : null,
      dedupHash,
      campaignId: input.campaignId || null,
      companyId,
    },
  });

  // Score the lead
  const provider = providerId ? await prisma.dataProvider.findUnique({ where: { id: providerId } }) : null;
  const scoreResult = scoreLead({
    businessName: input.businessName,
    businessCategory: input.publicBusinessCategory,
    businessLocation: input.businessLocation,
    website: input.officialWebsite,
    sourceUrl: input.sourceUrl,
    discoveryTimestamp: new Date(),
    sourceReliability: provider?.sourceReliability,
    intentSignals: input.evidenceOfRelevance?.map(e => ({
      signalType: 'public_request' as const,
      evidenceUrl: e.url,
      evidenceText: e.text,
      signalStrength: assessSignalStrength('public_request', e.text),
    })),
  });

  // Promote to CRM Lead table (status = discovered, contactPermitted = false)
  const lead = await prisma.lead.create({
    data: {
      name: input.businessName,
      companyName: input.businessName,
      source: input.sourceProviderSlug || 'public_discovery',
      status: 'discovered',
      score: scoreResult.totalScore,
      sourceUrl: input.sourceUrl,
      discoveryTimestamp: new Date(),
      confidenceLevel: input.confidenceLevel || 'medium',
      dataFreshness: 'fresh',
      reviewStatus: 'pending',
      applicableUsageRestrictions: input.applicableUsageRestrictions || null,
      dedupHash,
      contactPermitted: false, // NEVER auto-contact
      optedOut: false,
      countryId: input.countryId || null,
      campaignId: input.campaignId || null,
      discoveredLeadId: discovered.id,
      companyId,
    },
  });

  // Link discovered lead to the CRM lead
  await prisma.discoveredLead.update({
    where: { id: discovered.id },
    data: { leadId: lead.id },
  });

  // Persist score breakdown + intent signals
  await persistLeadScore(lead.id, companyId, scoreResult);

  return {
    discoveredLeadId: discovered.id,
    leadId: lead.id,
    isDuplicate: false,
    score: scoreResult.totalScore,
    recommendation: scoreResult.recommendation,
  };
}

/**
 * List discovered leads for a company, with provenance.
 */
export async function listDiscoveredLeads(companyId: string, opts?: {
  campaignId?: string;
  reviewStatus?: string;
  minScore?: number;
  limit?: number;
}) {
  return prisma.discoveredLead.findMany({
    where: {
      companyId,
      ...(opts?.campaignId ? { campaignId: opts.campaignId } : {}),
      ...(opts?.reviewStatus ? { reviewStatus: opts.reviewStatus } : {}),
      ...(opts?.minScore ? { lead: { score: { gte: opts.minScore } } } : {}),
    },
    include: {
      sourceProvider: { select: { name: true, slug: true, sourceReliability: true } },
      campaign: { select: { id: true, name: true } },
    },
    orderBy: { discoveryTimestamp: 'desc' },
    take: opts?.limit || 50,
  });
}

/**
 * Verify a discovered lead's data (mark as reviewed).
 * This is the human-in-the-loop step before any contact.
 */
export async function reviewDiscoveredLead(
  discoveredLeadId: string,
  companyId: string,
  reviewStatus: 'reviewed' | 'approved' | 'rejected',
  reviewerNote?: string,
) {
  const updated = await prisma.discoveredLead.updateMany({
    where: { id: discoveredLeadId, companyId },
    data: { reviewStatus },
  });
  if (updated.count === 0) throw new Error('Discovered lead not found or not owned by this tenant');

  // If approved, update the linked CRM lead's review status too
  if (reviewStatus === 'approved') {
    const dl = await prisma.discoveredLead.findUnique({ where: { id: discoveredLeadId } });
    if (dl?.leadId) {
      await prisma.lead.update({
        where: { id: dl.leadId },
        data: { reviewStatus: 'approved' },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: 'discovered_lead.reviewed',
      resource: 'discovered_lead',
      resourceId: discoveredLeadId,
      details: `Reviewed discovered lead: ${reviewStatus}. ${reviewerNote || ''}`,
      companyId,
    },
  }).catch(() => { /* non-blocking audit */ });

  return { discoveredLeadId, reviewStatus };
}

/**
 * Verify contact permission for a lead before any outbound contact.
 * Sets contactPermitted = true ONLY if:
 *   1. Lead has been reviewed/approved.
 *   2. Consent has been captured (Consent table) OR a lawful basis exists.
 *   3. Lead is not on the suppression list (DNC).
 *   4. Lead has not opted out.
 */
export async function verifyContactPermission(leadId: string, companyId: string): Promise<{
  permitted: boolean;
  reason: string;
}> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, companyId } });
  if (!lead) return { permitted: false, reason: 'Lead not found.' };

  if (lead.optedOut) return { permitted: false, reason: 'Lead has opted out.' };
  if (lead.reviewStatus !== 'approved') {
    return { permitted: false, reason: 'Lead has not been reviewed and approved.' };
  }

  // Check suppression list (DNC)
  if (lead.phone) {
    const suppressed = await prisma.suppressionList.findUnique({
      where: { companyId_phoneNumber: { companyId, phoneNumber: lead.phone } },
    });
    if (suppressed) return { permitted: false, reason: 'Lead phone number is on the DNC suppression list.' };
  }

  // Check consent record exists for marketing contact
  const consent = await prisma.consent.findFirst({
    where: {
      companyId,
      subjectType: 'lead',
      subjectId: lead.id,
      kind: { in: ['marketing_sms', 'marketing_email'] },
      revokedAt: null,
    },
  });

  if (!consent) {
    return {
      permitted: false,
      reason: 'No marketing consent captured. A lawful basis is required before contact.',
    };
  }

  // All checks passed — mark as contact permitted
  await prisma.lead.update({
    where: { id: leadId },
    data: { contactPermitted: true, status: 'contact_permitted' },
  });

  return { permitted: true, reason: 'Contact permitted — consent verified and lead approved.' };
}
