// @ts-nocheck
/**
 * TASK 6: Predictive Intelligence — Customer Churn Risk
 *
 * POST /api/v1/predictions/churn-risk
 * Body: { customerId }
 *
 * Estimates churn risk based on customer interaction recency, deal status,
 * and support ticket history. Statistical baseline, not trained ML.
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
  if (!body?.customerId) return badRequest('customerId required');

  const customer = await db.customer.findFirst({ where: { id: body.customerId, companyId: ctx.companyId } });
  if (!customer) return badRequest('customer not found');

  // Gather signals
  const [deals, tickets, messages, recentActivities] = await Promise.all([
    db.deal.findMany({ where: { companyId: ctx.companyId }, take: 100, select: { stage: true, value: true, updatedAt: true } }),
    db.ticket.findMany({ where: { companyId: ctx.companyId, status: { in: ['open', 'in_progress'] } }, select: { id: true, priority: true, createdAt: true } }),
    db.message.findMany({ where: { OR: [{ senderId: ctx.userId }, { recipientId: ctx.userId }] }, select: { createdAt: true }, take: 50 }),
    db.activity.findMany({ where: { companyId: ctx.companyId }, orderBy: { createdAt: 'desc' }, take: 20, select: { createdAt: true, type: true } }),
  ]);

  // Calculate risk factors
  const now = Date.now();
  const lastActivity = recentActivities[0]?.createdAt ? new Date(recentActivities[0].createdAt).getTime() : 0;
  const daysSinceActivity = lastActivity > 0 ? Math.floor((now - lastActivity) / 86400000) : 999;
  const openTickets = tickets.length;
  const highPriorityTickets = tickets.filter(t => t.priority === 'high' || t.priority === 'urgent').length;

  // Risk scoring (0-100, higher = more risk)
  let riskScore = 0;
  if (daysSinceActivity > 90) riskScore += 40;
  else if (daysSinceActivity > 60) riskScore += 25;
  else if (daysSinceActivity > 30) riskScore += 15;
  else if (daysSinceActivity > 14) riskScore += 5;

  if (openTickets > 5) riskScore += 25;
  else if (openTickets > 2) riskScore += 15;
  else if (openTickets > 0) riskScore += 5;

  if (highPriorityTickets > 0) riskScore += 20;

  const wonDeals = deals.filter(d => d.stage === 'closed_won').length;
  if (wonDeals === 0) riskScore += 15;

  riskScore = Math.min(riskScore, 100);

  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';
  const confidence = deals.length + tickets.length + messages.length >= 30 ? 'MEDIUM' : 'LOW';

  return sanitizedJson({
    predictionId: `CHURN-${Date.now()}`,
    modelVersion: 'statistical-baseline-v1',
    prediction: {
      customerId: customer.id,
      churnRiskScore: riskScore,
      riskLevel,
      confidence,
    },
    contributingFactors: [
      { factor: 'Days Since Last Activity', value: daysSinceActivity, impact: daysSinceActivity > 30 ? 'High risk indicator' : 'Normal' },
      { factor: 'Open Support Tickets', value: openTickets, impact: openTickets > 2 ? 'Elevated risk' : 'Normal' },
      { factor: 'High Priority Tickets', value: highPriorityTickets, impact: highPriorityTickets > 0 ? 'Critical risk indicator' : 'None' },
      { factor: 'Won Deals', value: wonDeals, impact: wonDeals === 0 ? 'No successful conversions — elevated risk' : 'Has conversions' },
    ],
    recommendedActions: riskLevel === 'HIGH'
      ? ['Immediate follow-up call within 24 hours', 'Escalate to customer success manager', 'Review all open tickets']
      : riskLevel === 'MEDIUM'
      ? ['Schedule follow-up within 1 week', 'Review ticket status', 'Send engagement email']
      : ['Continue normal cadence', 'Monitor for changes'],
    generatedAt: new Date().toISOString(),
    disclaimer: 'Statistical baseline prediction. Not a trained ML model. Collect more outcome data for higher confidence.',
  });
}
