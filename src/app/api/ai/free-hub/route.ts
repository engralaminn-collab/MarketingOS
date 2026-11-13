import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import {
  FREE_EMBEDDING_PROVIDERS,
  FREE_INFRA_AND_FRAMEWORKS,
  FREE_LLM_PROVIDERS,
  FREE_SPEECH_AND_IMAGE_SERVICES,
  buildRunnableAgentCode,
  type FreeLlmProviderId,
} from '@/lib/free-ai-stack';
import {
  fetchOpenRouterFreeModels,
  generateChatCompletion,
  getAiProviderStatus,
} from '@/lib/ai-provider';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const [activeStatus, openRouterFree] = await Promise.all([
      getAiProviderStatus(),
      fetchOpenRouterFreeModels(),
    ]);

    return NextResponse.json(
      {
        data: {
          activeStatus: { provider: activeStatus.provider, model: activeStatus.model, status: activeStatus.status, reachable: activeStatus.reachable, detail: activeStatus.detail },
          providers: FREE_LLM_PROVIDERS.filter((provider) => ['ollama', 'openai-compatible', 'openrouter'].includes(provider.id)).map((provider) => ({ ...provider, badge: undefined, limits: 'Availability, quotas, pricing and local resource cost not verified.' })),
          // Process-global telemetry is not tenant-scoped and estimated quota
          // meters are not authoritative provider limits.
          telemetry: [],
          telemetryNote: 'Unavailable: provider quotas and usage are not verified per workspace.',
          openRouterFree,
          embeddings: FREE_EMBEDDING_PROVIDERS,
          multimodal: FREE_SPEECH_AND_IMAGE_SERVICES,
          infraAndFrameworks: FREE_INFRA_AND_FRAMEWORKS,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[GET /api/ai/free-hub]', error);
    return NextResponse.json({ error: 'Failed to load Free AI Hub' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'export-code');

    if (action === 'test-provider') {
      if (!actor.userId || !hasPermission(actor.role, 'ai_agent_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const provider = String(body?.provider || 'ollama') as FreeLlmProviderId;
      const model = typeof body?.model === 'string' && body.model.trim() ? body.model.trim() : undefined;
      const fallbackChain = Array.isArray(body?.fallbackChain) ? body.fallbackChain : undefined;
      const started = Date.now();
      try {
        const res = await generateChatCompletion(
          [{ role: 'user', content: 'Reply in one short sentence confirming this free AI endpoint is online.' }],
          { provider, model, fallbackChain, maxTokens: 80, temperature: 0.1 },
        );
        return NextResponse.json({
          data: {
            ok: true,
            provider: res.provider,
            model: res.model,
            reply: res.content,
            latencyMs: Date.now() - started,
            attempts: res.attempts || [],
          },
        });
      } catch (err) {
        return NextResponse.json({
          data: {
            ok: false,
            provider,
            latencyMs: Date.now() - started,
            error: err instanceof Error ? err.message : 'Provider unreachable',
          },
        });
      }
    }

    const provider = (body?.provider || 'openrouter') as FreeLlmProviderId;
    const model = String(body?.model || 'qwen/qwen3-32b:free');
    const mcpServers = Array.isArray(body?.mcpServers) ? body.mcpServers.map(String) : undefined;
    if (!['ollama', 'openrouter'].includes(provider) || !/^[A-Za-z0-9._:/-]{1,160}$/.test(model) || (provider === 'openrouter' && model !== 'openrouter/free' && !model.endsWith(':free'))) {
      return NextResponse.json({ error: 'Export supports Ollama or an explicitly free OpenRouter model only.' }, { status: 400 });
    }
    const code = buildRunnableAgentCode({ provider, model, mcpServers });
    return NextResponse.json({ data: code });
  } catch (error) {
    console.error('[POST /api/ai/free-hub]', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
