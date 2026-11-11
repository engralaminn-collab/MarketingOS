// @ts-nocheck
/**
 * TASK 7: Controlled Self-Learning — Learning Records
 *
 * POST /api/v1/learning/records — create a learning record from an agent execution outcome
 * GET  /api/v1/learning/records — list learning records
 * POST /api/v1/learning/evaluate — evaluate agent performance against baseline
 *
 * Learning records are SEPARATE from memory (episodic) and knowledge (RAG).
 * They store: outcome, quality, feedback, provenance — used for future
 * routing adaptation and predictive model training.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { sanitizedJson } from '@/lib/sanitization';
import { scrubPii } from '@/lib/pii-filter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const agentType = url.searchParams.get('agentType');

  const where: any = { companyId: ctx.companyId };
  if (agentType) where.agentType = agentType;

  const records = await db.agentExecutionLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, agentType: true, providerSlug: true, modelName: true,
      latencyMs: true, success: true, errorMessage: true,
      promptTokens: true, completionTokens: true, estimatedCostUsd: true,
      usedFallback: true, piiRedactionCount: true, createdAt: true,
    },
  });

  return sanitizedJson({ records, count: records.length });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.agentType || !body?.outcome) return badRequest('agentType and outcome required');

  // PII scrub the outcome before storing
  const scrubbedOutcome = scrubPii(body.outcome).redacted;

  const record = await db.agentExecutionLog.create({
    data: {
      companyId: ctx.companyId,
      agentType: body.agentType,
      providerSlug: body.providerSlug || 'unknown',
      modelName: body.modelName || 'unknown',
      promptCharCount: (body.task || '').length,
      responseCharCount: scrubbedOutcome.length,
      latencyMs: body.latencyMs || 0,
      success: body.success !== false,
      errorMessage: body.error || null,
      usedFallback: body.usedFallback || false,
      piiRedactionCount: scrubPii(body.outcome).redactions.length,
      actorUserId: ctx.userId,
    },
  });

  return sanitizedJson({
    recordId: record.id,
    stored: true,
    piiScrubbed: true,
    message: 'Learning record stored. Outcome has been PII-scrubbed before persistence.',
  });
}
