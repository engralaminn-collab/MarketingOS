import { afterEach, describe, expect, it } from 'bun:test';
import { decryptCredential, encryptCredential, isEncryptedCredential } from '../src/lib/credential-vault';

const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  else process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
});

describe('credential vault', () => {
  it('encrypts and decrypts credentials with AES-256-GCM', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
    const secret = 'social-access-token-should-not-be-stored-in-plain-text';
    const encrypted = encryptCredential(secret);
    expect(encrypted).not.toContain(secret);
    expect(isEncryptedCredential(encrypted)).toBe(true);
    expect(decryptCredential(encrypted)).toBe(secret);
  });

  it('rejects legacy base64 credentials instead of treating them as encrypted', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
    expect(isEncryptedCredential(btoa('legacy-token'))).toBe(false);
    expect(() => decryptCredential(btoa('legacy-token'))).toThrow('Legacy credential is not encrypted');
  });

  it('requires a correctly sized encryption key', () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'too-short';
    expect(() => encryptCredential('token')).toThrow('32-byte hex value');
  });
});
