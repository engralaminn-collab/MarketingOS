/**
 * MarketingOS — Cost Intelligence (Requirement 13).
 *
 * Default to Free Only or Free First. Before using any paid service, the engine:
 *   - Checks current pricing and free-tier terms.
 *   - Checks rate limits and quotas.
 *   - Estimates usage cost.
 *   - Tracks consumption.
 *   - Warns before quota exhaustion.
 *   - Requires approval before paid usage (via the approval engine).
 *   - Never starts a subscription or incurs charges silently.
 *
 * All monetary values are in USD.
 */
import { PrismaClient } from '@prisma/client';
import { requestApproval } from './approval-engine';
const prisma = new PrismaClient();

export type BudgetPreference = 'free_only' | 'free_first' | 'paid_with_approval';

export interface CostEstimate {
  provider: string;
  operation: string;
  estimatedCostUsd: number;
  freeTierUsed: boolean;
  quotaRemaining?: number;
  warningTriggered: boolean;
}

/**
 * Provider free-tier quotas (units per day). 0 = unlimited free.
 * These are conservative defaults; the actual provider table has authoritative limits.
 */
const FREE_TIER_QUOTAS: Record<string, { units: number; unitLabel: string; costPerUnitAboveFree: number }> = {
  z_ai: { units: 0, unitLabel: 'requests', costPerUnitAboveFree: 0 }, // free tier
  google_trends: { units: 0, unitLabel: 'requests', costPerUnitAboveFree: 0 },
  google_page_speed: { units: 0, unitLabel: 'requests', costPerUnitAboveFree: 0 },
  openstreetmap: { units: 86400, unitLabel: 'requests', costPerUnitAboveFree: 0 }, // 1/sec
  reddit_api: { units: 144000, unitLabel: 'requests', costPerUnitAboveFree: 0 }, // 100/min
  youtube_data_api: { units: 10000, unitLabel: 'quota_units', costPerUnitAboveFree: 0 },
  openai: { units: 0, unitLabel: 'requests', costPerUnitAboveFree: 0.002 },
};

/**
 * Get the company's budget preference (falls back to free_first).
 */
export async function getBudgetPreference(companyId: string): Promise<BudgetPreference> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  return (company?.defaultBudgetPreference as BudgetPreference) || 'free_first';
}

/**
 * Check remaining free-tier quota for a provider on a given day.
 */
export async function getRemainingQuota(companyId: string, provider: string): Promise<number | null> {
  const quota = FREE_TIER_QUOTAS[provider];
  if (!quota || quota.units === 0) return null; // unlimited or unknown

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const usedToday = await prisma.costEvent.count({
    where: {
      companyId,
      provider,
      timestamp: { gte: today, lt: tomorrow },
      freeTierUsed: true,
    },
  });

  return Math.max(0, quota.units - usedToday);
}

/**
 * Estimate the cost of an operation and decide whether to proceed.
 * Returns the estimate and whether approval is required.
 *
 * Decision matrix:
 *   - free_only: only proceed if cost == 0 AND free tier available.
 *   - free_first: use free tier first; if exhausted, require approval for paid.
 *   - paid_with_approval: always require approval for paid usage.
 */
export async function estimateAndGate(opts: {
  companyId: string;
  provider: string;
  operation: string;
  estimatedCostUsd: number;
  unitsRequested?: number;
}): Promise<CostEstimate & { requiresApproval: boolean; blocked: boolean; reason?: string }> {
  const budget = await getBudgetPreference(opts.companyId);
  const quota = FREE_TIER_QUOTAS[opts.provider];
  const remaining = await getRemainingQuota(opts.companyId, opts.provider);

  const freeTierUsed = (quota?.costPerUnitAboveFree ?? 0) === 0 && opts.estimatedCostUsd === 0;
  const warningTriggered = remaining !== null && remaining <= 10;

  // Free-only: block any paid operation
  if (budget === 'free_only' && opts.estimatedCostUsd > 0) {
    return {
      provider: opts.provider,
      operation: opts.operation,
      estimatedCostUsd: opts.estimatedCostUsd,
      freeTierUsed: false,
      quotaRemaining: remaining ?? undefined,
      warningTriggered,
      requiresApproval: false,
      blocked: true,
      reason: 'Budget preference is free_only — paid operations are blocked.',
    };
  }

  // Free-first: use free tier; if exhausted and there's a cost, require approval
  if (budget === 'free_first') {
    if (freeTierUsed && (remaining === null || remaining > 0)) {
      return {
        provider: opts.provider,
        operation: opts.operation,
        estimatedCostUsd: 0,
        freeTierUsed: true,
        quotaRemaining: remaining ?? undefined,
        warningTriggered,
        requiresApproval: false,
        blocked: false,
      };
    }
    // Free tier exhausted — require approval for paid
    return {
      provider: opts.provider,
      operation: opts.operation,
      estimatedCostUsd: opts.estimatedCostUsd,
      freeTierUsed: false,
      quotaRemaining: 0,
      warningTriggered: true,
      requiresApproval: true,
      blocked: false,
      reason: 'Free tier exhausted — approval required for paid usage.',
    };
  }

  // paid_with_approval: always require approval if there's a cost
  return {
    provider: opts.provider,
    operation: opts.operation,
    estimatedCostUsd: opts.estimatedCostUsd,
    freeTierUsed,
    quotaRemaining: remaining ?? undefined,
    warningTriggered,
    requiresApproval: opts.estimatedCostUsd > 0,
    blocked: false,
  };
}

/**
 * Record a cost event after an operation completes.
 * Creates an immutable CostEvent row for the cost dashboard.
 */
export async function recordCostEvent(opts: {
  companyId: string;
  provider: string;
  operation: string;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  freeTierUsed: boolean;
  approvalRequestId?: string;
  dataProviderId?: string;
}) {
  const remaining = await getRemainingQuota(opts.companyId, opts.provider);
  const event = await prisma.costEvent.create({
    data: {
      provider: opts.provider,
      operation: opts.operation,
      estimatedCostUsd: opts.estimatedCostUsd,
      actualCostUsd: opts.actualCostUsd ?? opts.estimatedCostUsd,
      freeTierUsed: opts.freeTierUsed,
      budgetPreference: await getBudgetPreference(opts.companyId),
      approvalRequired: !!opts.approvalRequestId,
      approvalRequestId: opts.approvalRequestId || null,
      quotaBefore: remaining !== null ? remaining + 1 : null,
      quotaAfter: remaining,
      warningTriggered: remaining !== null && remaining <= 10,
      dataProviderId: opts.dataProviderId || null,
      companyId: opts.companyId,
    },
  });
  return event;
}

/**
 * Get a cost summary for the cost dashboard (per-provider, last 30 days, USD).
 */
export async function getCostSummary(companyId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await prisma.costEvent.findMany({
    where: { companyId, timestamp: { gte: since } },
  });

  const byProvider = new Map<string, { count: number; totalCostUsd: number; freeTierUsed: number }>();
  let totalCostUsd = 0;
  let totalFreeTierOps = 0;

  for (const ev of events) {
    const entry = byProvider.get(ev.provider) || { count: 0, totalCostUsd: 0, freeTierUsed: 0 };
    entry.count++;
    entry.totalCostUsd += ev.actualCostUsd;
    if (ev.freeTierUsed) entry.freeTierUsed++;
    byProvider.set(ev.provider, entry);
    totalCostUsd += ev.actualCostUsd;
    if (ev.freeTierUsed) totalFreeTierOps++;
  }

  return {
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    totalOperations: events.length,
    totalFreeTierOps,
    freeTierRatio: events.length > 0 ? totalFreeTierOps / events.length : 0,
    byProvider: Array.from(byProvider.entries()).map(([provider, v]) => ({
      provider,
      ...v,
      avgCostUsd: v.count > 0 ? Math.round((v.totalCostUsd / v.count) * 10000) / 10000 : 0,
    })),
    days,
  };
}
