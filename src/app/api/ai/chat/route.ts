import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { message, conversationId } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    // Save user message
    await db.aiChatMessage.create({
      data: { role: 'user', content: message, userId: payload.userId },
    });

    // Get recent conversation history
    const recentMessages = await db.aiChatMessage.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const history = recentMessages.reverse().map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Get company context for personalized responses
    const companyUser = await db.companyUser.findFirst({
      where: { userId: payload.userId },
      include: { company: true },
    });

    const systemPrompt = `You are the AI Command Center for MarketingOS, a comprehensive AI-powered marketing operating system. You help users with:
- Creating marketing plans and strategies
- Generating social media content, blogs, emails, and SMS campaigns
- SEO optimization and challenges
- Lead generation and CRM management
- Campaign planning and execution
- Content scheduling and publishing
- Analytics and performance insights
- Competitor analysis
- Brand strategy

${companyUser ? `The user's company: ${companyUser.company.name}, Industry: ${companyUser.company.industry || 'General'}` : ''}

Be specific, actionable, and provide concrete steps. Use markdown formatting when helpful. Be enthusiastic and professional.`;

    const zai = await ZAI.create();
    const messages = [{ role: 'assistant' as const, content: systemPrompt }, ...history];

    // Trim if too long
    const maxMessages = 24;
    const trimmedMessages = messages.length > maxMessages
      ? [messages[0], ...messages.slice(-(maxMessages - 1))]
      : messages;

    const completion = await zai.chat.completions.create({
      messages: trimmedMessages,
      thinking: { type: 'disabled' },
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Save AI response
    await db.aiChatMessage.create({
      data: { role: 'assistant', content: aiResponse, userId: payload.userId },
    });

    return NextResponse.json({ response: aiResponse });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const messages = await db.aiChatMessage.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
