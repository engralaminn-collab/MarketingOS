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
  const input = optionalText(value, 'Website', 2048);
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
  if (!Array.isArray(value) || value.length > 20) return { value: [], error: `${field} must be a list of up to 20 items` };
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length > 160) return { value: [], error: `Each ${field} item must be text of at most 160 characters` };
    const cleaned = item.trim();
    if (cleaned) items.push(cleaned);
  }
  return { value: items };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.competitor.findFirst({ where: { id, companyId: actor.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const update: Record<string, string | null> = {};

    if (input.name !== undefined) {
      const name = optionalText(input.name, 'Name', 160);
      if (name.error || !name.value) return NextResponse.json({ error: name.error || 'Name cannot be empty' }, { status: 400 });
      update.name = name.value;
    }
    if (input.website !== undefined) {
      const website = optionalHttpUrl(input.website);
      if (website.error) return NextResponse.json({ error: website.error }, { status: 400 });
      update.website = website.value;
    }
    if (input.description !== undefined) {
      const description = optionalText(input.description, 'Description', 1_000);
      if (description.error) return NextResponse.json({ error: description.error }, { status: 400 });
      update.description = description.value;
    }
    if (input.pricing !== undefined) {
      const pricing = optionalText(input.pricing, 'Pricing', 160);
      if (pricing.error) return NextResponse.json({ error: pricing.error }, { status: 400 });
      update.pricing = pricing.value;
    }
    if (input.marketShare !== undefined) {
      const marketShare = optionalText(input.marketShare, 'Market share', 120);
      if (marketShare.error) return NextResponse.json({ error: marketShare.error }, { status: 400 });
      update.marketShare = marketShare.value;
    }
    if (input.strengths !== undefined) {
      const strengths = optionalStringList(input.strengths, 'strengths');
      if (strengths.error) return NextResponse.json({ error: strengths.error }, { status: 400 });
      update.strengths = JSON.stringify(strengths.value);
    }
    if (input.weaknesses !== undefined) {
      const weaknesses = optionalStringList(input.weaknesses, 'weaknesses');
      if (weaknesses.error) return NextResponse.json({ error: weaknesses.error }, { status: 400 });
      update.weaknesses = JSON.stringify(weaknesses.value);
    }
    if (input.threatLevel !== undefined) {
      if (!['low', 'medium', 'high'].includes(String(input.threatLevel))) return NextResponse.json({ error: 'Threat level must be low, medium, or high' }, { status: 400 });
      update.threatLevel = String(input.threatLevel);
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No writable fields supplied' }, { status: 400 });

    const competitor = await db.competitor.update({ where: { id }, data: update });
    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'competitor.updated',
      title: 'Competitor updated',
      description: `Competitor "${competitor.name}" was updated`,
      resourceType: 'competitor',
      resourceId: id,
      link: '/market-intelligence',
    });

    return NextResponse.json({ data: competitor });
  } catch (error) {
    console.error('[PATCH /api/competitors/[id]]', error);
    return NextResponse.json({ error: 'Failed to update competitor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.competitor.findFirst({ where: { id, companyId: actor.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.competitor.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[DELETE /api/competitors/[id]]', error);
    return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 });
  }
}
