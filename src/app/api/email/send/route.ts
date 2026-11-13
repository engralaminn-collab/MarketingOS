import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

// Draft storage is available; outbound delivery is deliberately disabled until
// consent, suppression, durable approval and provider receipts are implemented.
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const actor = token ? await verifyToken(token) : null;
  if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (input.adapter !== 'stage') return NextResponse.json({ error: 'Email dispatch is disabled until recipient consent, opt-out suppression and human approval are implemented. Nothing was sent or queued.' }, { status: 503 });
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const html = typeof input.html === 'string' ? input.html.trim() : typeof input.content === 'string' ? input.content.trim() : '';
  if (!subject || subject.length > 180 || !html || html.length > 100_000) return NextResponse.json({ error: 'Subject (1–180 characters) and content (1–100,000 characters) are required.' }, { status: 400 });
  try {
    const record = await db.content.create({ data: {
      title: subject, body: html, type: 'email', platform: 'email', status: 'draft',
      companyId: actor.companyId, creatorId: actor.userId, aiGenerated: input.aiGenerated === true,
    }, select: { id: true, title: true } });
    return NextResponse.json({ data: { id: record.id, adapter: 'stage', status: 'draft', subject: record.title, note: 'Draft saved. No message was sent or queued; recipients are not stored.' } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not save email draft.' }, { status: 500 });
  }
}
