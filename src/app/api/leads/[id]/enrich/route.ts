import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { enrichByEmail, enrichByDomain } from '@/lib/enrichment';
import { emitEvent } from '@/lib/events';

// POST /api/leads/[id]/enrich — enrich a single lead by its email domain
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const lead = await db.lead.findFirst({ where: { id, companyId: payload.companyId } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    // Determine the domain to enrich from
    let domain: string | null = null;
    if (lead.email && lead.email.includes('@')) {
      domain = lead.email.split('@')[1];
    } else if (lead.companyName) {
      // Heuristic: convert company name to domain
      domain = lead.companyName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '') + '.com';
    }
    if (!domain) {
      return NextResponse.json({ error: 'Cannot determine domain — lead has no email or company name' }, { status: 400 });
    }

    const enrichment = await enrichByDomain(domain);

    // Apply enrichment to the lead (only fill empty fields — don't overwrite existing data)
    const update: any = {};
    if (!lead.companyName && enrichment.companyName) update.companyName = enrichment.companyName;
    if (!lead.email && enrichment.website) {
      // Can't infer an email, but at least we have the website
    }
    // Append enrichment info to notes if there's anything interesting
    const enrichmentNotes: string[] = [];
    if (enrichment.industry) enrichmentNotes.push(`Industry: ${enrichment.industry}`);
    if (enrichment.description) enrichmentNotes.push(`About: ${enrichment.description}`);
    if (enrichment.employees) enrichmentNotes.push(`Employees: ${enrichment.employees}`);
    if (enrichment.foundedYear) enrichmentNotes.push(`Founded: ${enrichment.foundedYear}`);
    if (enrichment.linkedinUrl) enrichmentNotes.push(`LinkedIn: ${enrichment.linkedinUrl}`);
    if (enrichment.logo) enrichmentNotes.push(`Logo: ${enrichment.logo}`);

    if (enrichmentNotes.length > 0) {
      const existingNotes = lead.notes || '';
      const enrichmentBlock = `\n\n[Enrichment ${new Date().toISOString().slice(0, 10)}]\n${enrichmentNotes.join('\n')}`;
      update.notes = existingNotes + enrichmentBlock;
    }

    // Boost the lead score based on enrichment success
    if (enrichment.source === 'fetched' && enrichment.companyName) {
      update.score = Math.min(100, lead.score + 10);
    }

    if (Object.keys(update).length > 0) {
      const updated = await db.lead.update({ where: { id }, data: update });
      await db.leadActivity.create({
        data: {
          type: 'enriched',
          content: `Enriched via ${enrichment.source} — industry: ${enrichment.industry || 'unknown'}`,
          leadId: id,
        },
      });
      await emitEvent({
        companyId: payload.companyId,
        userId: payload.userId,
        type: 'lead.enriched',
        title: 'Lead enriched',
        description: `Lead "${updated.name}" enriched — industry: ${enrichment.industry || 'unknown'}`,
        resourceType: 'lead',
        resourceId: id,
        link: '/crm',
        metadata: { domain, industry: enrichment.industry, source: enrichment.source },
      });
    }

    return NextResponse.json({
      data: {
        lead: { id, ...update },
        enrichment,
      },
    });
  } catch (err) {
    console.error('[POST /api/leads/[id]/enrich]', err);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}
