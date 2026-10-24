import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import {
  AiProviderError,
  generateChatCompletion,
  type AiProviderName,
  type ChatMessage,
} from '@/lib/ai-provider';
import { ToolCredentialsError } from '@/lib/tool-credentials';

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4_000;

function getBearerToken(req: NextRequest): string | null {
  return req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    const agentSlug = typeof input.agentSlug === 'string' ? input.agentSlug.trim() : '';
    const provider = typeof input.provider === 'string' && input.provider.trim() ? (input.provider.trim() as AiProviderName) : undefined;
    const model = typeof input.model === 'string' && input.model.trim() ? input.model.trim() : undefined;
    const fallbackChain = Array.isArray(input.fallbackChain)
      ? input.fallbackChain.filter((x): x is AiProviderName => typeof x === 'string')
      : undefined;

    if (!message || message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: `Message is required and must be at most ${MAX_MESSAGE_CHARS} characters` }, { status: 400 });
    }

    const [companyUser, leadCount, campaignCount, contentCount, postCount, emailCount, agent] = await Promise.all([
      db.companyUser.findFirst({ where: { userId: actor.userId, companyId: actor.companyId }, include: { company: true } }),
      db.lead.count({ where: { companyId: actor.companyId } }),
      db.campaign.count({ where: { companyId: actor.companyId } }),
      db.content.count({ where: { companyId: actor.companyId } }),
      db.content.count({ where: { companyId: actor.companyId, type: 'post' } }),
      db.content.count({ where: { companyId: actor.companyId, type: 'email' } }),
      agentSlug
        ? db.aiAgent.findFirst({ where: { companyId: actor.companyId, OR: [{ id: agentSlug }, { type: agentSlug }, { name: { contains: agentSlug } }] } })
        : Promise.resolve(null),
    ]);

    const company = companyUser?.company;
    const agentConfig = (() => {
      try {
        return agent?.config ? JSON.parse(agent.config) : {};
      } catch {
        return {};
      }
    })();
    const systemPrompt = (typeof agentConfig.systemPrompt === 'string' && agentConfig.systemPrompt) ||
      `You are the MarketingOS AI Assistant for "${company?.name || 'this company'}" (${company?.industry || 'general industry'}). Help with marketing strategy, copywriting, campaign planning, SEO, CRM operations, and data interpretation. Do not invent facts, campaign results, or external integrations.`;

    const workspaceContext = `Workspace snapshot: ${leadCount} leads, ${campaignCount} campaigns, ${contentCount} content items, ${postCount} social posts, ${emailCount} email campaigns.`;
    const safeHistory: ChatMessage[] = Array.isArray(input.history)
      ? input.history
          .filter((item): item is { role: 'user' | 'assistant'; content: string } => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return (
              (candidate.role === 'user' || candidate.role === 'assistant') &&
              typeof candidate.content === 'string' &&
              candidate.content.trim().length > 0
            );
          })
          .slice(-MAX_HISTORY_MESSAGES)
          .map((item) => ({ role: item.role, content: item.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
      : [];

    const completion = await generateChatCompletion(
      [
        { role: 'system', content: `${systemPrompt}\n\n${workspaceContext}` },
        ...safeHistory,
        { role: 'user', content: message },
      ],
      { provider, model, fallbackChain },
    );

    await db.aiChatMessage.createMany({
      data: [
        { role: 'user', content: message, userId: actor.userId },
        { role: 'assistant', content: completion.content.slice(0, 10_000), userId: actor.userId },
      ],
    }).catch(() => undefined);

    return NextResponse.json(
      {
        data: {
          reply: completion.content,
          agentName: agent?.name || 'MarketingOS AI',
          agentSlug: agent?.type || 'assistant',
          provider: completion.provider,
          model: completion.model,
          cached: completion.cached || false,
          attempts: completion.attempts,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ToolCredentialsError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof AiProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[POST /api/ai/chat]', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
