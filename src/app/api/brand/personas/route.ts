import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';

const parse = (value: string) => {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
};

/** GET /api/brand/personas — face agents built from client-owned photos. */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [personas, config, voices] = await Promise.all([
    db.brandPersona.findMany({ where: { companyId: actor.companyId }, orderBy: { createdAt: 'asc' } }),
    db.clientConfig.findUnique({ where: { companyId: actor.companyId } }),
    db.brandVoice.findMany({ where: { companyId: actor.companyId }, select: { id: true, name: true, isDefault: true } }),
  ]);

  return NextResponse.json({
    data: personas.map((persona) => ({
      ...persona,
      assets: parse(persona.assets),
      usageScope: parse(persona.usageScope),
      voiceName: voices.find((voice) => voice.id === persona.brandVoiceId)?.name ?? null,
    })),
    meta: {
      limit: config?.personaLimit ?? 3,
      used: personas.length,
      defaultVoiceId: voices.find((voice) => voice.isDefault)?.id ?? null,
    },
  });
}

/**
 * POST /api/brand/personas — register a persona.
 *
 * Consent is enforced server-side: a persona cannot be activated without a
 * recorded consent owner and proof reference. Photos must be client-supplied.
 */
export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'A persona name is required' }, { status: 400 });
  }

  const [config, existing] = await Promise.all([
    db.clientConfig.findUnique({ where: { companyId: actor.companyId } }),
    db.brandPersona.count({ where: { companyId: actor.companyId } }),
  ]);
  const limit = config?.personaLimit ?? 3;
  if (!body.id && existing >= limit) {
    return NextResponse.json({ error: `This workspace allows ${limit} personas. Raise the limit in the client configuration first.` }, { status: 409 });
  }

  const consentGranted = Boolean(body.consentGranted);
  const consentOwner = typeof body.consentOwner === 'string' ? body.consentOwner.trim().slice(0, 160) : '';
  const consentProof = typeof body.consentProof === 'string' ? body.consentProof.trim().slice(0, 300) : '';
  const requestedStatus = typeof body.status === 'string' ? body.status : 'draft';
  if (requestedStatus === 'ready' && (!consentGranted || !consentOwner || !consentProof)) {
    return NextResponse.json(
      { error: 'A persona cannot be activated without consentGranted, consentOwner and consentProof on record.' },
      { status: 400 }
    );
  }

  const data = {
    name: body.name.trim().slice(0, 120),
    role: typeof body.role === 'string' ? body.role.slice(0, 60) : 'presenter',
    description: typeof body.description === 'string' ? body.description.slice(0, 500) : '',
    voiceId: typeof body.voiceId === 'string' ? body.voiceId.slice(0, 80) : null,
    brandVoiceId: typeof body.brandVoiceId === 'string' ? body.brandVoiceId : config?.brandVoiceId ?? null,
    assets: JSON.stringify(Array.isArray(body.assets) ? body.assets.slice(0, 12) : []),
    consentOwner,
    consentGranted,
    consentProof,
    usageScope: JSON.stringify(Array.isArray(body.usageScope) ? body.usageScope.filter((v: unknown) => typeof v === 'string').slice(0, 12) : []),
    status: consentGranted && consentOwner && consentProof ? requestedStatus : 'draft',
  };

  const persona = body.id
    ? await db.brandPersona.updateMany({ where: { id: String(body.id), companyId: actor.companyId }, data }).then(async () => {
        const updated = await db.brandPersona.findFirst({ where: { id: String(body.id), companyId: actor.companyId } });
        if (!updated) throw new Error('Persona not found');
        return updated;
      })
    : await db.brandPersona.create({ data: { ...data, companyId: actor.companyId } });

  return NextResponse.json(
    {
      data: { ...persona, assets: parse(persona.assets), usageScope: parse(persona.usageScope) },
      meta: { limit, used: body.id ? existing : existing + 1 },
    },
    { status: body.id ? 200 : 201 }
  );
}
