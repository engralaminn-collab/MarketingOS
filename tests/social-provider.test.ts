import { afterEach, describe, expect, it } from 'bun:test';
import { verifySocialCredential } from '../src/lib/social-provider';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('live social credential verification', () => {
  it('calls the fixed platform identity endpoint and returns safe identity fields', async () => {
    let requestedUrl = '';
    let authorization = '';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get('Authorization') || '';
      return new Response(JSON.stringify({
        data: { id: 'user-123', name: 'Marketing Account', username: 'marketing' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const result = await verifySocialCredential('X', 'test-token');
    expect(requestedUrl).toBe('https://api.x.com/2/users/me?user.fields=name,username');
    expect(authorization).toBe('Bearer test-token');
    expect(result.accountId).toBe('user-123');
    expect(result.accountName).toBe('Marketing Account');
  });

  it('rejects invalid credentials without echoing the supplied token', async () => {
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

    await expect(verifySocialCredential('Facebook', 'secret-token-value'))
      .rejects.toThrow('Facebook rejected the supplied credential (HTTP 401)');
  });

  it('does not allow arbitrary platform URLs', async () => {
    await expect(verifySocialCredential('https://attacker.invalid', 'token'))
      .rejects.toThrow('Unsupported social platform');
  });
});
