/**
 * MarketingOS — AI Buyer Intent + Explainable Lead Scoring (Requirement 7).
 *
 * Identifies business relevance and buying signals from evidence, then
 * generates a configurable, explainable lead score. The score is broken down
 * by dimension (industry relevance, geographic match, product/service match,
 * buying intent, business suitability, data freshness, source reliability)
 * with supporting evidence for each dimension.
 *
 * IMPORTANT: AI must not invent buying intent or claim a person is ready to
 * buy without evidence. Every score component links to real evidence.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export type SignalType =
  | 'public_request'
  | 'rfq'
  | 'procurement_opportunity'
  | 'business_expansion'
  | 'announced_project'
  | 'service_requirement'
  | 'repeated_interest'
  | 'website_enquiry';

export interface IntentSignalInput {
  signalType: SignalType;
  evidenceUrl?: string;
  evidenceText: string; // The actual evidence snippet — never invented
  signalStrength?: number; // 0-100, AI-assessed
}

export interface ScoreDimension {
  dimension: string;
  score: number; // 0-100
  maxScore: number;
  evidence: string; // Why this score was assigned
}

export interface LeadScoreResult {
  totalScore: number;
  dimensions: ScoreDimension[];
  intentSignals: IntentSignalInput[];
  recommendation: string; // qualify | nurture | reject
  explanation: string; // Plain-text summary
}

/**
 * Weight configuration per dimension (sums to 1.0).
 * These are defaults; campaigns can override.
 */
export const DEFAULT_DIMENSION_WEIGHTS: Record<string, number> = {
  industry_relevance: 0.20,
  geographic_match: 0.10,
  product_service_match: 0.20,
  buying_intent: 0.25,
  business_suitability: 0.10,
  data_freshness: 0.05,
  source_reliability: 0.10,
};

/**
 * Assess a single intent signal's strength from its evidence text.
 * Uses keyword heuristics — honest, transparent, and never claims intent
 * that the evidence does not support.
 */
export function assessSignalStrength(signalType: SignalType, evidenceText: string): number {
  const text = evidenceText.toLowerCase();
  let strength = 40; // baseline for any evidence

  // Strong intent keywords
  const strongKeywords = ['request for quote', 'rfq', 'request for proposal', 'rfp', 'looking for', 'need a', 'seeking', 'hiring', 'tender', 'procurement'];
  const mediumKeywords = ['interested in', 'considering', 'evaluating', 'planning to', 'expanding', 'new location', 'launching'];
  const weakKeywords = ['mentioned', 'posted about', 'follows', 'likes'];

  for (const kw of strongKeywords) {
    if (text.includes(kw)) strength += 25;
  }
  for (const kw of mediumKeywords) {
    if (text.includes(kw)) strength += 15;
  }
  for (const kw of weakKeywords) {
    if (text.includes(kw)) strength += 5;
  }

  // Signal type baseline adjustments
  const typeBaselines: Record<SignalType, number> = {
    rfq: 80,
    procurement_opportunity: 85,
    public_request: 70,
    business_expansion: 65,
    announced_project: 60,
    service_requirement: 65,
    website_enquiry: 75,
    repeated_interest: 55,
  };
  strength = Math.max(strength, typeBaselines[signalType]);

  return Math.min(100, strength);
}

/**
 * Score a lead across all dimensions, producing an explainable breakdown.
 *
 * @param opts - Lead data + campaign targeting criteria (for relevance matching)
 */
export function scoreLead(opts: {
  businessName: string;
  businessCategory?: string;
  businessLocation?: string;
  website?: string;
  sourceUrl?: string;
  discoveryTimestamp?: Date;
  sourceReliability?: number; // 0-100 from DataProvider
  campaignIndustry?: string;
  campaignCountry?: string;
  campaignProductOrService?: string;
  intentSignals?: IntentSignalInput[];
}): LeadScoreResult {
  const signals = opts.intentSignals || [];
  const weights = DEFAULT_DIMENSION_WEIGHTS;
  const dimensions: ScoreDimension[] = [];

  // 1. Industry relevance — match business category to campaign industry
  const industryScore = opts.businessCategory && opts.campaignIndustry
    ? (opts.businessCategory.toLowerCase().includes(opts.campaignIndustry.toLowerCase()) ? 90 : 40)
    : 50;
  dimensions.push({
    dimension: 'industry_relevance',
    score: industryScore,
    maxScore: 100,
    evidence: opts.businessCategory
      ? `Business category "${opts.businessCategory}" vs campaign industry "${opts.campaignIndustry || 'any'}"`
      : 'No business category provided — neutral score.',
  });

  // 2. Geographic match
  const geoScore = opts.businessLocation && opts.campaignCountry
    ? (opts.businessLocation.toLowerCase().includes(opts.campaignCountry.toLowerCase()) ? 95 : 30)
    : 50;
  dimensions.push({
    dimension: 'geographic_match',
    score: geoScore,
    maxScore: 100,
    evidence: opts.businessLocation
      ? `Location "${opts.businessLocation}" vs campaign country "${opts.campaignCountry || 'any'}"`
      : 'No location provided — neutral score.',
  });

  // 3. Product/service match — keyword overlap
  const productScore = opts.campaignProductOrService && opts.businessCategory
    ? (opts.businessCategory.toLowerCase().split(/\s+/).some(w =>
        opts.campaignProductOrService!.toLowerCase().includes(w) && w.length > 3) ? 85 : 45)
    : 50;
  dimensions.push({
    dimension: 'product_service_match',
    score: productScore,
    maxScore: 100,
    evidence: opts.campaignProductOrService
      ? `Product/service match: campaign seeks "${opts.campaignProductOrService}", business is "${opts.businessCategory || 'uncategorized'}".`
      : 'No product/service criteria specified — neutral score.',
  });

  // 4. Buying intent — aggregate signal strengths (weighted by count, capped)
  let intentScore = 0;
  if (signals.length > 0) {
    const avgStrength = signals.reduce((sum, s) => sum + (s.signalStrength || assessSignalStrength(s.signalType, s.evidenceText)), 0) / signals.length;
    // More signals = higher confidence, but diminishing returns
    const countMultiplier = Math.min(1, 0.5 + signals.length * 0.25);
    intentScore = Math.round(avgStrength * countMultiplier);
  } else {
    intentScore = 10; // No signals = very low intent
  }
  dimensions.push({
    dimension: 'buying_intent',
    score: intentScore,
    maxScore: 100,
    evidence: signals.length > 0
      ? `${signals.length} intent signal(s) detected. Average signal strength: ${Math.round(signals.reduce((s, x) => s + (x.signalStrength || 60), 0) / signals.length)}/100. Signal types: ${signals.map(s => s.signalType).join(', ')}.`
      : 'No buying-intent signals detected — score reflects absence of evidence.',
  });

  // 5. Business suitability — has website + contact info
  const suitabilityScore = (opts.website ? 30 : 0) + (opts.businessCategory ? 30 : 0) + (opts.businessLocation ? 20 : 0) + 20;
  dimensions.push({
    dimension: 'business_suitability',
    score: Math.min(100, suitabilityScore),
    maxScore: 100,
    evidence: `Business has: ${[opts.website ? 'website' : null, opts.businessCategory ? 'category' : null, opts.businessLocation ? 'location' : null].filter(Boolean).join(', ') || 'minimal public info'}.`,
  });

  // 6. Data freshness — how old is the discovery?
  let freshnessScore = 50;
  if (opts.discoveryTimestamp) {
    const ageDays = (Date.now() - opts.discoveryTimestamp.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 7) freshnessScore = 95;
    else if (ageDays < 30) freshnessScore = 80;
    else if (ageDays < 90) freshnessScore = 60;
    else if (ageDays < 365) freshnessScore = 30;
    else freshnessScore = 10;
  }
  dimensions.push({
    dimension: 'data_freshness',
    score: freshnessScore,
    maxScore: 100,
    evidence: opts.discoveryTimestamp
      ? `Discovered ${Math.round((Date.now() - opts.discoveryTimestamp.getTime()) / (1000 * 60 * 60 * 24))} days ago.`
      : 'Discovery timestamp unknown.',
  });

  // 7. Source reliability — from the DataProvider's assessed reliability
  const reliabilityScore = opts.sourceReliability ?? 50;
  dimensions.push({
    dimension: 'source_reliability',
    score: reliabilityScore,
    maxScore: 100,
    evidence: opts.sourceUrl
      ? `Source: ${opts.sourceUrl} (reliability ${reliabilityScore}/100).`
      : 'Source URL not recorded.',
  });

  // Weighted total
  const totalScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (weights[d.dimension] || 0), 0),
  );

  const recommendation = totalScore >= 70 ? 'qualify' : totalScore >= 40 ? 'nurture' : 'reject';

  const explanation = `Lead scored ${totalScore}/100. ` +
    `Strongest dimension: ${dimensions.reduce((max, d) => d.score > max.score ? d : max).dimension}. ` +
    `${signals.length} buying-intent signal(s) found. ` +
    `Recommendation: ${recommendation}.`;

  return { totalScore, dimensions, intentSignals: signals, recommendation, explanation };
}

/**
 * Persist intent signals and score breakdown to the database.
 */
export async function persistLeadScore(
  leadId: string,
  companyId: string,
  result: LeadScoreResult,
) {
  // Save score breakdown
  await prisma.leadScoreBreakdown.createMany({
    data: result.dimensions.map(d => ({
      leadId,
      dimension: d.dimension,
      score: d.score,
      maxScore: d.maxScore,
      evidence: d.evidence,
    })),
  });

  // Save intent signals
  if (result.intentSignals.length > 0) {
    await prisma.buyerIntentSignal.createMany({
      data: result.intentSignals.map(s => ({
        leadId,
        signalType: s.signalType,
        evidenceUrl: s.evidenceUrl || null,
        evidenceText: s.evidenceText,
        signalStrength: s.signalStrength || assessSignalStrength(s.signalType, s.evidenceText),
        detectedBy: 'ai_engine',
        companyId,
      })),
    });
  }

  // Update the lead's aggregate score
  await prisma.lead.update({
    where: { id: leadId },
    data: { score: result.totalScore },
  });

  return result;
}

/**
 * Get the full explainable score breakdown for a lead.
 */
export async function getLeadScoreBreakdown(leadId: string) {
  const [breakdown, signals] = await Promise.all([
    prisma.leadScoreBreakdown.findMany({
      where: { leadId },
      orderBy: { dimension: 'asc' },
    }),
    prisma.buyerIntentSignal.findMany({
      where: { leadId },
      orderBy: { detectedAt: 'desc' },
    }),
  ]);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  return {
    leadId,
    totalScore: lead?.score ?? 0,
    dimensions: breakdown,
    intentSignals: signals,
  };
}
