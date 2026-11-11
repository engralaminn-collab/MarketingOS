// @ts-nocheck
/**
 * TASK 6: Predictive Intelligence — Lead Conversion Probability
 *
 * POST /api/v1/predictions/lead-conversion
 * Body: { leadId }
 *
 * Uses historical CRM data + lead attributes to estimate conversion probability.
 * NOT a trained ML model — uses statistical baseline from real CRM data.
 * Clearly labels predictions as "insufficient data" when sample size < 30.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { sanitizedJson } from '@/lib/sanitization';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.leadId) return badRequest('leadId required');

  const lead = await db.lead.findFirst({ where: { id: body.leadId, companyId: ctx.companyId } });
  if (!lead) return badRequest('lead not found');

  // Get historical data: leads with same source + status outcomes
  const historicalLeads = await db.lead.findMany({
    where: { companyId: ctx.companyId, source: lead.source },
    select: { status: true, score: true, source: true },
    take: 500,
  });

  const total = historicalLeads.length;
  const won = historicalLeads.filter(l => l.status === 'won').length;
  const lost = historicalLeads.filter(l => l.status === 'lost').length;
  const conversionRate = total > 0 ? won / total : 0;

  // Feature: lead score correlation
  const scoredLeads = historicalLeads.filter(l => l.score > 0);
  const highScoreWon = scoredLeads.filter(l => l.score >= 70 && l.status === 'won').length;
  const highScoreTotal = scoredLeads.filter(l => l.score >= 70).length;
  const highScoreRate = highScoreTotal > 0 ? highScoreWon / highScoreTotal : 0;

  // Prediction
  const leadScoreFactor = lead.score >= 70 ? highScoreRate : conversionRate;
  const confidence = total >= 30 ? 'MEDIUM' : total >= 10 ? 'LOW' : 'INSUFFICIENT_DATA';
  const sufficientData = total >= 30;

  return sanitizedJson({
    predictionId: `PRED-${Date.now()}`,
    tenantId: ctx.companyId,
    modelVersion: 'statistical-baseline-v1',
    inputDataPeriod: `last ${total} leads from source: ${lead.source}`,
    prediction: {
      leadId: lead.id,
      conversionProbability: Math.round(leadScoreFactor * 100),
      confidence,
      sufficientData,
    },
    contributingFactors: [
      { factor: 'Lead Source', value: lead.source, impact: `${Math.round(conversionRate * 100)}% conversion rate for this source` },
      { factor: 'Lead Score', value: lead.score, impact: lead.score >= 70 ? 'High score increases probability' : 'Score below threshold' },
      { factor: 'Historical Sample', value: total, impact: total >= 30 ? 'Statistically meaningful' : 'Sample too small for high confidence' },
    ],
    generatedAt: new Date().toISOString(),
    actualOutcome: lead.status === 'won' ? 'CONVERTED' : lead.status === 'lost' ? 'NOT_CONVERTED' : 'PENDING',
    evaluationStatus: lead.status === 'won' || lead.status === 'lost' ? 'EVALUATED' : 'PENDING',
    disclaimer: sufficientData
      ? 'Prediction based on statistical baseline. Not a guarantee.'
      : 'INSUFFICIENT HISTORICAL DATA — prediction has low confidence. Collect more outcome data.',
  });
}
