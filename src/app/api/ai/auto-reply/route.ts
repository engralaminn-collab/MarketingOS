import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { generateChatCompletion } from '@/lib/ai-provider';

// POST /api/ai/auto-reply — generate AI auto-reply for a message
// Body: { message: string, leadId?: string, contactId?: string, tone?: string }
//
// When a lead/contact sends a message, this endpoint generates an AI response
// that can be sent back automatically. Uses company context for personalization.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const incomingMessage = String(body.message || '').trim();
    if (!incomingMessage) return NextResponse.json({ error: 'message required' }, { status: 400 });

    // Load company context
    const companyUser = await db.companyUser.findFirst({
      where: { userId: payload.userId },
      include: { company: true },
    });
    const company = companyUser?.company;

    // Load lead/contact info if provided
    let leadContext = '';
    if (body.leadId) {
      const lead = await db.lead.findFirst({ where: { id: body.leadId, companyId: payload.companyId } });
      if (lead) {
        leadContext = `Lead info: ${lead.name} from ${lead.companyName || 'Unknown'}, source: ${lead.source || 'Unknown'}, status: ${lead.status}, score: ${lead.score}.`;
      }
    }

    const tone = body.tone || 'professional';

    // Generate AI reply
    let reply = '';
    let generationMode: 'local-model' | 'rule-based-fallback' = 'rule-based-fallback';
    try {
      const completion = await generateChatCompletion([
        {
          role: 'system',
          content: `You are an AI auto-reply assistant for ${company?.name || 'ALO Labs MarketingOS'}.
Industry: ${company?.industry || 'Marketing'}.
Respond with a ${tone} tone. Keep it concise (under 160 characters for SMS).
Be helpful and action-oriented. If the message requires human attention, say "I'll have our team reach out to you shortly."

${leadContext}`,
        },
        { role: 'user', content: incomingMessage },
      ]);
      reply = completion.content;
      generationMode = 'local-model';
    } catch {
      // Fallback replies based on message content
      const lower = incomingMessage.toLowerCase();
      if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
        reply = `Hi! Our pricing depends on your needs. I'll have our team send you a detailed quote. What's the best time to reach you?`;
      } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        reply = `Hello! Thanks for reaching out to ${company?.name || 'ALO Labs'}. How can I help you today?`;
      } else if (lower.includes('help') || lower.includes('support')) {
        reply = `I'd be happy to help! Could you describe your issue? Our team will follow up if needed.`;
      } else if (lower.includes('thanks') || lower.includes('thank you')) {
        reply = `You're welcome! Is there anything else I can help you with?`;
      } else {
        reply = `Thanks for your message! I'll have our team get back to you within 24 hours. For urgent matters, please call us.`;
      }
    }

    // Ensure reply is SMS-length friendly
    if (reply.length > 1600) {
      reply = reply.slice(0, 1597) + '...';
    }

    return NextResponse.json({
      data: {
        reply,
        incomingMessage,
        tone,
        leadContext: leadContext || null,
        autoSend: body.autoSend === true,
        generationMode,
        degraded: generationMode !== 'local-model',
      },
    });
  } catch (err) {
    console.error('[POST /api/ai/auto-reply]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
