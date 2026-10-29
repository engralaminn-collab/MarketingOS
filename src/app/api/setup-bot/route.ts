import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readJson, requireKeys, setupActor } from '@/lib/setup-bot/request';
import { buildPayload, importSetup, overallVerification } from '@/lib/setup-bot/import';
import { externalHandoffConfigured, sendExternalHandoff } from '@/lib/setup-bot/handoff';
import { clearChangedDestinations, decodeData, encodeData, firstUnanswered, IDLE_MS, invalidateChecks, newSetupData, stepsFor, toSnapshot, type SessionRow, type SetupData } from '@/lib/setup-bot/state';
import { runHealthChecks, SetupError, validateField, verifyField } from '@/lib/setup-bot/validation';
import type { SessionUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown): Response {
  // Never log exceptions here: provider errors or malformed inputs can contain secrets.
  const status = error instanceof SetupError ? error.status : 500;
  return NextResponse.json({ error: error instanceof SetupError ? error.message : 'Setup could not be completed. Please try again.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function getOrCreate(actor: SessionUser): Promise<SessionRow> {
  const where = { companyId_userId: { companyId: actor.companyId, userId: actor.userId } };
  const existing = await db.setupSession.findUnique({ where });
  if (existing) return existing;
  const data = newSetupData();
  try {
    return await db.setupSession.create({ data: {
      companyId: actor.companyId, userId: actor.userId,
      currentStep: stepsFor(data)[0].id, encryptedData: encodeData(data),
    } });
  } catch (error) {
    // A second tab may have created the draft at the same time.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      const concurrent = await db.setupSession.findUnique({ where });
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

async function pauseIfIdle(row: SessionRow): Promise<SessionRow> {
  if (!['in_progress', 'review', 'exporting'].includes(row.status) || Date.now() - row.lastActivityAt.getTime() < IDLE_MS) return row;
  const updated = await db.setupSession.updateMany({
    where: { id: row.id, version: row.version, lastActivityAt: row.lastActivityAt, status: row.status },
    data: { status: 'paused', version: { increment: 1 } },
  });
  if (updated.count) return (await db.setupSession.findUniqueOrThrow({ where: { id: row.id } }));
  return db.setupSession.findUniqueOrThrow({ where: { id: row.id } });
}

async function persist(row: SessionRow, data: SetupData, changes: { status?: string; currentStep?: string; completedAt?: Date | null } = {}): Promise<SessionRow> {
  const updated = await db.setupSession.updateMany({
    where: { id: row.id, companyId: row.companyId, userId: row.userId, version: row.version, status: row.status },
    data: { ...changes, encryptedData: encodeData(data), lastActivityAt: new Date(), version: { increment: 1 } },
  });
  if (!updated.count) throw new SetupError('This setup changed in another tab. Refresh to continue.', 409);
  return db.setupSession.findUniqueOrThrow({ where: { id: row.id } });
}

export async function GET(req: Request) {
  try {
    const actor = await setupActor(req);
    const row = await pauseIfIdle(await getOrCreate(actor));
    return NextResponse.json(toSnapshot(row, decodeData(row.encryptedData)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const actor = await setupActor(req);
    const body = await readJson(req, 24 * 1024);
    const action = typeof body.action === 'string' ? body.action : '';
    const allowed: Record<string, string[]> = {
      save: ['action', 'stepId', 'value', 'version'], skip: ['action', 'stepId', 'version'],
      keep: ['action', 'stepId', 'version'], edit: ['action', 'stepId', 'version'],
      previous: ['action', 'version'], verify: ['action', 'version'], confirm: ['action', 'version'],
      pause: ['action', 'version'], resume: ['action', 'version'], touch: ['action'], reopen: ['action', 'version'],
    };
    if (!Object.hasOwn(allowed, action)) throw new SetupError('Unsupported setup action.');
    requireKeys(body, allowed[action]);
    let row = await pauseIfIdle(await getOrCreate(actor));
    const data = decodeData(row.encryptedData);

    // A heartbeat only extends an active draft; it never resumes an expired one
    // and does not change the edit version, so typing in another tab is safe.
    if (action === 'touch') {
      if (!['in_progress', 'review'].includes(row.status)) throw new SetupError('Setup is paused. Resume to continue.', 409);
      await db.setupSession.updateMany({ where: { id: row.id, version: row.version, status: row.status }, data: { lastActivityAt: new Date() } });
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!Number.isInteger(body.version) || body.version !== row.version) throw new SetupError('This setup changed or paused. Refresh to continue.', 409);

    if (action === 'resume') {
      if (row.status !== 'paused') throw new SetupError('Setup is not paused.', 409);
      row = await persist(row, data, { status: row.currentStep === 'review' ? 'review' : 'in_progress' });
      return NextResponse.json(toSnapshot(row, data));
    }
    if (action === 'reopen') {
      if (row.status !== 'completed') throw new SetupError('Only a completed setup can be reopened.', 409);
      data.checks = []; data.lastCheckedAt = null; data.returnToReview = false; data.handoff = null; data.handoffTarget = null;
      row = await persist(row, data, { status: 'review', currentStep: 'review', completedAt: null });
      return NextResponse.json(toSnapshot(row, data));
    }
    if (action === 'pause') {
      if (!['in_progress', 'review'].includes(row.status)) throw new SetupError('Setup is already paused or completed.', 409);
      row = await persist(row, data, { status: 'paused' });
      return NextResponse.json(toSnapshot(row, data));
    }
    if (row.status === 'paused') throw new SetupError('Setup is paused. Resume to continue.', 409);
    if (row.status === 'exporting') throw new SetupError('Handoff is already in progress. Please refresh shortly.', 409);
    if (row.status === 'completed') throw new SetupError('Setup is complete. Reopen it to make changes.', 409);

    if (action === 'edit') {
      const stepId = typeof body.stepId === 'string' ? body.stepId : '';
      if (!stepsFor(data).some((step) => step.id === stepId) || !data.answers[stepId]) throw new SetupError('Choose a previously answered step.');
      data.returnToReview = row.status === 'review' || data.returnToReview;
      row = await persist(row, data, { status: 'in_progress', currentStep: stepId });
      return NextResponse.json(toSnapshot(row, data));
    }
    if (action === 'previous') {
      if (row.status !== 'in_progress') throw new SetupError('There is no previous question here.');
      const steps = stepsFor(data);
      const index = steps.findIndex((step) => step.id === row.currentStep);
      if (index <= 0) throw new SetupError('You are already at the first question.');
      row = await persist(row, data, { currentStep: steps[index - 1].id });
      return NextResponse.json(toSnapshot(row, data));
    }
    if (action === 'save' || action === 'skip' || action === 'keep') {
      const stepId = typeof body.stepId === 'string' ? body.stepId : '';
      const step = stepsFor(data).find((entry) => entry.id === stepId);
      if (row.status !== 'in_progress' || !step || stepId !== row.currentStep) throw new SetupError('Answer the current question first.', 409);
      if (action === 'keep') {
        if (!data.answers[stepId]) throw new SetupError('There is no saved answer to keep.');
      } else if (action === 'skip') {
        clearChangedDestinations(data, stepId, data.answers[stepId]?.value || null, null);
        data.answers[stepId] = { value: null, status: 'skipped', note: 'Skipped; related functionality may be limited.' };
        invalidateChecks(data, stepId);
      } else {
        const value = validateField(step, body.value);
        const result = await verifyField(step, value, data.answers);
        clearChangedDestinations(data, stepId, data.answers[stepId]?.value || null, value);
        data.answers[stepId] = { value, ...result };
        invalidateChecks(data, stepId);
      }
      const next = firstUnanswered(data);
      const toReview = !next && (data.returnToReview || !firstUnanswered(data));
      data.returnToReview = false;
      row = await persist(row, data, { currentStep: toReview ? 'review' : next!, status: toReview ? 'review' : 'in_progress' });
      return NextResponse.json(toSnapshot(row, data));
    }
    if (action === 'verify') {
      if (row.status !== 'review' || firstUnanswered(data)) throw new SetupError('Finish the questions before running checks.', 409);
      data.checks = await runHealthChecks(data.answers);
      data.lastCheckedAt = new Date().toISOString();
      const checkToAnswer = { facebook: 'pageToken', whatsapp: 'whatsappToken', webhook: 'webhookToken', messenger: 'messengerToken' } as const;
      const checkToIdentity = { facebook: 'pageId', whatsapp: 'phoneId', webhook: 'webhookUrl', messenger: null } as const;
      for (const check of data.checks) {
        const answer = data.answers[checkToAnswer[check.id]];
        if (answer?.value) {
          answer.status = check.status === 'verified' ? 'verified' : 'unverified';
          answer.note = check.detail;
        }
        const identityId = checkToIdentity[check.id];
        const identity = identityId ? data.answers[identityId] : undefined;
        if (identity?.value) {
          identity.status = check.status === 'verified' ? 'verified' : check.status === 'skipped' ? 'format_valid' : 'unverified';
          identity.note = check.detail;
        }
      }
      row = await persist(row, data);
      return NextResponse.json(toSnapshot(row, data));
    }
    if (action === 'confirm') {
      if (row.status !== 'review' || firstUnanswered(data)) throw new SetupError('Finish the questions before confirming.', 409);
      if (!data.lastCheckedAt || Date.now() - Date.parse(data.lastCheckedAt) > 10 * 60_000) throw new SetupError('Run the health checks before confirming.', 409);
      if (data.checks.some((check) => check.status === 'failed' || check.status === 'unavailable')) {
        throw new SetupError('Fix or skip integrations with failed or unavailable checks before confirming.', 409);
      }
      const user = await db.user.findUnique({ where: { id: actor.userId }, select: { email: true } });
      if (!user) throw new SetupError('The account is no longer available.', 401);
      const now = new Date();
      const payload = buildPayload(user.email, data.answers, stepsFor(data), now);
      const verification = overallVerification(data.answers, data.checks);
      const facebookVerified = data.checks.some((check) => check.id === 'facebook' && check.status === 'verified');
      const remote = externalHandoffConfigured();
      let claimed = false;
      if (remote) {
        // Claim this version before the outbound POST so another tab cannot
        // export a different state concurrently. Receiver retries are idempotent.
        const claim = await db.setupSession.updateMany({
          where: { id: row.id, companyId: actor.companyId, userId: actor.userId, version: row.version, status: 'review' },
          data: { status: 'exporting', lastActivityAt: new Date(), version: { increment: 1 } },
        });
        if (!claim.count) throw new SetupError('This setup changed in another tab. Refresh to continue.', 409);
        row = await db.setupSession.findUniqueOrThrow({ where: { id: row.id } });
        claimed = true;
      }
      try {
        if (remote) await sendExternalHandoff(actor.companyId, row.id, data.answers, payload);
        data.handoff = verification;
        data.handoffTarget = remote ? 'remote' : 'local';
        // Local import, state transition, and audit record are atomic. A remote
        // acknowledgement is required first when external handoff is enabled.
        await db.$transaction(async (tx) => {
          const updated = await tx.setupSession.updateMany({
            where: { id: row.id, companyId: actor.companyId, userId: actor.userId, version: row.version, status: remote ? 'exporting' : 'review' },
            data: { status: 'completed', currentStep: 'completed', encryptedData: encodeData(data), completedAt: now, lastActivityAt: now, version: { increment: 1 } },
          });
          if (!updated.count) throw new SetupError('This setup changed in another tab. Refresh to continue.', 409);
          await importSetup(tx, actor.companyId, payload, verification, facebookVerified);
          await tx.auditLog.create({ data: {
            companyId: actor.companyId, userId: actor.userId, action: 'setup.confirmed', resource: 'setup', resourceId: row.id,
            details: `Setup imported into this company workspace (${verification}); handoff: ${remote ? 'remote acknowledged' : 'local'}. No passwords or OTPs were stored.`,
          } });
        });
      } catch (error) {
        // A timeout can mean the remote accepted the request; retry uses the
        // same idempotency key. If the process crashes, idle recovery pauses it.
        if (claimed) await db.setupSession.updateMany({
          where: { id: row.id, version: row.version, status: 'exporting' },
          data: { status: 'review', version: { increment: 1 }, lastActivityAt: new Date() },
        });
        throw error;
      }
      row = await db.setupSession.findUniqueOrThrow({ where: { id: row.id } });
      return NextResponse.json(toSnapshot(row, data));
    }
    throw new SetupError('Unsupported setup action.');
  } catch (error) { return errorResponse(error); }
}

/** Discard only the caller's draft. Confirmed integrations are not silently removed. */
export async function DELETE(req: Request) {
  try {
    const actor = await setupActor(req);
    const existing = await db.setupSession.findUnique({ where: { companyId_userId: { companyId: actor.companyId, userId: actor.userId } } });
    if (existing && (await pauseIfIdle(existing)).status === 'exporting') throw new SetupError('Handoff is in progress. Please wait before deleting the draft.', 409);
    const deleted = await db.setupSession.deleteMany({ where: { companyId: actor.companyId, userId: actor.userId, status: { not: 'exporting' } } });
    if (existing && !deleted.count) throw new SetupError('Handoff is in progress. Please wait before deleting the draft.', 409);
    await db.auditLog.create({ data: { companyId: actor.companyId, userId: actor.userId, action: 'setup.draft_deleted', resource: 'setup', details: 'Setup draft deleted.' } });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
