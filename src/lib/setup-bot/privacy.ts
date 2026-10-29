import { createHmac } from 'node:crypto';
import { decryptSecret } from '@/lib/credentials';
import type { Prisma } from '@prisma/client';

/** Keyed digest identifies a managed credential without keeping it in plaintext. */
export function credentialFingerprint(value: string): string {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error('Credential encryption key unavailable');
  return createHmac('sha256', key).update(value).digest('hex');
}

export async function recordManagedCredential(tx: Prisma.TransactionClient, companyId: string, kind: string, resourceId: string, token: string): Promise<void> {
  const fingerprint = credentialFingerprint(token);
  await tx.setupManagedResource.upsert({
    where: { companyId_kind_resourceId: { companyId, kind, resourceId } },
    create: { companyId, kind, resourceId, credentialFingerprint: fingerprint },
    update: { credentialFingerprint: fingerprint },
  });
}

/** Delete only setup-managed credentials still matching the last imported token. */
export async function eraseManagedSetup(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  const resources = await tx.setupManagedResource.findMany({ where: { companyId } });
  for (const resource of resources) {
    if (resource.kind === 'social_account') {
      const account = await tx.socialAccount.findFirst({ where: { id: resource.resourceId, companyId }, select: { id: true, accessToken: true } });
      if (account) {
        // Fail closed on an unreadable encrypted record instead of silently
        // claiming deletion. Changed credentials are intentionally retained.
        const fingerprint = credentialFingerprint(decryptSecret(account.accessToken));
        if (fingerprint === resource.credentialFingerprint) await tx.socialAccount.delete({ where: { id: account.id } });
      }
    }
    if (resource.kind === 'tool_connection') {
      const connection = await tx.toolConnection.findFirst({ where: { id: resource.resourceId, companyId }, select: { id: true, credentials: true } });
      if (connection) {
        const values = JSON.parse(connection.credentials) as Record<string, unknown>;
        const encrypted = values.FACEBOOK_PAGE_ACCESS_TOKEN;
        if (typeof encrypted !== 'string') throw new Error('Managed credential cannot be inspected');
        const fingerprint = credentialFingerprint(decryptSecret(encrypted));
        if (fingerprint === resource.credentialFingerprint) {
          await tx.toolUsageLog.deleteMany({ where: { connectionId: connection.id } });
          await tx.toolConnection.delete({ where: { id: connection.id } });
        }
      }
    }
  }
  const imported = await tx.setupImport.findUnique({ where: { companyId }, select: { id: true } });
  const config = await tx.clientConfig.findUnique({ where: { companyId } });
  if (config && imported) {
    let refs: Record<string, unknown>;
    try {
      const parsed = JSON.parse(config.channelCredentials || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Malformed references');
      refs = parsed as Record<string, unknown>;
    } catch { throw new Error('Client credential references cannot be inspected'); }
    for (const [key, value] of Object.entries(refs)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).reference === `setup-import:${imported.id}`) delete refs[key];
    }
    await tx.clientConfig.update({ where: { companyId }, data: { channelCredentials: JSON.stringify(refs), onboardingStatus: 'pending' } });
  }
  await tx.setupManagedResource.deleteMany({ where: { companyId } });
  await tx.setupHandoffReceipt.deleteMany({ where: { companyId } });
  await tx.setupImport.deleteMany({ where: { companyId } });
  await tx.setupSession.deleteMany({ where: { companyId } });
}
