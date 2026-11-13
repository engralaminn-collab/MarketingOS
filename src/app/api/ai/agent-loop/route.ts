import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import { AGENT_TOOL_DEFINITIONS, runMultiStepFreeAgent } from '@/lib/agent-tools';
import type { AiProviderName } from '@/lib/ai-provider';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await verifyToken(token);
  if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  return NextResponse.json({
    data: {
      tools: AGENT_TOOL_DEFINITIONS.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const goal = typeof body?.goal === 'string' ? body.goal.trim() : '';
    if (!goal || goal.length > 4_000) {
      return NextResponse.json({ error: 'Agent goal is required (1–4,000 chars)' }, { status: 400 });
    }

    const provider = typeof body?.provider === 'string' && body.provider ? (body.provider as AiProviderName) : undefined;
    const model = typeof body?.model === 'string' && body.model ? body.model : undefined;
    const fallbackChain = Array.isArray(body?.fallbackChain)
      ? body.fallbackChain.filter((x: unknown): x is AiProviderName => typeof x === 'string')
      : undefined;
    const maxSteps = typeof body?.maxSteps === 'number' ? body.maxSteps : 5;

    const result = await runMultiStepFreeAgent({
      goal,
      provider,
      model,
      fallbackChain,
      maxSteps,
      companyId: actor.companyId,
      userId: actor.userId,
    });

    return NextResponse.json({ data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[POST /api/ai/agent-loop]', error);
    return NextResponse.json({ error: 'Agent execution failed' }, { status: 500 });
  }
}
