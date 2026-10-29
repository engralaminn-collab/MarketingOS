import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';

const ADMIN_ROLES = new Set(['company_owner', 'super_admin', 'admin']);

/** PATCH /api/clients/[id] — change configuration without touching code. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.has(actor.role)) return NextResponse.json({ error: 'Only an administrator can change a client' }, { status: 403 });

  const { id } = await context.params;
  if (id !== actor.companyId) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const companyData: Record<string, unknown> = {};
  for (const key of ['name', 'website', 'industry', 'country', 'plan'] as const) {
    if (typeof body[key] === 'string') companyData[key] = body[key];
  }
  if (typeof body.isActive === 'boolean') companyData.isActive = body.isActive;
  if (Object.keys(companyData).length) await db.company.update({ where: { id }, data: companyData });

  const configData: Record<string, unknown> = {};
  if (body.credentialMode === 'managed' || body.credentialMode === 'client_login') configData.credentialMode = body.credentialMode;
  if (body.autoLogoutMinutes) configData.autoLogoutMinutes = Math.min(Math.max(Number(body.autoLogoutMinutes), 1), 240);
  if (body.passwordRotationDays) configData.passwordRotationDays = Math.min(Math.max(Number(body.passwordRotationDays), 7), 365);
  if (Array.isArray(body.channels)) {
    const channels = body.channels.filter((c: unknown): c is string => typeof c === 'string');
    configData.allowedChannels = JSON.stringify(channels);
    configData.channelCredentials = JSON.stringify(
      Object.fromEntries(channels.map((channel: string) => [channel, { mode: body.credentialMode || 'client_login', reference: null }]))
    );
  }
  if (['pending', 'configured', 'paused'].includes(body.onboardingStatus)) configData.onboardingStatus = body.onboardingStatus;
  if (typeof body.notes === 'string') configData.notes = body.notes.slice(0, 500);

  const config = await db.clientConfig.upsert({
    where: { companyId: id },
    update: configData,
    create: { companyId: id, ...configData },
  });

  await emitEvent({
    companyId: id,
    userId: actor.userId,
    type: 'client.updated',
    title: `Client configuration updated`,
    description: `Client configuration updated: ${company.name}`,
    resourceType: 'company',
    resourceId: id,
    metadata: configData as Record<string, unknown>,
  });

  return NextResponse.json({ data: { id, config } });
}
