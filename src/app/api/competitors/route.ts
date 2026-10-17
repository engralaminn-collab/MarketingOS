import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

function optionalText(value: unknown, field: string, maxLength: number): { value: string | null; error?: string } {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string') return { value: null, error: `${field} must be text` };
  const cleaned = value.trim();
  if (cleaned.length > maxLength) return { value: null, error: `${field} must be at most ${maxLength} characters` };
  return { value: cleaned || null };
}

function optionalHttpUrl(value: unknown): { value: string | null; error?: string } {
  const input = optionalText(value, 'website', 2048);
  if (input.error || !input.value) return input;
  try {
    const url = new URL(input.value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      return { value: null, error: 'Website must be a public HTTP or HTTPS URL' };
    }
    return { value: url.toString() };
  } catch {
    return { value: null, error: 'Website must be a valid HTTP or HTTPS URL' };
  }
}

function optionalStringList(value: unknown, field: string): { value: string[]; error?: string } {
  if (value === undefined || value === null) return { value: [] };
  if (!Array.isArray(value) || value.length > 20) return { value: [], error: `${field} must be a list of up to 20 items` };
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length > 160) return { value: [], error: `Each ${field} item must be text of at most 160 characters` };
    const cleaned = item.trim();
    if (cleaned) items.push(cleaned);
  }
  return { value: items };
}

// GET /api/competitors — list competitors for the authenticated company.
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const competitors = await db.competitor.findMany({
      where: { companyId: actor.companyId },
      orderBy: [{ threatLevel: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      data: competitors.map((competitor) => ({
        id: competitor.id,
        name: competitor.name,
        website: optionalHttpUrl(competitor.website).value,
        description: competitor.description,
        strengths: (() => { try { return JSON.parse(competitor.strengths || '[]'); } catch { return []; } })(),
        weaknesses: (() => { try { return JSON.parse(competitor.weaknesses || '[]'); } catch { return []; } })(),
        pricing: competitor.pricing,
        marketShare: competitor.marketShare,
        threatLevel: competitor.threatLevel,
        createdAt: competitor.createdAt.toISOString(),
        updatedAt: competitor.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[GET /api/competitors]', error);
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 });
  }
}

// POST /api/competitors — add a manually researched competitor profile.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 160) return NextResponse.json({ error: 'Name is required and must be at most 160 characters' }, { status: 400 });

    const website = optionalHttpUrl(input.website);
    const description = optionalText(input.description, 'Description', 1_000);
    const pricing = optionalText(input.pricing, 'Pricing', 160);
    const marketShare = optionalText(input.marketShare, 'Market share', 120);
    const strengths = optionalStringList(input.strengths, 'strengths');
    const weaknesses = optionalStringList(input.weaknesses, 'weaknesses');
    const errors = [website.error, description.error, pricing.error, marketShare.error, strengths.error, weaknesses.error].filter(Boolean);
    if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 });
    const threatLevel = input.threatLevel ?? 'medium';
    if (!['low', 'medium', 'high'].includes(String(threatLevel))) return NextResponse.json({ error: 'Threat level must be low, medium, or high' }, { status: 400 });

    const competitor = await db.competitor.create({
      data: {
        name,
        website: website.value,
        description: description.value,
        strengths: JSON.stringify(strengths.value),
        weaknesses: JSON.stringify(weaknesses.value),
        pricing: pricing.value,
        marketShare: marketShare.value,
        threatLevel: String(threatLevel),
        companyId: actor.companyId,
      },
    });

    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'competitor.added',
      title: 'Competitor added',
      description: `Competitor "${competitor.name}" added (manual threat rating: ${threatLevel})`,
      resourceType: 'competitor',
      resourceId: competitor.id,
      link: '/market-intelligence',
      metadata: { name, threatLevel },
    });

    return NextResponse.json({
      data: { id: competitor.id, name: competitor.name, website: competitor.website, threatLevel: competitor.threatLevel },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/competitors]', error);
    return NextResponse.json({ error: 'Failed to add competitor' }, { status: 500 });
  }
}
