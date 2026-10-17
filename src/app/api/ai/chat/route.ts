import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { createChatCompletion, type ChatMessage } from '@/lib/ai-provider';
import { ToolCredentialsError } from '@/lib/tool-credentials';

function getBearerToken(req: NextRequest): string | null {
  return req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const rawMessage = (body as Record<string, unknown>).message;
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (!message || message.length > 12_000) return NextResponse.json({ error: 'Message is required and must be at most 12,000 characters' }, { status: 400 });

    await db.aiChatMessage.create({ data: { role: 'user', content: message, userId: actor.userId } });
    const recentMessages = await db.aiChatMessage.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const history: ChatMessage[] = recentMessages.reverse().map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    }));

    const companyUser = await db.companyUser.findFirst({
      where: { userId: actor.userId, companyId: actor.companyId },
      include: { company: true },
    });
    const systemPrompt = `You are the AI Command Center for MarketingOS, a marketing operations workspace. Help with marketing strategy, campaign planning, content drafting, SEO checklists, CRM workflows, and competitor research. Distinguish verified data from estimates and never claim a provider action happened unless the app confirms it.
${companyUser ? `Company: ${companyUser.company.name}. Industry: ${companyUser.company.industry || 'General'}.` : ''}
Be specific, actionable, and professional. Use Markdown where helpful.`;

    const promptMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-19),
    ];
    const completion = await createChatCompletion(actor.companyId, promptMessages);
    await db.aiChatMessage.create({
      data: { role: 'assistant', content: completion.content, userId: actor.userId },
    });

    return NextResponse.json({
      response: completion.content,
      provider: completion.provider,
      model: completion.model,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate a response';
    if (error instanceof ToolCredentialsError) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    const safeProviderError = /OpenRouter|Ollama|AI provider|configured AI provider|Z\.A\.I/i.test(message);
    if (safeProviderError) {
      console.warn('[POST /api/ai/chat] configured provider failed:', message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
    console.error('[POST /api/ai/chat]', error);
    return NextResponse.json({ error: 'Unable to generate a response' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const recent = await db.aiChatMessage.findMany({
      where: { userId: actor.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ messages: recent.reverse() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[GET /api/ai/chat]', error);
    return NextResponse.json({ error: 'Unable to fetch chat history' }, { status: 500 });
  }
}
