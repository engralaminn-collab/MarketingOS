import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { parseStoredWorkflowSteps, validateExecutableSteps } from '@/lib/workflows';

// This is a bounded MANUAL executor, not a background workflow scheduler.
// Local effects and completion are committed in a single database transaction.
// A deterministic run ID makes concurrent retries with the same key safe.
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const key = req.headers.get('Idempotency-Key') || '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
    return NextResponse.json({ error: 'A unique Idempotency-Key (8–128 safe characters) is required.' }, { status: 400 });
  }
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.workflowId !== 'string' || !input.workflowId || input.workflowId.length > 128) return NextResponse.json({ error: 'A valid workflowId is required.' }, { status: 400 });
  const serialized = JSON.stringify({ workflowId: input.workflowId, payload: input.payload ?? null });
  if (Buffer.byteLength(serialized) > 16_384) return NextResponse.json({ error: 'Workflow input exceeds 16 KB.' }, { status: 400 });
  const fingerprint = createHash('sha256').update(serialized).digest('hex');
  const runId = `wf_${createHash('sha256').update(actor.companyId).update('\0').update(key).digest('hex')}`;

  try {
    const existing = await db.workflowRun.findUnique({ where: { id: runId } });
    if (existing) return replay(existing, fingerprint);

    const wf = await db.workflow.findFirst({ where: { id: input.workflowId, companyId: actor.companyId } });
    if (!wf) return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    if (!wf.isActive) return NextResponse.json({ error: 'Workflow is paused.' }, { status: 409 });

    try {
      await db.workflowRun.create({ data: {
        id: runId, workflowId: wf.id, companyId: actor.companyId, status: 'running',
        trigger: 'manual', input: fingerprint,
      } });
    } catch (error) {
      // A concurrent request may have won the unique-ID race. Do not execute it twice.
      const concurrent = await db.workflowRun.findUnique({ where: { id: runId } });
      if (concurrent) return replay(concurrent, fingerprint);
      throw error;
    }

    try {
      const result = await db.$transaction(async (tx) => {
        // Check pause state and configuration again inside the write transaction.
        const current = await tx.workflow.findFirst({ where: { id: wf.id, companyId: actor.companyId! } });
        if (!current || !current.isActive) throw new Error('Workflow was paused before execution.');
        const parsed = parseStoredWorkflowSteps(current.steps);
        const validationError = parsed.error || validateExecutableSteps(parsed.steps);
        if (validationError) {
          await tx.workflowRun.update({ where: { id: runId }, data: { status: 'failed', error: validationError, output: JSON.stringify({ steps: [] }), completedAt: new Date() } });
          await tx.workflow.update({ where: { id: wf.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
          return { status: 'failed', steps: [], error: validationError };
        }

        const outputs: Array<Record<string, unknown>> = [];
        for (const [index, step] of parsed.steps.entries()) {
          const config = step.config || {};
          if (step.type === 'log_activity') {
            const activity = await tx.activity.create({ data: {
              companyId: actor.companyId!, userId: actor.userId, type: 'workflow.step',
              description: (config.description as string)?.trim() || `Manual workflow step: ${current.name}`,
              resourceType: 'workflow', resourceId: current.id,
              metadata: JSON.stringify({ runId, step: index + 1 }),
            }, select: { id: true } });
            outputs.push({ step: index + 1, type: step.type, status: 'completed', activityId: activity.id });
          } else if (step.type === 'create_notification') {
            const recipientId = (config.recipientId as string)?.trim() || actor.userId;
            const member = await tx.companyUser.findFirst({ where: { companyId: actor.companyId!, userId: recipientId }, select: { userId: true } });
            if (!member) throw new Error('Notification recipient is not a member of this workspace.');
            const notification = await tx.notification.create({ data: {
              userId: recipientId, type: 'workflow.step',
              title: (config.title as string)?.trim().slice(0, 180) || `Workflow: ${current.name}`,
              message: (config.message as string)?.trim() || 'A manual workflow step completed.',
              metadata: JSON.stringify({ workflowId: current.id, runId }),
            }, select: { id: true } });
            outputs.push({ step: index + 1, type: step.type, status: 'completed', notificationId: notification.id });
          } else if (step.type === 'email') {
            const draft = await tx.content.create({ data: {
              title: (config.subject as string)?.trim().slice(0, 180) || 'Workflow email draft',
              type: 'email', platform: 'email', status: 'draft', body: (config.body as string) || '',
              creatorId: actor.userId, companyId: actor.companyId!,
            }, select: { id: true } });
            outputs.push({ step: index + 1, type: step.type, status: 'completed', contentId: draft.id, note: 'Draft only; no email was sent.' });
          }
        }
        await tx.auditLog.create({ data: { companyId: actor.companyId!, userId: actor.userId, action: 'workflow.manual_run', resource: 'workflow', resourceId: current.id, details: `Run ${runId}; ${outputs.length} local steps` } });
        await tx.workflow.update({ where: { id: current.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
        await tx.workflowRun.update({ where: { id: runId }, data: { status: 'completed', output: JSON.stringify({ steps: outputs }), completedAt: new Date() } });
        return { status: 'completed', steps: outputs, error: null };
      });
      return NextResponse.json({ data: { runId, ...result }, ...(result.error ? { error: result.error } : {}) }, { status: result.error ? 422 : 200, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      // The transaction rolls back all local effects. Never include raw DB errors.
      const message = 'Workflow could not complete; its local changes were rolled back.';
      await db.workflowRun.update({ where: { id: runId }, data: { status: 'failed', error: message, output: JSON.stringify({ steps: [] }), completedAt: new Date() } }).catch(() => undefined);
      return NextResponse.json({ error: message, data: { runId, status: 'failed', steps: [] } }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not start workflow.' }, { status: 500 });
  }
}

function replay(run: { id: string; input: string | null; status: string; output: string | null; error: string | null }, fingerprint: string) {
  if (run.input !== fingerprint) return NextResponse.json({ error: 'Idempotency-Key was already used with a different request.' }, { status: 409 });
  let steps: unknown[] = [];
  try { const output = JSON.parse(run.output || '{}'); if (Array.isArray(output.steps)) steps = output.steps; } catch { /* retain empty results */ }
  const code = run.status === 'running' ? 202 : run.status === 'completed' ? 200 : 422;
  return NextResponse.json({ data: { runId: run.id, status: run.status, steps, error: run.error, replayed: true }, ...(run.error ? { error: run.error } : {}) }, { status: code, headers: { 'Cache-Control': 'no-store' } });
}
