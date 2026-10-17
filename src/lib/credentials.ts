import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

/** Encrypt a credential using AES-256-GCM. A stable production key is required. */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${authTag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

/** Decrypt a value previously returned by encryptSecret. */
export function decryptSecret(value: string): string {
  const parts = value.split(':');
  if (parts.length !== 5 || parts.slice(0, 2).join(':') !== 'enc:v1') {
    throw new Error('Credential is not in the supported encrypted format');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[2], 'base64url');
  const authTag = Buffer.from(parts[3], 'base64url');
  const ciphertext = Buffer.from(parts[4], 'base64url');
  // Reject malformed values before asking OpenSSL to authenticate them.
  if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Encrypted credential is malformed');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/** Encrypt configured secret fields; non-secret labels/IDs remain usable as plain config. */
export function encryptCredentialFields(
  values: Record<string, unknown>,
  secretKeys: ReadonlySet<string>,
): Record<string, string> {
  const encrypted: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(values)) {
    if (typeof rawValue !== 'string') continue;
    const value = rawValue.trim();
    if (!value) continue;
    encrypted[key] = secretKeys.has(key) ? encryptSecret(value) : value;
  }
  return encrypted;
}

function getEncryptionKey(): Buffer {
  const configured = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is required to store integration credentials');
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(configured)) {
    key = Buffer.from(configured, 'hex');
  } else {
    key = Buffer.from(configured, 'base64');
  }
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must encode exactly 32 bytes (64 hex characters or base64)');
  }
  return key;
}
