import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const workflows = await db.workflow.findMany({ where: { companyId: payload.companyId }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ data: workflows.map(w => ({ id: w.id, name: w.name, description: w.description, trigger: w.trigger, steps: JSON.parse(w.steps || '[]'), isActive: w.isActive, runCount: w.runCount, createdAt: w.createdAt.toISOString() })) });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const wf = await db.workflow.create({ data: { name, description: body.description || null, trigger: body.trigger || 'manual', triggerConfig: JSON.stringify(body.triggerConfig || {}), steps: JSON.stringify(body.steps || []), isActive: body.isActive || false, companyId: payload.companyId, createdBy: payload.userId } });
    await emitEvent({ companyId: payload.companyId, userId: payload.userId, type: 'workflow.created', title: 'Workflow created', description: name, resourceType: 'workflow', resourceId: wf.id });
    return NextResponse.json({ data: { id: wf.id, name: wf.name } }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
