import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { autoScoreLead } from '@/lib/agent-runtime';

// GET /api/crm/leads — list all leads for the current company
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { status, search, source } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (status && status !== 'all') where.status = status;
    if (source && source !== 'all') where.source = source;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { companyName: { contains: search } },
      ];
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        activities: { take: 5, orderBy: { createdAt: 'desc' } },
        tags: true,
      },
    });

    return NextResponse.json({ leads });
  } catch (err) {
    console.error('[GET /api/crm/leads]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/leads — create a new lead
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const data = await req.json();
    // Compute initial score (Frappe-style heuristic)
    const score = computeLeadScore(data);

    const lead = await db.lead.create({
      data: {
        name: String(data.name || '').trim(),
        email: data.email ? String(data.email).trim() : null,
        phone: data.phone ? String(data.phone).trim() : null,
        companyName: data.company || data.companyName ? String(data.company || data.companyName).trim() : null,
        source: data.source ? String(data.source) : 'Website',
        status: data.status ? String(data.status) : 'new',
        score,
        notes: data.notes ? String(data.notes) : null,
        companyId: payload.companyId,
      },
      include: { tags: true },
    });

    // Auto-create a "lead_created" activity (orocrm pattern)
    await db.leadActivity.create({
      data: {
        type: 'created',
        content: 'Lead created',
        leadId: lead.id,
      },
    });

    // Fire events: notification + audit log + activity feed + webhooks
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'lead.created',
      title: 'New lead created',
      description: `Lead "${lead.name}" from ${lead.companyName || 'Unknown'} was created (source: ${lead.source})`,
      resourceType: 'lead',
      resourceId: lead.id,
      link: '/crm',
      metadata: { leadName: lead.name, source: lead.source, score: lead.score },
    });

    // Auto-score the lead via the Lead Qualifier AI agent (async — doesn't block the response)
    autoScoreLead(payload.companyId, lead.id, {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      companyName: lead.companyName,
      source: lead.source,
      score: lead.score,
    }).catch((err) => {
      console.error('[autoScoreLead] failed:', err);
      // Don't fail the lead creation if scoring fails — it's a background task
    });

    return NextResponse.json({ lead });
  } catch (err) {
    console.error('[POST /api/crm/leads]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Compute a 0–100 lead score based on signals from the payload.
 * Inspired by OroCRM/FatFreeCRM lead-scoring heuristics:
 *  - Has email (+15), has phone (+10)
 *  - Source: Referral (+25), LinkedIn (+20), Conference (+15), Website (+10), Cold Email (+5)
 *  - Has company name (+10)
 *  - Random jitter ±5 so equal leads aren't always identical
 */
function computeLeadScore(data: any): number {
  let score = 0;
  if (data.email && String(data.email).includes('@')) score += 15;
  if (data.phone && String(data.phone).length >= 7) score += 10;
  if (data.company || data.companyName) score += 10;
  const sourceScores: Record<string, number> = {
    Referral: 25,
    LinkedIn: 20,
    Conference: 15,
    Website: 10,
    'Cold Email': 5,
  };
  score += sourceScores[data.source] ?? 8;
  // Stable jitter based on email hash so the same lead always gets the same score
  if (data.email) {
    let hash = 0;
    for (const c of String(data.email)) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
    score += Math.abs(hash) % 11 - 5;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
