import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { runAgent, type AgentRunInput } from '@/lib/agent-runtime';

// POST /api/ai/agents/[id]/run — manually trigger an agent to do real work
// Body: { task: string, resourceType?: 'lead'|'deal'|'content'|..., resourceId?: string, context?: {...} }
//
// Returns: { success, output, durationMs, taskExecutionId }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id: agentId } = await params;
    const body = await req.json();
    const task = typeof body.task === 'string' ? body.task.trim() : '';
    if (!task || task.length > 4_000 || JSON.stringify(body).length > 16_384) {
      return NextResponse.json({ error: 'task is required' }, { status: 400 });
    }

    const input: AgentRunInput = {
      task,
      resourceType: body.resourceType || 'general',
      resourceId: body.resourceId,
      context: body.context,
    };

    const result = await runAgent(agentId, payload.companyId, payload.userId, input);

    return NextResponse.json({
      data: {
        success: result.success,
        agentName: result.agentName,
        agentType: result.agentType,
        task: result.task,
        output: result.output,
        durationMs: result.durationMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        taskExecutionId: result.taskExecutionId,
        error: result.error,
      },
    });
  } catch (err) {
    console.error('[POST /api/ai/agents/[id]/run]', err);
    return NextResponse.json(
      { error: 'Failed to run agent' },
      { status: 500 },
    );
  }
}
