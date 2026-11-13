import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { SetupSnapshot } from '../src/lib/setup-bot/contract';

const dbFile = `/tmp/marketingos-handoff-flow-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.JWT_SECRET = 'remote-flow-test-jwt-secret-more-than-32-characters';
process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
process.env.ADMIN_SERVICE_TOKEN = 'remote-flow-test-service-token-more-than-32-characters';
process.env.SETUP_HANDOFF_BASE_URL = 'https://main-project.example';
delete process.env.SETUP_CUSTOM_FIELDS;

let shouldFail = true;
const calls: { url: string; init: RequestInit }[] = [];
mock.module('@/lib/ssrf', () => ({
  safeFetchText: async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const status = shouldFail ? 503 : 201;
    return {
      status, statusText: shouldFail ? 'Unavailable' : 'Created', ok: !shouldFail,
      headers: new Headers(), text: async () => '{}', json: async () => shouldFail ? {} : { success: true },
    };
  },
}));

let db: typeof import('../src/lib/db').db;
let setup: typeof import('../src/app/api/setup-bot/route');
let token = '', companyId = '', userId = '', email = '';

function req(method: string, body?: unknown): Request {
  return new Request('https://marketingos.test/api/setup-bot', {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function get(): Promise<SetupSnapshot> {
  const response = await setup.GET(req('GET'));
  expect(response.status).toBe(200);
  return response.json();
}

async function post(snapshot: SetupSnapshot, action: string, extra: Record<string, unknown> = {}): Promise<SetupSnapshot> {
  const response = await setup.POST(req('POST', { action, version: snapshot.version, ...extra }));
  if (response.status !== 200) throw new Error(`${action} failed: ${await response.text()}`);
  return response.json();
}

beforeAll(async () => {
  execFileSync('node', ['scripts/init-sqlite-schema.mjs'], { env: process.env, stdio: 'pipe' });
  ({ db } = await import('../src/lib/db'));
  setup = await import('../src/app/api/setup-bot/route');
  const { createSessionToken, hashPassword } = await import('../src/lib/auth');
  const company = await db.company.create({ data: { name: 'Remote flow test', slug: `remote-flow-${Date.now()}` } });
  const user = await db.user.create({ data: { email: `remote-${Date.now()}@example.test`, name: 'Remote flow owner', passwordHash: await hashPassword('RemoteFlowTestPassword!') } });
  await db.companyUser.create({ data: { companyId: company.id, userId: user.id, role: 'company_owner' } });
  companyId = company.id; userId = user.id; email = user.email;
  process.env.SETUP_HANDOFF_PROJECT_MAP = JSON.stringify({ [companyId]: 'remote-project-id' });
  token = (await createSessionToken(new Request('https://marketingos.test'), { userId, email, role: 'company_owner', companyId })).token;
});

afterAll(async () => {
  await db?.$disconnect();
  for (const ext of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${dbFile}${ext}`, { force: true });
});

describe('remote setup handoff flow', () => {
  it('keeps the draft reviewable after rejection and completes only after acknowledgement', async () => {
    let state = await get();
    while (state.status === 'in_progress') state = await post(state, 'skip', { stepId: state.currentStep });
    state = await post(state, 'verify');
    const failed = await setup.POST(req('POST', { action: 'confirm', version: state.version }));
    expect(failed.status).toBe(502);
    expect(await db.setupImport.findUnique({ where: { companyId } })).toBeNull();
    let row = await db.setupSession.findUniqueOrThrow({ where: { companyId_userId: { companyId, userId } } });
    expect(row.status).toBe('review');
    expect(row.completedAt).toBeNull();
    expect(await db.auditLog.count({ where: { companyId, action: 'setup.confirmed' } })).toBe(0);
    shouldFail = false;
    state = await get();
    state = await post(state, 'confirm');
    expect(state.status).toBe('completed');
    expect(state.handoffTarget).toBe('remote');
    expect(state.handoff).toBe('partial');
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('https://main-project.example/api/v1/projects/remote-project-id/import-setup');
    const firstHeaders = new Headers(calls[0].init.headers);
    const secondHeaders = new Headers(calls[1].init.headers);
    expect(firstHeaders.get('authorization')).toBe(`Bearer ${process.env.ADMIN_SERVICE_TOKEN}`);
    expect(firstHeaders.get('idempotency-key')).toBe(secondHeaders.get('idempotency-key'));
    const payload = JSON.parse(String(calls[1].init.body));
    expect(payload.client_id).toBe(email);
    expect(payload.password_dependency).toBe(false);
    expect(JSON.stringify(payload)).not.toContain('RemoteFlowTestPassword!');
    row = await db.setupSession.findUniqueOrThrow({ where: { companyId_userId: { companyId, userId } } });
    expect(row.status).toBe('completed');
    expect(await db.setupImport.count({ where: { companyId } })).toBe(1);
  });

  it('recovers an interrupted export by pausing after idle and resuming at review', async () => {
    let state = await get();
    state = await post(state, 'reopen');
    await db.setupSession.updateMany({ where: { companyId, userId }, data: { status: 'exporting', lastActivityAt: new Date(Date.now() - 31 * 60_000) } });
    state = await get();
    expect(state.status).toBe('paused');
    state = await post(state, 'resume');
    expect(state.status).toBe('review');
    expect(state.currentStep).toBe('review');
  });
});
