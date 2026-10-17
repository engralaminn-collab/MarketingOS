import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

const CAMPAIGN_TYPES = ['social', 'email', 'sms', 'content', 'multi_channel'] as const;
const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.companyId || !payload.userId) return null;
  return { companyId: payload.companyId, role: payload.role };
}

function parseMetrics(value: string | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // Treat malformed stored metrics as empty rather than exposing guessed values.
  }
  return {};
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await db.campaign.findFirst({ where: { id, companyId: actor.companyId } });
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON request body is required' }, { status: 400 });
    const update: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 160) return NextResponse.json({ error: 'Campaign name must contain 1 to 160 characters' }, { status: 400 });
      update.name = body.name.trim();
    }
    if (body.type !== undefined) {
      if (typeof body.type !== 'string' || !CAMPAIGN_TYPES.includes(body.type.trim() as (typeof CAMPAIGN_TYPES)[number])) return NextResponse.json({ error: 'Campaign type is invalid' }, { status: 400 });
      update.type = body.type.trim();
    }
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !CAMPAIGN_STATUSES.includes(body.status as (typeof CAMPAIGN_STATUSES)[number])) return NextResponse.json({ error: 'Campaign status is invalid' }, { status: 400 });
      update.status = body.status;
    }
    if (body.budget !== undefined) {
      const budget = Number(body.budget);
      if (!Number.isFinite(budget) || budget < 0 || budget > 1_000_000_000) return NextResponse.json({ error: 'Budget must be a valid non-negative amount' }, { status: 400 });
      update.budget = budget;
    }
    for (const field of ['startDate', 'endDate'] as const) {
      if (body[field] !== undefined) {
        if (body[field] === null || body[field] === '') update[field] = null;
        else if (typeof body[field] === 'string') {
          const date = new Date(body[field]);
          if (Number.isNaN(date.getTime())) return NextResponse.json({ error: `${field} is invalid` }, { status: 400 });
          update[field] = date;
        } else return NextResponse.json({ error: `${field} is invalid` }, { status: 400 });
      }
    }
    const nextStart = update.startDate instanceof Date ? update.startDate : existing.startDate;
    const nextEnd = update.endDate instanceof Date ? update.endDate : existing.endDate;
    if (nextStart && nextEnd && nextEnd < nextStart) return NextResponse.json({ error: 'End date must be on or after the start date' }, { status: 400 });

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.length > 5_000) return NextResponse.json({ error: 'Description must be text up to 5,000 characters' }, { status: 400 });
      const metrics = parseMetrics(existing.metrics);
      update.metrics = JSON.stringify({ ...metrics, description: body.description.trim() });
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 });

    const campaign = await db.campaign.update({ where: { id }, data: update });
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('[PATCH /api/campaigns/[id]]', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const result = await db.$transaction(async (tx) => {
      await tx.content.updateMany({ where: { campaignId: id, companyId: actor.companyId }, data: { campaignId: null } });
      return tx.campaign.deleteMany({ where: { id, companyId: actor.companyId } });
    });
    if (result.count === 0) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/campaigns/[id]]', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
