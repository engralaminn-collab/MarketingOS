import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import { retrieveMemories } from '@/lib/ai-extensions';

async function actorFor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  return actor?.companyId && actor.userId ? actor : null;
}

export async function GET(req: NextRequest) {
  const actor = await actorFor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const params = new URL(req.url).searchParams;
    const memories = await retrieveMemories(actor.companyId!, params.get('agentType') || 'general', params.get('category') || undefined, 20);
    return NextResponse.json({ data: memories, note: 'Legacy memories are unapproved and are not used for agent execution.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Could not fetch memories.' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const actor = await actorFor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ error: 'Agent-managed memory is unavailable until review and approval controls are implemented. Nothing was saved.' }, { status: 503 });
}
