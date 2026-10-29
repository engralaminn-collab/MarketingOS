import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { readWorkflowSteps, validateExecutableSteps } from '@/lib/workflows';

async function authorizedActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  return token ? verifyToken(token) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorizedActor(req);
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const update: { name?: string; steps?: string; isActive?: boolean } = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 160) return NextResponse.json({ error: 'Name must be 1–160 characters.' }, { status: 400 });
    update.name = input.name.trim();
  }
  if (input.steps !== undefined) {
    const parsed = readWorkflowSteps(input.steps);
    const error = parsed.error || validateExecutableSteps(parsed.steps);
    if (error) return NextResponse.json({ error }, { status: 422 });
    update.steps = JSON.stringify(parsed.steps);
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') return NextResponse.json({ error: 'isActive must be boolean.' }, { status: 400 });
    update.isActive = input.isActive;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No supported fields to update.' }, { status: 400 });
  try {
    const { id } = await params;
    const result = await db.workflow.updateMany({ where: { id, companyId: actor.companyId }, data: update });
    if (!result.count) return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    return NextResponse.json({ data: await db.workflow.findFirst({ where: { id, companyId: actor.companyId } }) });
  } catch {
    return NextResponse.json({ error: 'Could not update workflow.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorizedActor(req);
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const existing = await db.workflow.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true, _count: { select: { runs: true } } } });
    if (!existing) return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    // Keep execution history and idempotency receipts. Pause instead.
    if (existing._count.runs) return NextResponse.json({ error: 'Workflows with run history cannot be deleted. Pause the workflow instead.' }, { status: 409 });
    const result = await db.workflow.deleteMany({ where: { id, companyId: actor.companyId, runs: { none: {} } } });
    if (!result.count) return NextResponse.json({ error: 'Workflow now has run history. Pause it instead.' }, { status: 409 });
    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json({ error: 'Could not delete workflow.' }, { status: 500 });
  }
}
