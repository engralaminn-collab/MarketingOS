import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';

// There is no durable render queue or worker. Validate the requested persona,
// then fail closed without incrementing render counts or claiming a job exists.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  const persona = await db.brandPersona.findFirst({ where: { id, companyId: actor.companyId } });
  if (!persona) return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
  let usageScope: unknown = [];
  try { usageScope = JSON.parse(persona.usageScope || '[]'); } catch { /* fail closed below */ }
  const allowed = Array.isArray(usageScope) ? usageScope.filter((item): item is string => typeof item === 'string') : [];
  const channel = typeof body.channel === 'string' ? body.channel : allowed[0];
  const script = typeof body.script === 'string' ? body.script.trim() : '';
  if (!persona.consentGranted || !persona.consentOwner || !persona.consentProof || persona.status !== 'ready' || !channel || !allowed.includes(channel) || script.length < 10 || script.length > 4_000) {
    return NextResponse.json({ error: 'Render blocked: consent, ready status, authorized channel and a valid script are required.' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Persona rendering is unavailable: no durable render queue and worker are implemented. Nothing was rendered or queued.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
