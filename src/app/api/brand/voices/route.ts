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

/** GET /api/brand/voices — every brand voice available to the caller's company. */
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const voices = await db.brandVoice.findMany({ where: { companyId: actor.companyId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  return NextResponse.json({
    data: voices.map((voice) => ({
      ...voice,
      doList: parse(voice.doList),
      dontList: parse(voice.dontList),
      lexicon: parse(voice.lexicon),
      bannedPhrases: parse(voice.bannedPhrases),
    })),
  });
}

/** POST /api/brand/voices — create or update the client's voice profile. */
export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'A voice name is required' }, { status: 400 });
  }
  const list = (value: unknown) => JSON.stringify(Array.isArray(value) ? value.filter((v) => typeof v === 'string').slice(0, 40) : []);

  if (body.isDefault) {
    await db.brandVoice.updateMany({ where: { companyId: actor.companyId }, data: { isDefault: false } });
  }

  const data = {
    name: body.name.trim().slice(0, 120),
    tone: typeof body.tone === 'string' ? body.tone.slice(0, 80) : 'professional',
    personaLine: typeof body.personaLine === 'string' ? body.personaLine.slice(0, 300) : '',
    readingLevel: typeof body.readingLevel === 'string' ? body.readingLevel.slice(0, 40) : 'general',
    doList: list(body.doList),
    dontList: list(body.dontList),
    lexicon: list(body.lexicon),
    bannedPhrases: list(body.bannedPhrases),
    ctaStyle: typeof body.ctaStyle === 'string' ? body.ctaStyle.slice(0, 40) : 'direct',
    sampleCopy: typeof body.sampleCopy === 'string' ? body.sampleCopy.slice(0, 2000) : '',
  };

  const voice = body.id
    ? await db.brandVoice.updateMany({ where: { id: String(body.id), companyId: actor.companyId }, data }).then(async () => {
        const updated = await db.brandVoice.findFirst({ where: { id: String(body.id), companyId: actor.companyId } });
        if (!updated) throw new Error('Voice not found');
        return updated;
      })
    : await db.brandVoice.create({ data: { ...data, companyId: actor.companyId, isDefault: Boolean(body.isDefault) } });

  if (voice.isDefault) {
    await db.clientConfig.upsert({
      where: { companyId: actor.companyId },
      update: { brandVoiceId: voice.id },
      create: { companyId: actor.companyId, brandVoiceId: voice.id },
    });
  }

  return NextResponse.json({ data: voice }, { status: body.id ? 200 : 201 });
}
