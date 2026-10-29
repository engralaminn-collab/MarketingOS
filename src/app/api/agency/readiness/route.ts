import { hasPermission } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { buildReadiness, getActor } from '@/lib/agency';

/** GET /api/agency/readiness — live audit of the agency specification. */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const report = await buildReadiness(actor.companyId);
    return NextResponse.json({ data: report });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to build readiness report' }, { status: 500 });
  }
}
