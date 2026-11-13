import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { SetupSnapshot } from '../src/lib/setup-bot/contract';

const dbFile = `/tmp/marketingos-setup-test-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.JWT_SECRET = 'setup-tests-jwt-secret-at-least-thirty-two-characters';
process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
process.env.ADMIN_SERVICE_TOKEN = 'service-token-for-setup-tests-at-least-32-chars';
process.env.SETUP_CUSTOM_FIELDS = JSON.stringify([
  { key: 'shop_key', labelEn: 'Shop key', labelBn: 'শপ কী', secret: true },
  { key: 'reference', labelEn: 'Reference code', labelBn: 'রেফারেন্স' },
]);

const originalFetch = globalThis.fetch;
const PAGE = '123456789012345';
const PHONE_ID = '987654321012345';
const APP_ID = '1234567890';
const APP_SECRET = 'test-meta-secret-not-for-production';
const PAGE_TOKEN = 'test-page-token-not-for-production';
const WA_TOKEN = 'test-wa-token-not-for-production';
const CRM_KEY = 'test-crm-secret-not-for-production';
const PAYMENT_KEY = 'test-payment-secret-not-for-production';
const CUSTOM_KEY = 'test-custom-secret-not-for-production';

let db: typeof import('../src/lib/db').db;
let setup: typeof import('../src/app/api/setup-bot/route');
let importRoute: typeof import('../src/app/api/v1/projects/[projectId]/import-setup/route');
let eraseRoute: typeof import('../src/app/api/setup-bot/import/route');
let login: typeof import('../src/app/api/v1/auth/login/route').POST;
let decryptSecret: typeof import('../src/lib/credentials').decryptSecret;
let companyA = '', companyB = '', emailA = '', emailB = '', userA = '';
let tokenA = '', tokenB = '', viewerToken = '';
let lastA: SetupSnapshot;

function req(path: string, method: string, token?: string, body?: unknown, extraHeaders: Record<string, string> = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'user-agent': 'SetupBotTest', 'x-forwarded-for': '198.18.0.33' };
  if (token) headers.authorization = `Bearer ${token}`;
  Object.assign(headers, extraHeaders);
  return new Request(`https://marketingos.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function get(token: string): Promise<SetupSnapshot> {
  const result = await setup.GET(req('/api/setup-bot', 'GET', token));
  expect(result.status).toBe(200);
  return result.json();
}

async function action(token: string, snapshot: SetupSnapshot, type: string, extra: Record<string, unknown> = {}): Promise<SetupSnapshot> {
  const result = await setup.POST(req('/api/setup-bot', 'POST', token, { action: type, version: snapshot.version, ...extra }));
  if (result.status !== 200) throw new Error(`${type} failed (${result.status}): ${JSON.stringify(await result.json())}`);
  return result.json();
}

function workingMetaFetch(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith('https://graph.facebook.com/v19.0/')) throw new Error('Unexpected provider');
    if (url.includes('/debug_token')) return Response.json({ data: { is_valid: true, app_id: APP_ID, expires_at: 0 } });
    const auth = new Headers(init?.headers).get('authorization');
    if (url.includes(`/${PHONE_ID}`) && auth === `Bearer ${WA_TOKEN}`) return Response.json({ id: PHONE_ID, quality_rating: 'GREEN' });
    if (url.includes('/me') && auth === `Bearer ${PAGE_TOKEN}`) return Response.json({ id: PAGE, name: 'Test page' });
    return new Response(null, { status: 401 });
  }) as typeof fetch;
}

beforeAll(async () => {
  execFileSync('node', ['scripts/init-sqlite-schema.mjs'], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: 'pipe' });
  ({ db } = await import('../src/lib/db'));
  setup = await import('../src/app/api/setup-bot/route');
  importRoute = await import('../src/app/api/v1/projects/[projectId]/import-setup/route');
  eraseRoute = await import('../src/app/api/setup-bot/import/route');
  ({ POST: login } = await import('../src/app/api/v1/auth/login/route'));
  ({ decryptSecret } = await import('../src/lib/credentials'));
  const { createSessionToken, hashPassword } = await import('../src/lib/auth');
  const hash = await hashPassword('SetupTestPassword!2026');
  const a = await db.company.create({ data: { name: 'Setup A', slug: `setup-a-${Date.now()}` } });
  const b = await db.company.create({ data: { name: 'Setup B', slug: `setup-b-${Date.now()}` } });
  companyA = a.id; companyB = b.id;
  const ownerA = await db.user.create({ data: { email: `setup-a-${Date.now()}@example.test`, phone: '+8801712345678', name: 'Owner A', passwordHash: hash } });
  const ownerB = await db.user.create({ data: { email: `setup-b-${Date.now()}@example.test`, name: 'Owner B', passwordHash: hash } });
  const viewer = await db.user.create({ data: { email: `setup-viewer-${Date.now()}@example.test`, name: 'Viewer', passwordHash: hash } });
  emailA = ownerA.email; emailB = ownerB.email; userA = ownerA.id;
  await db.companyUser.createMany({ data: [
    { userId: ownerA.id, companyId: a.id, role: 'company_owner' },
    { userId: ownerB.id, companyId: b.id, role: 'client_user' },
    { userId: viewer.id, companyId: a.id, role: 'viewer' },
  ] });
  const sessionReq = req('/api/auth/login', 'POST');
  tokenA = (await createSessionToken(sessionReq, { userId: ownerA.id, email: emailA, role: 'company_owner', companyId: a.id })).token;
  tokenB = (await createSessionToken(sessionReq, { userId: ownerB.id, email: emailB, role: 'client_user', companyId: b.id })).token;
  viewerToken = (await createSessionToken(sessionReq, { userId: viewer.id, email: viewer.email, role: 'viewer', companyId: a.id })).token;
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  await db?.$disconnect();
  for (const ext of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${dbFile}${ext}`, { force: true });
});

describe('SetupBot routes and secure handoff', () => {
  it('uses durable account lockout after an attempt plus three retries, notifies admins, and supports phone login', async () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const previousEnvironment = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = 'production';
    try {
      const insecure = await login(new Request('http://marketingos.test/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_id: emailA, password: 'not-sent-over-tls' }) }) as never);
      expect(insecure.status).toBe(426);
    } finally {
      if (previousEnvironment === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = previousEnvironment;
    }
    for (let i = 0; i < 4; i++) {
      const response = await login(req('/api/v1/auth/login', 'POST', undefined, { account_id: emailA, password: 'wrong-password' }) as never);
      expect(response.status).toBe(i === 3 ? 429 : 401);
    }
    const lockedViaPhone = await login(req('/api/v1/auth/login', 'POST', undefined, { account_id: '+8801712345678', password: 'SetupTestPassword!2026' }) as never);
    expect(lockedViaPhone.status).toBe(429);
    expect(await db.notification.count({ where: { userId: userA, title: 'Temporary sign-in lock' } })).toBe(1);
    expect(await db.auditLog.count({ where: { companyId: companyA, action: 'user.login_locked' } })).toBe(1);
    const rows = await db.authLoginAttempt.findMany();
    expect(JSON.stringify(rows)).not.toContain(emailA);
    expect(JSON.stringify(rows)).not.toContain('wrong-password');
    await db.authLoginAttempt.deleteMany();
    const ok = await login(req('/api/v1/auth/login', 'POST', undefined, { account_id: '+8801712345678', password: 'SetupTestPassword!2026' }) as never);
    expect(ok.status).toBe(200);
    const response = await ok.json();
    expect(response.token).toBeTruthy();
    expect(JSON.stringify(response)).not.toContain('SetupTestPassword!2026');
    const wrongAgain = await login(req('/api/auth/login', 'POST', undefined, { email: emailA, password: 'wrong-password' }) as never);
    expect(wrongAgain.status).toBe(401);
    const legacySuccess = await login(req('/api/auth/login', 'POST', undefined, { email: emailA, password: 'SetupTestPassword!2026' }) as never);
    expect(legacySuccess.status).toBe(200);
    expect(await db.authLoginAttempt.count()).toBe(0);
  }, 20_000);

  it('rejects unauthenticated/viewer access and isolates drafts per tenant', async () => {
    expect((await setup.GET(req('/api/setup-bot', 'GET'))).status).toBe(401);
    expect((await setup.GET(req('/api/setup-bot', 'GET', viewerToken))).status).toBe(403);
    lastA = await get(tokenA);
    expect(lastA.currentStep).toBe('pageId');
    expect(lastA.steps.some((item) => item.id === 'custom_shop_key')).toBe(true);
    const invalid = await setup.POST(req('/api/setup-bot', 'POST', tokenA, { action: 'save', version: lastA.version, stepId: 'pageId', value: '123' }));
    expect(invalid.status).toBe(400);
    const injectedOtp = await setup.POST(req('/api/setup-bot', 'POST', tokenA, { action: 'save', version: lastA.version, stepId: 'pageId', value: PAGE, otp: '123456' }));
    expect(injectedOtp.status).toBe(400);
    const premature = await setup.POST(req('/api/setup-bot', 'POST', tokenA, { action: 'save', version: lastA.version, stepId: 'appSecret', value: APP_SECRET }));
    expect(premature.status).toBe(409);
    const originalVersion = lastA.version;
    lastA = await action(tokenA, lastA, 'save', { stepId: 'pageId', value: PAGE });
    const stale = await setup.POST(req('/api/setup-bot', 'POST', tokenA, { action: 'skip', stepId: 'phoneId', version: originalVersion }));
    expect(stale.status).toBe(409);
    const b = await get(tokenB);
    expect(b.currentStep).toBe('pageId');
    expect(b.answers).toHaveLength(0);
    const stored = await db.setupSession.findUniqueOrThrow({ where: { companyId_userId: { companyId: companyA, userId: userA } } });
    expect(stored.encryptedData).not.toContain(PAGE);
  });

  it('persists valid steps encrypted and does not return secrets to the browser', async () => {
    globalThis.fetch = workingMetaFetch();
    const values: Record<string, string> = {
      phoneId: PHONE_ID, wabaId: '222222222222222', phoneNumber: '+8801712345678', appId: APP_ID,
      appSecret: APP_SECRET, pageToken: PAGE_TOKEN, whatsappToken: WA_TOKEN,
      instagramId: '111222333444555', crmProvider: 'HubSpot', crmKey: CRM_KEY,
      paymentProvider: 'SSLCommerz', paymentAccountId: 'test-store', paymentSecret: PAYMENT_KEY,
      custom_shop_key: CUSTOM_KEY, custom_reference: 'REF-123',
    };
    while (lastA.status === 'in_progress') {
      const id = lastA.currentStep;
      lastA = values[id]
        ? await action(tokenA, lastA, 'save', { stepId: id, value: values[id] })
        : await action(tokenA, lastA, 'skip', { stepId: id });
      const serialized = JSON.stringify(lastA);
      for (const secret of [APP_SECRET, PAGE_TOKEN, WA_TOKEN, CRM_KEY, PAYMENT_KEY, CUSTOM_KEY]) expect(serialized).not.toContain(secret);
    }
    expect(lastA.status).toBe('review');
    expect(lastA.answers.find((a) => a.stepId === 'custom_shop_key')?.value).toBeNull();
    const row = await db.setupSession.findUniqueOrThrow({ where: { companyId_userId: { companyId: companyA, userId: userA } } });
    for (const secret of [APP_SECRET, PAGE_TOKEN, WA_TOKEN, CRM_KEY, PAYMENT_KEY, CUSTOM_KEY]) expect(row.encryptedData).not.toContain(secret);
    expect(decryptSecret(row.encryptedData)).toContain(PAGE_TOKEN);
  });

  it('blocks completion on an unavailable provider, then imports only after a successful check and explicit confirmation', async () => {
    globalThis.fetch = (async () => { throw new Error('offline'); }) as typeof fetch;
    lastA = await action(tokenA, lastA, 'verify');
    expect(lastA.checks.find((c) => c.id === 'facebook')?.status).toBe('unavailable');
    expect(lastA.checks.find((c) => c.id === 'whatsapp')?.status).toBe('unavailable');
    const premature = await setup.POST(req('/api/setup-bot', 'POST', tokenA, { action: 'confirm', version: lastA.version }));
    expect(premature.status).toBe(409);
    expect(await db.setupImport.findUnique({ where: { companyId: companyA } })).toBeNull();
    globalThis.fetch = workingMetaFetch();
    lastA = await action(tokenA, lastA, 'verify');
    expect(lastA.checks.find((c) => c.id === 'facebook')?.status).toBe('verified');
    expect(lastA.checks.find((c) => c.id === 'whatsapp')?.status).toBe('verified');
    expect(lastA.answers.find((a) => a.stepId === 'pageId')?.status).toBe('verified');
    expect(lastA.answers.find((a) => a.stepId === 'phoneId')?.status).toBe('verified');
    expect(lastA.checks.find((c) => c.id === 'webhook')?.status).toBe('skipped');
    expect(await db.setupImport.findUnique({ where: { companyId: companyA } })).toBeNull();
    lastA = await action(tokenA, lastA, 'confirm');
    expect(lastA.status).toBe('completed');
    expect(lastA.handoff).toBe('partial');
    const stored = await db.setupImport.findUniqueOrThrow({ where: { companyId: companyA } });
    expect(stored.encryptedPayload).not.toContain(PAGE_TOKEN);
    const payload = JSON.parse(decryptSecret(stored.encryptedPayload));
    expect(payload.client_id).toBe(emailA);
    expect(payload.password_dependency).toBe(false);
    expect(payload.integrations.facebook.page_access_token).toBe(PAGE_TOKEN);
    expect(decryptSecret(payload.integrations.facebook.app_secret_encrypted)).toBe(APP_SECRET);
    expect(decryptSecret(payload.integrations.crm.api_key_encrypted)).toBe(CRM_KEY);
    expect(decryptSecret(payload.integrations.payment.secret_encrypted)).toBe(PAYMENT_KEY);
    expect(decryptSecret(payload.integrations.custom.shop_key.value_encrypted)).toBe(CUSTOM_KEY);
    expect(JSON.stringify(payload)).not.toContain('SetupTestPassword!2026');
    const account = await db.socialAccount.findFirstOrThrow({ where: { companyId: companyA, accountId: PAGE } });
    expect(account.status).toBe('active');
    expect(account.accessToken).not.toContain(PAGE_TOKEN);
    expect(decryptSecret(account.accessToken)).toBe(PAGE_TOKEN);
    expect((await db.clientConfig.findUniqueOrThrow({ where: { companyId: companyA } })).onboardingStatus).toBe('pending');
    expect(await db.auditLog.count({ where: { companyId: companyA, action: 'setup.confirmed' } })).toBe(1);
  });

  it('does not claim remote completion when handoff configuration fails', async () => {
    globalThis.fetch = workingMetaFetch();
    lastA = await action(tokenA, lastA, 'reopen');
    lastA = await action(tokenA, lastA, 'verify');
    lastA = await action(tokenA, lastA, 'edit', { stepId: 'pageId' });
    lastA = await action(tokenA, lastA, 'save', { stepId: 'pageId', value: '999999999999999' });
    expect(lastA.answers.find((a) => a.stepId === 'pageToken')?.status).toBe('unverified');
    expect(lastA.checks).toHaveLength(0);
    lastA = await action(tokenA, lastA, 'verify');
    expect(lastA.checks.find((c) => c.id === 'facebook')?.status).toBe('failed');
    lastA = await action(tokenA, lastA, 'edit', { stepId: 'pageId' });
    lastA = await action(tokenA, lastA, 'save', { stepId: 'pageId', value: PAGE });
    lastA = await action(tokenA, lastA, 'verify');
    expect(lastA.checks.find((c) => c.id === 'facebook')?.status).toBe('verified');
    process.env.SETUP_HANDOFF_BASE_URL = 'https://main-project.example';
    delete process.env.SETUP_HANDOFF_PROJECT_MAP;
    try {
      const failed = await setup.POST(req('/api/setup-bot', 'POST', tokenA, { action: 'confirm', version: lastA.version }));
      expect(failed.status).toBe(503);
      const row = await db.setupSession.findUniqueOrThrow({ where: { companyId_userId: { companyId: companyA, userId: userA } } });
      expect(row.status).toBe('review');
      expect(await db.auditLog.count({ where: { companyId: companyA, action: 'setup.confirmed' } })).toBe(1);
      expect((await db.setupImport.findUniqueOrThrow({ where: { companyId: companyA } })).verification).toBe('partial');
    } finally {
      delete process.env.SETUP_HANDOFF_BASE_URL;
      delete process.env.SETUP_HANDOFF_PROJECT_MAP;
    }
    lastA = await get(tokenA);
    lastA = await action(tokenA, lastA, 'confirm');
    expect(lastA.status).toBe('completed');
    expect(lastA.handoffTarget).toBe('local');
  });

  it('pauses after 30 minutes without losing saved progress and resumes only explicitly', async () => {
    let b = await get(tokenB);
    b = await action(tokenB, b, 'save', { stepId: 'pageId', value: '999999999999999' });
    await db.setupSession.updateMany({ where: { companyId: companyB }, data: { lastActivityAt: new Date(Date.now() - 31 * 60_000) } });
    const paused = await get(tokenB);
    expect(paused.status).toBe('paused');
    expect(paused.answers.find((item) => item.stepId === 'pageId')?.value).toBe('999999999999999');
    const cannotMutate = await setup.POST(req('/api/setup-bot', 'POST', tokenB, { action: 'skip', stepId: 'phoneId', version: paused.version }));
    expect(cannotMutate.status).toBe(409);
    b = await action(tokenB, paused, 'resume');
    expect(b.status).toBe('in_progress');
    expect(b.currentStep).toBe('phoneId');
  });

  it('restricts service import to a configured bearer, validates membership, and never trusts external verification', async () => {
    const saved = await db.setupImport.findUniqueOrThrow({ where: { companyId: companyA } });
    const payload = JSON.parse(decryptSecret(saved.encryptedPayload));
    const context = { params: Promise.resolve({ projectId: companyB }) };
    const unauthorized = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', 'incorrect', payload), context);
    expect(unauthorized.status).toBe(401);
    const wrongTenant = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', process.env.ADMIN_SERVICE_TOKEN, payload), context);
    expect(wrongTenant.status).toBe(403);
    payload.client_id = emailB;
    const unsafe = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', process.env.ADMIN_SERVICE_TOKEN, { ...payload, password: 'do-not-store' }), context);
    expect(unsafe.status).toBe(400);
    const key = 'a'.repeat(64);
    const ok = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', process.env.ADMIN_SERVICE_TOKEN, payload, { 'idempotency-key': key }), context);
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ success: true, verification: 'unverified' });
    const { encryptSecret } = await import('../src/lib/credentials');
    const retryPayload = structuredClone(payload);
    retryPayload.setup_completed_at = new Date(Date.now() + 1000).toISOString();
    retryPayload.integrations.facebook.app_secret_encrypted = encryptSecret(APP_SECRET);
    const retry = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', process.env.ADMIN_SERVICE_TOKEN, retryPayload, { 'idempotency-key': key }), context);
    expect(retry.status).toBe(200);
    retryPayload.integrations.facebook.page_id = '999999999999999';
    const conflict = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', process.env.ADMIN_SERVICE_TOKEN, retryPayload, { 'idempotency-key': key }), context);
    expect(conflict.status).toBe(409);
    // An older retry stays idempotent even after a newer import was accepted.
    const newer = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', process.env.ADMIN_SERVICE_TOKEN, retryPayload, { 'idempotency-key': 'b'.repeat(64) }), context);
    expect(newer.status).toBe(201);
    const oldRetry = await importRoute.POST(req('/api/v1/projects/x/import-setup', 'POST', process.env.ADMIN_SERVICE_TOKEN, payload, { 'idempotency-key': key }), context);
    expect(oldRetry.status).toBe(200);
    expect(await db.auditLog.count({ where: { companyId: companyB, action: 'setup.service_import' } })).toBe(2);
    const bImport = await db.setupImport.findUniqueOrThrow({ where: { companyId: companyB } });
    expect(JSON.parse(decryptSecret(bImport.encryptedPayload)).integrations.facebook.page_id).toBe('999999999999999');
    expect(bImport.verification).toBe('unverified');
    expect(bImport.encryptedPayload).not.toContain(PAGE_TOKEN);
    expect(await db.socialAccount.count({ where: { companyId: companyB } })).toBe(0);
  });

  it('deletes only the caller’s draft, not a confirmed import', async () => {
    const response = await setup.DELETE(req('/api/setup-bot', 'DELETE', tokenA));
    expect(response.status).toBe(204);
    expect(await db.setupSession.count({ where: { companyId: companyA, userId: userA } })).toBe(0);
    expect(await db.setupImport.count({ where: { companyId: companyA } })).toBe(1);
  });

  it('lets admins erase local setup data but preserves credentials rotated outside the wizard', async () => {
    const forbidden = await eraseRoute.DELETE(req('/api/setup-bot/import', 'DELETE', tokenB, undefined, { 'x-confirm-setup-erasure': 'yes' }));
    expect(forbidden.status).toBe(403);
    const missingConsent = await eraseRoute.DELETE(req('/api/setup-bot/import', 'DELETE', tokenA));
    expect(missingConsent.status).toBe(400);
    const { encryptSecret } = await import('../src/lib/credentials');
    const { credentialFingerprint } = await import('../src/lib/setup-bot/privacy');
    const rotated = await db.socialAccount.create({ data: {
      companyId: companyA, platform: 'Facebook', accountId: '777777777777777', accountName: 'Rotated outside setup',
      accessToken: encryptSecret('replacement-token'), status: 'active',
    } });
    await db.setupManagedResource.create({ data: { companyId: companyA, kind: 'social_account', resourceId: rotated.id, credentialFingerprint: credentialFingerprint('old-token') } });
    const erased = await eraseRoute.DELETE(req('/api/setup-bot/import', 'DELETE', tokenA, undefined, { 'x-confirm-setup-erasure': 'yes' }));
    expect(erased.status).toBe(200);
    expect(await erased.json()).toEqual({ success: true, remoteDeletionRequired: true });
    expect(await db.setupImport.count({ where: { companyId: companyA } })).toBe(0);
    expect(await db.setupManagedResource.count({ where: { companyId: companyA } })).toBe(0);
    expect(await db.socialAccount.findFirst({ where: { companyId: companyA, accountId: PAGE } })).toBeNull();
    expect(await db.socialAccount.findUnique({ where: { id: rotated.id } })).not.toBeNull();
    expect(await db.setupImport.count({ where: { companyId: companyB } })).toBe(1);
    const config = await db.clientConfig.findUniqueOrThrow({ where: { companyId: companyA } });
    expect(config.channelCredentials).not.toContain('setup-import:');
    expect(config.onboardingStatus).toBe('pending');
  });
});
