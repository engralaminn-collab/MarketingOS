import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';

/**
 * POST /api/brand/personas/[id]/render
 *
 * Records a render request for a persona. The check order matters:
 *   1. persona exists and belongs to the caller's company
 *   2. consent is on record (owner + proof)
 *   3. the requested use is inside the recorded usage scope
 *   4. a script is supplied and the brand voice is available
 *
 * This route intentionally does not generate video itself: rendering runs on the
 * operator's local media adapter. Here we validate, gate and record the request
 * so an unauthorised likeness can never be produced by accident.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  const persona = await db.brandPersona.findFirst({ where: { id, companyId: actor.companyId } });
  if (!persona) return NextResponse.json({ error: 'Persona not found' }, { status: 404 });

  const usageScope: string[] = JSON.parse(persona.usageScope || '[]');
  const body = await req.json().catch(() => ({}));
  const channel = typeof body?.channel === 'string' ? body.channel : usageScope[0];
  const script = typeof body?.script === 'string' ? body.script.trim() : '';

  const blockers: string[] = [];
  if (!persona.consentGranted || !persona.consentOwner || !persona.consentProof) blockers.push('Consent is not fully recorded for this likeness.');
  if (persona.status !== 'ready') blockers.push(`Persona status is "${persona.status}"; it must be "ready".`);
  if (!channel || !usageScope.includes(channel)) blockers.push(`Channel "${channel ?? 'none'}" is outside the recorded usage scope (${usageScope.join(', ') || 'none'}).`);
  if (script.length < 10) blockers.push('A script of at least 10 characters is required.');
  if (persona.brandVoiceId) {
    const voice = await db.brandVoice.findUnique({ where: { id: persona.brandVoiceId } });
    if (!voice) blockers.push('The linked brand voice no longer exists.');
  }

  if (blockers.length > 0) {
    return NextResponse.json({ error: 'Render blocked', blockers }, { status: 400 });
  }

  const updated = await db.brandPersona.update({
    where: { id },
    data: { renderCount: { increment: 1 }, lastRenderedAt: new Date() },
  });

  const adapterConfigured = Boolean(process.env.VIDEO_GENERATION_URL?.trim() || process.env.TTS_SERVICE_URL?.trim());

  await emitEvent({
    companyId: actor.companyId,
    userId: actor.userId,
    type: 'persona.render_requested',
    title: 'Persona render requested',
    description: `Render requested for ${persona.name} on ${channel}`,
    resourceType: 'brand_persona',
    resourceId: persona.id,
    metadata: { channel, scriptLength: script.length, adapterConfigured },
  });

  return NextResponse.json({
    data: {
      personaId: persona.id,
      channel,
      renderCount: updated.renderCount,
      lastRenderedAt: updated.lastRenderedAt?.toISOString() ?? null,
      adapterConfigured,
      // Honest capability reporting: no hosted fallback, no silent pretend render.
      status: adapterConfigured ? 'queued_for_local_adapter' : 'ready_to_render_when_local_adapter_is_configured',
      message: adapterConfigured
        ? 'Request recorded. The operator-configured local media adapter will pick this up.'
        : 'Request recorded. Set VIDEO_GENERATION_URL (local video adapter) and/or TTS_SERVICE_URL to render it — this workspace does not call a hosted model.',
    },
  });
}
