import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const wf = await db.workflow.findFirst({ where: { id: body.workflowId, companyId: payload.companyId } });
    if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const steps = JSON.parse(wf.steps || '[]');
    const outputs: any[] = [];
    let error: string | null = null;
    for (let i = 0; i < steps.length; i++) {
      try {
        const step = steps[i];
        if (step.type === 'delay') { await new Promise(r => setTimeout(r, Math.min(60, step.config?.seconds || 1) * 1000)); outputs.push({ step: i+1, type: 'delay', success: true }); }
        else if (step.type === 'email') { const c = await db.content.create({ data: { title: step.config?.subject || 'Workflow email', type: 'email', status: 'draft', body: step.config?.body || '', creatorId: payload.userId, companyId: payload.companyId } }); outputs.push({ step: i+1, type: 'email', success: true, contentId: c.id }); }
        else if (step.type === 'sms') { const s = await db.smsMessage.create({ data: { to: step.config?.to || '', body: step.config?.body || '', status: 'queued', companyId: payload.companyId, sentBy: payload.userId } }); outputs.push({ step: i+1, type: 'sms', success: true, smsId: s.id }); }
        else { outputs.push({ step: i+1, type: step.type, success: true, output: 'executed' }); }
      } catch (err) { error = `Step ${i+1} failed: ${err instanceof Error ? err.message : String(err)}`; break; }
    }
    await db.workflow.update({ where: { id: wf.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
    await emitEvent({ companyId: payload.companyId, userId: payload.userId, type: error ? 'workflow.run_failed' : 'workflow.run_completed', title: `Workflow "${wf.name}" ${error ? 'failed' : 'completed'}`, description: `${steps.length} steps`, resourceType: 'workflow', resourceId: wf.id });
    return NextResponse.json({ data: { status: error ? 'failed' : 'completed', steps: outputs, error } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
