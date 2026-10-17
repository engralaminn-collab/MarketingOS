import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function encryptionKey(): Buffer {
  const value = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 32-byte hex value (64 hex characters)');
  }
  return Buffer.from(value, 'hex');
}

/** Encrypt an integration credential before persisting it to the database. */
export function encryptCredential(plainText: string): string {
  if (!plainText) throw new Error('Credential cannot be empty');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

/** Decrypt only credentials written by this vault version. Legacy base64 values must be reconnected. */
export function decryptCredential(value: string): string {
  if (!value.startsWith(PREFIX)) {
    throw new Error('Legacy credential is not encrypted; reconnect the integration to rotate it securely');
  }
  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Encrypted credential format is invalid');
  const [ivText, tagText, cipherText] = parts;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncryptedCredential(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
