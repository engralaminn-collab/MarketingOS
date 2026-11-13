import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const wf = await db.workflow.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true } });
    if (!wf) return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    const runs = await db.workflowRun.findMany({ where: { workflowId: id, companyId: actor.companyId }, orderBy: { startedAt: 'desc' }, take: 50, select: { id: true, status: true, trigger: true, output: true, error: true, startedAt: true, completedAt: true } });
    return NextResponse.json({ data: runs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not fetch workflow runs.' }, { status: 500 });
  }
}
