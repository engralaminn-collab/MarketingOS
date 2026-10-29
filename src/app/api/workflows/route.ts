import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { parseStoredWorkflowSteps, readWorkflowSteps, validateExecutableSteps } from '@/lib/workflows';

async function actorFor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  return actor?.companyId && actor.userId ? actor : null;
}

export async function GET(req: NextRequest) {
  const actor = await actorFor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const workflows = await db.workflow.findMany({ where: { companyId: actor.companyId! }, orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json({ data: workflows.map((wf) => {
      const parsed = parseStoredWorkflowSteps(wf.steps);
      return { id: wf.id, name: wf.name, description: wf.description, trigger: wf.trigger, steps: parsed.steps, validationError: parsed.error || validateExecutableSteps(parsed.steps), isActive: wf.isActive, runCount: wf.runCount, lastRunAt: wf.lastRunAt, createdAt: wf.createdAt };
    }), capabilities: { manualOnly: true, supportedSteps: ['log_activity', 'create_notification', 'email'], emailIsDraftOnly: true } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not fetch workflows.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await actorFor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 160) return NextResponse.json({ error: 'Name must be 1–160 characters.' }, { status: 400 });
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 2_000)) return NextResponse.json({ error: 'Description must be at most 2,000 characters.' }, { status: 400 });
  if (input.trigger !== undefined && input.trigger !== 'manual') return NextResponse.json({ error: 'Only manual triggers are implemented; event and scheduled triggers are unavailable.' }, { status: 422 });
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') return NextResponse.json({ error: 'isActive must be boolean.' }, { status: 400 });
  const parsed = readWorkflowSteps(input.steps);
  const error = parsed.error || validateExecutableSteps(parsed.steps);
  if (error) return NextResponse.json({ error }, { status: 422 });
  try {
    const wf = await db.workflow.create({ data: { name, description: typeof input.description === 'string' ? input.description : null, trigger: 'manual', steps: JSON.stringify(parsed.steps), isActive: input.isActive === true, companyId: actor.companyId!, createdBy: actor.userId } });
    return NextResponse.json({ data: { id: wf.id, name: wf.name } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Could not create workflow.' }, { status: 500 });
  }
}
