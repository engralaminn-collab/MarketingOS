import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';

/**
 * Client workspaces.
 *
 * A client is a Company row plus a ClientConfig row. There is exactly one
 * application: adding a client is configuration, not a deployment. This is what
 * keeps onboarding cost flat as the agency grows.
 */

const ADMIN_ROLES = new Set(['company_owner', 'super_admin', 'admin']);
const DEFAULT_CHANNELS = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'whatsapp', 'sms', 'email'];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'client';
}

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isOperator = ADMIN_ROLES.has(actor.role);
  const companies = await db.company.findMany({
    where: isOperator ? {} : { id: actor.companyId },
    orderBy: { createdAt: 'asc' },
  });
  const configs = await db.clientConfig.findMany({ where: { companyId: { in: companies.map((c) => c.id) } } });
  const voices = await db.brandVoice.findMany({ where: { companyId: { in: companies.map((c) => c.id) } } });
  const personas = await db.brandPersona.findMany({ where: { companyId: { in: companies.map((c) => c.id) } } });
  const users = await db.companyUser.groupBy({ by: ['companyId'], where: { companyId: { in: companies.map((c) => c.id) } }, _count: true });

  const configByCompany = new Map(configs.map((c) => [c.companyId, c]));
  const userCount = new Map(users.map((u) => [u.companyId, u._count]));

  return NextResponse.json({
    data: companies.map((company) => {
      const config = configByCompany.get(company.id);
      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        website: company.website,
        industry: company.industry,
        country: company.country,
        plan: company.plan,
        isActive: company.isActive,
        createdAt: company.createdAt.toISOString(),
        users: userCount.get(company.id) ?? 0,
        voices: voices.filter((v) => v.companyId === company.id).length,
        personas: personas.filter((p) => p.companyId === company.id).length,
        config: config
          ? {
              credentialMode: config.credentialMode,
              autoLogoutMinutes: config.autoLogoutMinutes,
              passwordRotationDays: config.passwordRotationDays,
              allowedChannels: JSON.parse(config.allowedChannels || '[]'),
              onboardingStatus: config.onboardingStatus,
              dataRegion: config.dataRegion,
              personaLimit: config.personaLimit,
              brandVoiceId: config.brandVoiceId,
              notes: config.notes,
            }
          : null,
      };
    }),
    meta: {
      total: companies.length,
      configured: configs.length,
      isOperator,
      // Explicit contract: no per-client application exists or is needed.
      deploymentModel: 'single-tenant-configurable',
    },
  });
}

/** POST /api/clients — provision or re-configure a client workspace. */
export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.has(actor.role)) return NextResponse.json({ error: 'Only an administrator can provision a client' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'A client name is required' }, { status: 400 });
  }

  const name = body.name.trim().slice(0, 120);
  const slug = slugify(typeof body.slug === 'string' && body.slug.trim() ? body.slug : name);
  const channels: string[] = Array.isArray(body.channels) && body.channels.length > 0
    ? body.channels.filter((c: unknown): c is string => typeof c === 'string').slice(0, 20)
    : DEFAULT_CHANNELS;
  const credentialMode = body.credentialMode === 'managed' ? 'managed' : 'client_login';
  const autoLogoutMinutes = Math.min(Math.max(Number(body.autoLogoutMinutes) || 15, 1), 240);
  const passwordRotationDays = Math.min(Math.max(Number(body.passwordRotationDays) || 90, 7), 365);

  const existing = await db.company.findUnique({ where: { slug } });
  const company = existing
    ? await db.company.update({
        where: { id: existing.id },
        data: {
          name,
          website: typeof body.website === 'string' ? body.website : existing.website,
          industry: typeof body.industry === 'string' ? body.industry : existing.industry,
          country: typeof body.country === 'string' ? body.country : existing.country,
          plan: typeof body.plan === 'string' ? body.plan : existing.plan,
        },
      })
    : await db.company.create({
        data: {
          name,
          slug,
          website: typeof body.website === 'string' ? body.website : null,
          industry: typeof body.industry === 'string' ? body.industry : null,
          country: typeof body.country === 'string' ? body.country : null,
          plan: typeof body.plan === 'string' ? body.plan : 'free',
        },
      });

  const config = await db.clientConfig.upsert({
    where: { companyId: company.id },
    update: {
      credentialMode,
      autoLogoutMinutes,
      passwordRotationDays,
      allowedChannels: JSON.stringify(channels),
      onboardingStatus: body.onboardingStatus === 'paused' ? 'paused' : 'configured',
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : undefined,
      channelCredentials: JSON.stringify(
        Object.fromEntries(channels.map((channel) => [channel, { mode: credentialMode, reference: null }]))
      ),
    },
    create: {
      companyId: company.id,
      credentialMode,
      autoLogoutMinutes,
      passwordRotationDays,
      allowedChannels: JSON.stringify(channels),
      onboardingStatus: 'configured',
      dataRegion: 'local',
      personaLimit: Math.min(Math.max(Number(body.personaLimit) || 3, 1), 10),
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
      channelCredentials: JSON.stringify(
        Object.fromEntries(channels.map((channel) => [channel, { mode: credentialMode, reference: null }]))
      ),
    },
  });

  // Every client gets a house voice so output is consistent from day one.
  const voiceName = `${name} house voice`;
  const existingVoice = await db.brandVoice.findFirst({ where: { companyId: company.id, isDefault: true } });
  const voice = existingVoice
    ? await db.brandVoice.update({
        where: { id: existingVoice.id },
        data: {
          tone: typeof body.tone === 'string' ? body.tone : existingVoice.tone,
          personaLine: typeof body.personaLine === 'string' ? body.personaLine : existingVoice.personaLine,
        },
      })
    : await db.brandVoice.create({
        data: {
          name: voiceName,
          companyId: company.id,
          tone: typeof body.tone === 'string' ? body.tone : 'professional',
          personaLine: typeof body.personaLine === 'string' ? body.personaLine : `How ${name} sounds to its customers.`,
          isDefault: true,
        },
      });
  if (!config.brandVoiceId) {
    await db.clientConfig.update({ where: { companyId: company.id }, data: { brandVoiceId: voice.id } });
  }

  await emitEvent({
    companyId: company.id,
    userId: actor.userId,
    type: existing ? 'client.updated' : 'client.provisioned',
    title: `Client workspace ${existing ? "updated" : "provisioned"}`,
    description: `Client workspace ${existing ? 'reconfigured' : 'provisioned'}: ${name}`,
    resourceType: 'company',
    resourceId: company.id,
    metadata: { channels, credentialMode, autoLogoutMinutes },
  });

  return NextResponse.json(
    {
      data: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        channels,
        credentialMode,
        autoLogoutMinutes,
        passwordRotationDays,
        brandVoiceId: voice.id,
      },
    },
    { status: existing ? 200 : 201 }
  );
}
