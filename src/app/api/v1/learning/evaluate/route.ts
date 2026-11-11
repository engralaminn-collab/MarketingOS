// @ts-nocheck
/**
 * TASK 7: Controlled Self-Learning — Agent Performance Evaluation
 *
 * POST /api/v1/learning/evaluate
 * Body: { agentType, baselinePeriod (days) }
 *
 * Compares recent agent performance against a historical baseline.
 * Does NOT automatically change routing — outputs a recommendation
 * that requires human approval before implementation.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest } from '@/lib/v1-middleware';
import { sanitizedJson } from '@/lib/sanitization';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.agentType) return badRequest('agentType required');

  const baselineDays = body.baselinePeriod || 30;
  const now = new Date();
  const recentStart = new Date(now.getTime() - 7 * 86400000); // last 7 days
  const baselineStart = new Date(now.getTime() - baselineDays * 86400000);

  const [recent, baseline] = await Promise.all([
    db.agentExecutionLog.findMany({
      where: { companyId: ctx.companyId, agentType: body.agentType, createdAt: { gte: recentStart } },
      select: { success: true, latencyMs: true, usedFallback: true, estimatedCostUsd: true, promptTokens: true, completionTokens: true },
    }),
    db.agentExecutionLog.findMany({
      where: { companyId: ctx.companyId, agentType: body.agentType, createdAt: { gte: baselineStart, lt: recentStart } },
      select: { success: true, latencyMs: true, usedFallback: true, estimatedCostUsd: true, promptTokens: true, completionTokens: true },
    }),
  ]);

  const calcStats = (records: any[]) => {
    if (records.length === 0) return { count: 0, successRate: 0, avgLatency: 0, fallbackRate: 0, avgCost: 0 };
    const success = records.filter(r => r.success).length;
    const fallbacks = records.filter(r => r.usedFallback).length;
    const totalLatency = records.reduce((s, r) => s + (r.latencyMs || 0), 0);
    const totalCost = records.reduce((s, r) => s + (r.estimatedCostUsd || 0), 0);
    return {
      count: records.length,
      successRate: Math.round((success / records.length) * 100),
      avgLatency: Math.round(totalLatency / records.length),
      fallbackRate: Math.round((fallbacks / records.length) * 100),
      avgCost: Math.round(totalCost / records.length * 1000) / 1000,
    };
  };

  const recentStats = calcStats(recent);
  const baselineStats = calcStats(baseline);

  const successRateDelta = recentStats.count > 0 && baselineStats.count > 0
    ? recentStats.successRate - baselineStats.successRate : 0;
  const latencyDelta = recentStats.count > 0 && baselineStats.count > 0
    ? recentStats.avgLatency - baselineStats.avgLatency : 0;

  const recommendation = successRateDelta < -10
    ? 'PERFORMANCE_DECLINE: Success rate dropped significantly. Consider reviewing agent configuration or switching model.'
    : successRateDelta > 10
    ? 'PERFORMANCE_IMPROVEMENT: Success rate improved. Current configuration is working well.'
    : 'STABLE: No significant change from baseline.';

  return sanitizedJson({
    agentType: body.agentType,
    evaluationPeriod: { recent: '7 days', baseline: `${baselineDays} days` },
    recent: recentStats,
    baseline: baselineStats,
    delta: {
      successRate: successRateDelta,
      avgLatencyMs: latencyDelta,
    },
    recommendation,
    approvalRequired: 'Any routing or configuration changes based on this evaluation require human approval.',
    autoChange: false,
  });
}
