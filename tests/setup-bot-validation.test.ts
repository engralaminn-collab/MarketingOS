import { afterEach, describe, expect, it } from 'bun:test';
import { BASE_STEPS } from '../src/lib/setup-bot/contract';
import { isUrlSafe } from '../src/lib/ssrf';
import { validateField, verifyMetaToken, verifyWebhook, type Answers } from '../src/lib/setup-bot/validation';

const step = (id: string) => BASE_STEPS.find((item) => item.id === id)!;
const originalVersion = process.env.META_GRAPH_API_VERSION;
afterEach(() => {
  if (originalVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
  else process.env.META_GRAPH_API_VERSION = originalVersion;
});

describe('SetupBot field and provider validation', () => {
  it('distinguishes Page ID, WhatsApp IDs, and E.164 phone numbers', () => {
    expect(validateField(step('pageId'), '123456789012345')).toBe('123456789012345');
    expect(() => validateField(step('pageId'), 'My Page')).toThrow('15–16 digits');
    expect(() => validateField(step('pageId'), '12345678901234')).toThrow('15–16 digits');
    expect(validateField(step('phoneId'), '123456789012345')).toBe('123456789012345');
    expect(() => validateField(step('phoneId'), '+8801712345678')).toThrow('numeric ID');
    expect(validateField(step('phoneNumber'), '+8801712345678')).toBe('+8801712345678');
    expect(() => validateField(step('phoneNumber'), '01712345678')).toThrow('E.164');
    expect(() => validateField(step('pageToken'), 'a\nb')).toThrow();
  });

  it('requires HTTPS URLs without credentials, non-standard ports, query strings or fragments', () => {
    expect(validateField(step('webhookUrl'), 'https://example.com/webhook')).toBe('https://example.com/webhook');
    for (const url of ['http://example.com/hook', 'https://u:p@example.com/hook', 'https://example.com:444/hook', 'https://example.com/hook?secret=x', 'https://example.com/#fragment']) {
      expect(() => validateField(step('webhookUrl'), url)).toThrow();
    }
  });

  it('checks Page identity and token lifetime without returning credentials', async () => {
    const token = 'a-page-token-that-must-not-leak';
    const answers: Answers = {
      pageId: { value: '123456789012345', status: 'format_valid' },
      appId: { value: '123456789', status: 'format_valid' },
      appSecret: { value: 'a-private-app-secret', status: 'stored' },
    };
    const requests: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init! });
      if (String(url).includes('/debug_token')) return Response.json({ data: { is_valid: true, app_id: '123456789', expires_at: 0 } });
      return Response.json({ id: '123456789012345', name: 'Example' });
    }) as typeof fetch;
    const result = await verifyMetaToken('pageToken', token, answers, fakeFetch);
    expect(result.status).toBe('verified');
    expect(JSON.stringify(result)).not.toContain(token);
    expect(requests[0].url).toContain('/v19.0/me?fields=id,name');
    expect(requests[0].url).not.toContain(token);
    expect(new Headers(requests[0].init.headers).get('authorization')).toBe(`Bearer ${token}`);
    expect(requests[0].init.redirect).toBe('error');
    expect(new Headers(requests[1].init.headers).get('authorization')).toBe('Bearer 123456789|a-private-app-secret');
  });

  it('rejects a Page mismatch and a Meta-reported short-lived token', async () => {
    const answers: Answers = {
      pageId: { value: '123456789012345', status: 'format_valid' },
      appId: { value: '123456789', status: 'format_valid' },
      appSecret: { value: 'secret', status: 'stored' },
    };
    const wrongIdentity = (async () => Response.json({ id: '999999999999999' })) as typeof fetch;
    expect(verifyMetaToken('pageToken', 'token', answers, wrongIdentity)).rejects.toThrow('not for the supplied');
    const shortLived = (async (url: string | URL | Request) => String(url).includes('debug_token')
      ? Response.json({ data: { is_valid: true, app_id: '123456789', issued_at: 1_800_000_000, expires_at: 1_800_003_600 } })
      : Response.json({ id: '123456789012345' })) as typeof fetch;
    expect(verifyMetaToken('pageToken', 'token', answers, shortLived)).rejects.toThrow('short-lived');
  });

  it('marks unknown lifetime honestly, verifies WhatsApp against its ID and surfaces outages', async () => {
    const answers: Answers = { phoneId: { value: '555555555555555', status: 'format_valid' } };
    const fakeFetch = (async (url: string | URL | Request) => {
      expect(String(url)).toContain('/555555555555555?fields=id,quality_rating');
      return Response.json({ id: '555555555555555', quality_rating: 'GREEN' });
    }) as typeof fetch;
    const result = await verifyMetaToken('whatsappToken', 'wa-token', answers, fakeFetch);
    expect(result.status).toBe('verified');
    expect(result.note).toContain('lifetime was not checked');
    const down = (async () => { throw new Error('could contain sensitive provider details'); }) as typeof fetch;
    expect(verifyMetaToken('whatsappToken', 'wa-token', answers, down)).rejects.toThrow('could not be reached');
  });

  it('requires an exact webhook challenge and blocks local destinations', async () => {
    let captured = '';
    const good = async (url: string) => {
      captured = url;
      const challenge = new URL(url).searchParams.get('hub.challenge')!;
      return { status: 200, statusText: 'OK', ok: true, headers: new Headers(), text: async () => challenge, json: async <T>() => JSON.parse(challenge) as T };
    };
    const result = await verifyWebhook('https://example.com/hook', 'verify-secret', good);
    expect(result.status).toBe('verified');
    const parsed = new URL(captured);
    expect(parsed.searchParams.get('hub.mode')).toBe('subscribe');
    expect(parsed.searchParams.get('hub.verify_token')).toBe('verify-secret');
    expect(parsed.searchParams.get('hub.challenge')).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain('verify-secret');
    const wrong = async () => ({ status: 200, statusText: 'OK', ok: true, headers: new Headers(), text: async () => 'wrong', json: async <T>() => ({}) as T });
    expect(verifyWebhook('https://example.com/hook', 'verify-secret', wrong)).rejects.toThrow('exact hub.challenge');
    expect((await isUrlSafe('https://127.0.0.1/')).allowed).toBe(false);
    expect((await isUrlSafe('https://169.254.169.254/')).allowed).toBe(false);
  });
});
