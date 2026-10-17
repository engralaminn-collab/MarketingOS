import { db } from '@/lib/db';
import { decryptSecret, isEncryptedSecret } from '@/lib/credentials';

export class ToolCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolCredentialsError';
  }
}

/**
 * Load a company's stored configuration for a catalog tool. Secrets are
 * decrypted only on the server and never returned to client-facing routes.
 */
export async function getCompanyToolCredentials(
  companyId: string,
  toolNumber: number,
  requiredEncryptedKeys: readonly string[] = [],
): Promise<Record<string, string> | null> {
  const tool = await db.toolDefinition.findUnique({ where: { toolNumber }, select: { id: true } });
  if (!tool) return null;

  const connection = await db.toolConnection.findUnique({
    where: { companyId_toolId: { companyId, toolId: tool.id } },
    select: { status: true, credentials: true },
  });
  if (!connection || !['configured', 'active'].includes(connection.status)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(connection.credentials);
  } catch {
    throw new ToolCredentialsError('Stored integration credentials are malformed. Re-save the connection in Integrations.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ToolCredentialsError('Stored integration credentials are malformed. Re-save the connection in Integrations.');
  }

  const rawValues = raw as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const key of requiredEncryptedKeys) {
    if (typeof rawValues[key] !== 'string' || !isEncryptedSecret(rawValues[key] as string)) {
      throw new ToolCredentialsError(`${key} is missing or not encrypted. Re-save the connection in Integrations.`);
    }
  }
  for (const [key, value] of Object.entries(rawValues)) {
    if (typeof value !== 'string') continue;
    if (isEncryptedSecret(value)) {
      try {
        values[key] = decryptSecret(value);
      } catch {
        throw new ToolCredentialsError('An integration secret cannot be decrypted. Check CREDENTIAL_ENCRYPTION_KEY and re-save the connection.');
      }
    } else {
      values[key] = value;
    }
  }
  for (const key of requiredEncryptedKeys) {
    if (!values[key]) throw new ToolCredentialsError(`${key} is empty. Re-save the connection in Integrations.`);
  }
  return values;
}
