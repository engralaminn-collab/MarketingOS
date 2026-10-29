import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { generateChatCompletion } from '@/lib/ai-provider';
import { analyzeAiWritingTells } from '@/lib/ai-extensions';

type WorkflowStep = { type?: unknown; label?: unknown; config?: Record<string, unknown> };

function text(value: unknown, max = 10_000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeStepType(step: WorkflowStep): string {
  return typeof step.type === 'string' ? step.type : '';
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const actor = await verifyToken(token);
  if (!actor?.companyId || !actor.userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const workflowId = text(body?.workflowId, 128);
  if (!workflowId) return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });

  try {
    const wf = await db.workflow.findFirst({
      where: { id: workflowId, companyId: actor.companyId },
    });
    if (!wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    if (!wf.isActive) return NextResponse.json({ error: 'Workflow is inactive; activate it before running' }, { status: 409 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(wf.steps || '[]');
    } catch {
      return NextResponse.json({ error: 'Workflow steps are invalid JSON' }, { status: 422 });
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) {
      return NextResponse.json({ error: 'Workflow must contain between 1 and 20 steps' }, { status: 422 });
    }

    const steps = parsed as WorkflowStep[];
    const outputs: Array<Record<string, unknown>> = [];
    let workingText = '';
    let failedAt: number | null = null;
    let errorMessage: string | null = null;
    const triggerPayload = body?.payload && typeof body.payload === 'object' ? body.payload : {};

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const type = safeStepType(step);
      const config = step.config && typeof step.config === 'object' ? step.config : {};
      const startedAt = Date.now();
      try {
        if (type === 'delay') {
          const seconds = Number(config.seconds ?? 1);
          if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5) {
            throw new Error('Delay must be between 0 and 5 seconds per step');
          }
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
          outputs.push({ step: i + 1, type, status: 'completed', durationMs: Date.now() - startedAt });
          continue;
        }

        if (type === 'free_llm_draft' || type === 'ai_draft') {
          const topic = text(config.topic || config.subject || wf.description || wf.name, 1_000);
          const platform = text(config.platform, 80) || 'general marketing';
          const audience = text(config.audience, 500) || 'the target customer';
          const userContext = JSON.stringify(triggerPayload).slice(0, 4_000);
          const completion = await generateChatCompletion([
            {
              role: 'system',
              content: 'You are a senior marketing operator. Create specific, factual, brand-safe marketing copy. Never invent customer results, testimonials, statistics, or product features. Return only the draft. Do not publish or send it.',
            },
            {
              role: 'user',
              content: `Create a ${platform} marketing draft. Topic/campaign: ${topic}. Audience: ${audience}. Workflow: ${wf.name}. Trigger context: ${userContext}`,
            },
          ], { temperature: 0.4, maxTokens: 1800, timeoutMs: 90_000 });
          workingText = completion.content;
          outputs.push({
            step: i + 1, type, status: 'completed', durationMs: Date.now() - startedAt,
            provider: completion.provider, model: completion.model, outputLength: workingText.length,
          });
          continue;
        }

        if (type === 'humanizer_qa') {
          if (!workingText) throw new Error('No draft exists to quality-check. Run an AI draft step first.');
          const report = analyzeAiWritingTells(workingText);
          const maxScore = Number(config.maxScore ?? 15);
          const passed = Number.isFinite(maxScore) && report.aiSlopScore < maxScore;
          if (!passed && typeof report.rewrittenDeterministic === 'string' && report.rewrittenDeterministic.trim()) {
            workingText = report.rewrittenDeterministic;
          }
          outputs.push({
            step: i + 1, type, status: passed ? 'passed' : 'review_required',
            aiSlopScore: report.aiSlopScore, detectedRuleCount: report.hits.length,
            rewritten: !passed && Boolean(report.rewrittenDeterministic),
            durationMs: Date.now() - startedAt,
          });
          if (!passed && config.failOnQa === true) {
            throw new Error(`Humanizer QA score ${report.aiSlopScore} did not meet the configured threshold ${maxScore}`);
          }
          continue;
        }

        if (type === 'save_draft' || type === 'create_content_draft' || type === 'draft_email' || type === 'email') {
          const title = text(config.title || config.subject || wf.name, 180);
          const contentBody = text(config.body, 100_000) || workingText;
          if (!contentBody) throw new Error('No content is available to save. Add a body or run an AI draft step first.');
          const contentType = type === 'draft_email' || type === 'email' ? 'email' : text(config.contentType, 40) || 'post';
          const created = await db.content.create({
            data: {
              title,
              type: contentType,
              status: 'draft',
              body: contentBody,
              platform: text(config.platform, 64) || null,
              aiGenerated: type === 'save_draft' || type === 'create_content_draft' || type === 'draft_email' ? Boolean(workingText) : Boolean(workingText),
              creatorId: actor.userId,
              companyId: actor.companyId,
            },
            select: { id: true, title: true, status: true, type: true },
          });
          outputs.push({
            step: i + 1, type, status: 'draft_created', contentId: created.id,
            title: created.title, contentType: created.type, durationMs: Date.now() - startedAt,
            note: 'Saved as a draft. This step does not publish or send content.',
          });
          continue;
        }

        if (type === 'create_notification' || type === 'log_activity') {
          const title = text(config.title || step.label || wf.name, 180);
          const description = text(config.message || config.description || `Workflow step ${i + 1} completed`, 1_000);
          await emitEvent({
            companyId: actor.companyId,
            userId: actor.userId,
            type: type === 'create_notification' ? 'workflow.notification' : 'workflow.activity',
            title,
            description,
            resourceType: 'workflow',
            resourceId: wf.id,
          });
          outputs.push({ step: i + 1, type, status: 'completed', durationMs: Date.now() - startedAt });
          continue;
        }

        if (type === 'sms') {
          const to = text(config.to, 80);
          const message = text(config.body, 2_000) || workingText;
          if (!to || !message) throw new Error('SMS step requires a recipient and message body');
          const queued = await db.smsMessage.create({
            data: { to, body: message, status: 'queued', companyId: actor.companyId, sentBy: actor.userId },
            select: { id: true, status: true },
          });
          outputs.push({
            step: i + 1, type, status: 'queued', smsId: queued.id, durationMs: Date.now() - startedAt,
            note: 'Queued for delivery; this workflow step does not prove provider delivery.',
          });
          continue;
        }

        throw new Error(`Unsupported workflow step type "${type || '(missing)'}". No action was performed for this step.`);
      } catch (error) {
        failedAt = i + 1;
        errorMessage = error instanceof Error ? error.message : String(error);
        outputs.push({ step: i + 1, type: type || 'unknown', status: 'failed', error: errorMessage, durationMs: Date.now() - startedAt });
        break;
      }
    }

    const status = errorMessage ? 'failed' : 'completed';
    await db.workflow.update({
      where: { id: wf.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });
    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: errorMessage ? 'workflow.run_failed' : 'workflow.run_completed',
      title: `Workflow "${wf.name}" ${errorMessage ? 'failed' : 'completed'}`,
      description: errorMessage ? `Failed at step ${failedAt}: ${errorMessage}` : `${steps.length} steps completed`,
      resourceType: 'workflow',
      resourceId: wf.id,
      metadata: { status, failedAt, stepsCompleted: outputs.filter((o) => o.status === 'completed' || o.status === 'passed' || o.status === 'draft_created' || o.status === 'queued').length },
    });

    return NextResponse.json({
      data: { status, steps: outputs, error: errorMessage, failedAt },
    }, { status: errorMessage ? 422 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[POST /api/workflows/execute]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workflow execution failed' }, { status: 500 });
  }
}
