import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';

/**
 * POST /api/media/lipsync
 *
 * Submits a photoreal lip-sync job to the operator's own adapter. The contract is
 * intentionally tiny so any local SadTalker / Wav2Lip / LiveTalk wrapper fits:
 *
 *   POST  {LIPSYNC_ADAPTER_URL}/generate
 *     body: { image: dataUrl, audio: dataUrl | null, script, fps, width, height, personaId? }
 *     200 : { taskId: string }
 *   GET   {LIPSYNC_ADAPTER_URL}/status/:taskId
 *     200 : { status: 'queued'|'running'|'completed'|'failed', videoUrl?, error? }
 *
 * Nothing is fabricated: if the adapter is unset the route returns 503 with the
 * exact configuration needed, and the UI falls back to the local/browser tiers.
 */
const TIMEOUT_MS = Number(process.env.LIPSYNC_TIMEOUT_MS || 180_000);

function adapterBase(): string | null {
  const raw = process.env.LIPSYNC_ADAPTER_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export async function GET() {
  const base = adapterBase();
  return NextResponse.json({
    data: {
      configured: Boolean(base),
      adapter: base ?? null,
      contract: {
        submit: 'POST {LIPSYNC_ADAPTER_URL}/generate -> { taskId }',
        status: 'GET {LIPSYNC_ADAPTER_URL}/status/:taskId -> { status, videoUrl?, error? }',
      },
      hint: base ? 'Adapter configured.' : 'Set LIPSYNC_ADAPTER_URL to a local lip-sync service to enable photoreal rendering.',
    },
  });
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const base = adapterBase();
  if (!base) {
    return NextResponse.json(
      {
        error: 'No lip-sync adapter is configured.',
        hint: 'Set LIPSYNC_ADAPTER_URL (local SadTalker / Wav2Lip / LiveTalk wrapper) to enable photoreal rendering. Until then use the in-browser animated talking head.',
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const image = typeof body?.image === 'string' ? body.image : '';
  const audio = typeof body?.audio === 'string' ? body.audio : null;
  const script = typeof body?.script === 'string' ? body.script.slice(0, 4000) : '';
  if (!image.startsWith('data:image/')) return NextResponse.json({ error: 'A base64 image data URL is required' }, { status: 400 });
  if (!audio && !script) return NextResponse.json({ error: 'Provide audio or a script' }, { status: 400 });

  // Consent gate: a persona id, when supplied, must be consented and in scope.
  const personaId = typeof body?.personaId === 'string' ? body.personaId : null;
  if (personaId) {
    const persona = await db.brandPersona.findFirst({ where: { id: personaId, companyId: actor.companyId } });
    if (!persona) return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    if (!persona.consentGranted || !persona.consentOwner || !persona.consentProof) {
      return NextResponse.json({ error: 'Persona consent is not on file; rendering is blocked.' }, { status: 400 });
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        audio,
        script,
        fps: Number(body?.fps) || 25,
        width: Number(body?.width) || 720,
        height: Number(body?.height) || 720,
        personaId,
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as { taskId?: string; error?: string };
    if (!response.ok || !payload.taskId) {
      return NextResponse.json(
        { error: payload.error || `Lip-sync adapter rejected the job (HTTP ${response.status})` },
        { status: 502 }
      );
    }

    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'media.lipsync_submitted',
      title: 'Lip-sync job submitted',
      description: `Photoreal lip-sync job ${payload.taskId} submitted to the local adapter`,
      resourceType: 'media',
      resourceId: payload.taskId,
      metadata: { personaId, hasAudio: Boolean(audio), scriptChars: script.length },
    });

    return NextResponse.json({ data: { taskId: payload.taskId, adapter: base } }, { status: 202 });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? 'The local lip-sync adapter timed out.' : 'The local lip-sync adapter could not be reached.' },
      { status: 504 }
    );
  } finally {
    clearTimeout(timer);
  }
}
