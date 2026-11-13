import { afterEach, describe, expect, it } from 'bun:test';
import { encryptSecret } from '../src/lib/credentials';
import { buildPayload } from '../src/lib/setup-bot/import';
import { handoffIdempotencyKey, payloadFingerprint, sendExternalHandoff } from '../src/lib/setup-bot/handoff';
import { clearChangedDestinations, newSetupData } from '../src/lib/setup-bot/state';
import { type Answers } from '../src/lib/setup-bot/validation';

const keys = ['SETUP_HANDOFF_BASE_URL', 'SETUP_HANDOFF_PROJECT_MAP', 'ADMIN_SERVICE_TOKEN', 'CREDENTIAL_ENCRYPTION_KEY', 'SETUP_CUSTOM_FIELDS'] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

function configure() {
  process.env.SETUP_HANDOFF_BASE_URL = 'https://main-project.example';
  process.env.SETUP_HANDOFF_PROJECT_MAP = JSON.stringify({ tenantA: 'project-123' });
  process.env.ADMIN_SERVICE_TOKEN = 'test-service-token-with-at-least-32-characters';
  process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
}

describe('SetupBot external handoff', () => {
  it('posts only to the operator-mapped HTTPS endpoint with bearer auth and a stable idempotency key', async () => {
    configure();
    const answers: Answers = {
      pageToken: { value: 'secret-page-token', status: 'verified' },
      appSecret: { value: 'secret-app-value', status: 'stored' },
    };
    const payload = buildPayload('client@example.test', answers, []);
    let target = '';
    let init: RequestInit | undefined;
    const fake = async (url: string, options?: RequestInit) => {
      target = url; init = options;
      return { status: 201, statusText: 'Created', ok: true, headers: new Headers(), text: async () => '{"success":true}', json: async <T>() => ({ success: true }) as T };
    };
    await sendExternalHandoff('tenantA', 'session-1', answers, payload, fake);
    expect(target).toBe('https://main-project.example/api/v1/projects/project-123/import-setup');
    expect(target).not.toContain('secret-page-token');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${process.env.ADMIN_SERVICE_TOKEN}`);
    expect(headers.get('idempotency-key')).toBe(handoffIdempotencyKey('session-1', answers));
    expect(headers.get('idempotency-key')).not.toContain('secret');
    expect(JSON.parse(String(init?.body)).integrations.facebook.page_access_token).toBe('secret-page-token');
  });

  it('refuses missing mappings and missing acknowledgements without exposing credentials', async () => {
    configure();
    const answers: Answers = { pageToken: { value: 'never-expose-this-token', status: 'verified' } };
    const payload = buildPayload('client@example.test', answers, []);
    const fake = async () => ({ status: 200, statusText: 'OK', ok: true, headers: new Headers(), text: async () => '{}', json: async <T>() => ({}) as T });
    expect(sendExternalHandoff('other-tenant', 's1', answers, payload, fake)).rejects.toThrow('no external handoff project mapping');
    try {
      await sendExternalHandoff('tenantA', 's1', answers, payload, fake);
      throw new Error('Expected handoff failure');
    } catch (error) {
      expect((error as Error).message).toContain('did not acknowledge');
      expect((error as Error).message).not.toContain('never-expose-this-token');
    }
    process.env.SETUP_HANDOFF_BASE_URL = 'http://main-project.example';
    expect(sendExternalHandoff('tenantA', 's1', answers, payload, fake)).rejects.toThrow('HTTPS origin');
  });

  it('fingerprints equivalent encrypted payloads identically across retries', () => {
    configure();
    const answers: Answers = { appSecret: { value: 'same-secret', status: 'stored' } };
    const first = buildPayload('client@example.test', answers, [], new Date('2026-01-01T00:00:00Z'));
    const second = buildPayload('client@example.test', answers, [], new Date('2026-01-01T00:01:00Z'));
    expect(first.integrations.facebook.app_secret_encrypted).not.toBe(second.integrations.facebook.app_secret_encrypted);
    expect(payloadFingerprint(first)).toBe(payloadFingerprint(second));
    second.integrations.facebook.app_secret_encrypted = encryptSecret('different-secret');
    expect(payloadFingerprint(first)).not.toBe(payloadFingerprint(second));
  });

  it('requires credential re-entry when a webhook or other provider destination changes', () => {
    delete process.env.SETUP_CUSTOM_FIELDS;
    const data = newSetupData();
    data.answers = {
      webhookUrl: { value: 'https://old.example/hook', status: 'format_valid' },
      webhookToken: { value: 'webhook-secret', status: 'verified' },
      crmProvider: { value: 'HubSpot', status: 'format_valid' },
      crmKey: { value: 'crm-secret', status: 'stored' },
      paymentProvider: { value: 'Stripe', status: 'format_valid' },
      paymentSecret: { value: 'payment-secret', status: 'stored' },
    };
    clearChangedDestinations(data, 'webhookUrl', 'https://old.example/hook', 'https://old.example/hook');
    expect(data.answers.webhookToken.value).toBe('webhook-secret');
    clearChangedDestinations(data, 'webhookUrl', 'https://old.example/hook', 'https://new.example/hook');
    clearChangedDestinations(data, 'crmProvider', 'HubSpot', 'Zoho');
    clearChangedDestinations(data, 'paymentProvider', 'Stripe', null);
    expect(data.answers.webhookToken).toBeUndefined();
    expect(data.answers.crmKey).toBeUndefined();
    expect(data.answers.paymentSecret).toBeUndefined();
  });
});
