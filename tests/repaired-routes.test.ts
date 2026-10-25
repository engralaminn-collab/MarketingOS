import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

const isolatedDbFile = `/tmp/marketingos-route-test-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_URL = `file:${isolatedDbFile}`;
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'ephemeral-test-jwt-secret-at-least-32-chars-long';
}

const originalFetch = globalThis.fetch;
const originalEnv = {
  CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY,
  COMFYUI_BASE_URL: process.env.COMFYUI_BASE_URL,
  COMFYUI_IMAGE_CHECKPOINT: process.env.COMFYUI_IMAGE_CHECKPOINT,
  IMAGE_GENERATION_URL: process.env.IMAGE_GENERATION_URL,
  ZAI_MEDIA_ENABLED: process.env.ZAI_MEDIA_ENABLED,
  AI_PROVIDER: process.env.AI_PROVIDER,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
};

let db: typeof import('../src/lib/db').db;
let generateImagePost: typeof import('../src/app/api/ai/generate-image/route').POST;
let diagramPost: typeof import('../src/app/api/ai/diagram/route').POST;
let diagramFallback: typeof import('../src/app/api/ai/diagram/route').diagramFallback;
let safeMermaidLabel: typeof import('../src/app/api/ai/diagram/route').safeMermaidLabel;
let socialGet: typeof import('../src/app/api/social-accounts/route').GET;
let socialPost: typeof import('../src/app/api/social-accounts/route').POST;
let socialPatch: typeof import('../src/app/api/social-accounts/route').PATCH;
let socialDelete: typeof import('../src/app/api/social-accounts/route').DELETE;

let tenantAAdminToken = '';
let tenantAViewerToken = '';
let tenantBAdminToken = '';

function makeJsonRequest(url: string, method: string, token?: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'user-agent': 'RouteRegressionTest/1.0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  execFileSync('node', ['scripts/init-sqlite-schema.mjs'], {
    env: { ...process.env, DATABASE_URL: `file:${isolatedDbFile}` },
    stdio: 'pipe',
  });

  ({ db } = await import('../src/lib/db'));
  const { createSessionToken, hashPassword } = await import('../src/lib/auth');
  ({ POST: generateImagePost } = await import('../src/app/api/ai/generate-image/route'));
  ({ POST: diagramPost, diagramFallback, safeMermaidLabel } = await import('../src/app/api/ai/diagram/route'));
  ({ GET: socialGet, POST: socialPost, PATCH: socialPatch, DELETE: socialDelete } = await import(
    '../src/app/api/social-accounts/route'
  ));

  const suffix = `rt_${Date.now()}`;
  const hashed = await hashPassword('RegressionTest!2026#Safe');

  const companyA = await db.company.create({
    data: { name: `Regression Tenant A ${suffix}`, slug: `reg-a-${suffix}`, isActive: true },
  });
  const companyB = await db.company.create({
    data: { name: `Regression Tenant B ${suffix}`, slug: `reg-b-${suffix}`, isActive: true },
  });

  const adminA = await db.user.create({
    data: { email: `admin-a-${suffix}@test.local`, name: 'Admin A', passwordHash: hashed, role: 'admin', isActive: true },
  });
  const viewerA = await db.user.create({
    data: { email: `viewer-a-${suffix}@test.local`, name: 'Viewer A', passwordHash: hashed, role: 'viewer', isActive: true },
  });
  const adminB = await db.user.create({
    data: { email: `admin-b-${suffix}@test.local`, name: 'Admin B', passwordHash: hashed, role: 'admin', isActive: true },
  });

  await db.companyUser.createMany({
    data: [
      { userId: adminA.id, companyId: companyA.id, role: 'admin' },
      { userId: viewerA.id, companyId: companyA.id, role: 'viewer' },
      { userId: adminB.id, companyId: companyB.id, role: 'admin' },
    ],
  });

  const req = new Request('http://127.0.0.1:3000/api/auth/login', {
    headers: { 'user-agent': 'RouteRegressionTest/1.0' },
  });
  tenantAAdminToken = (
    await createSessionToken(req, { userId: adminA.id, email: adminA.email, role: 'admin', companyId: companyA.id })
  ).token;
  tenantAViewerToken = (
    await createSessionToken(req, { userId: viewerA.id, email: viewerA.email, role: 'viewer', companyId: companyA.id })
  ).token;
  tenantBAdminToken = (
    await createSessionToken(req, { userId: adminB.id, email: adminB.email, role: 'admin', companyId: companyB.id })
  ).token;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

afterAll(async () => {
  try {
    await db?.$disconnect();
  } catch {
    // ignore
  }
  for (const ext of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(`${isolatedDbFile}${ext}`, { force: true });
  }
});

describe('POST /api/ai/generate-image regression suite', () => {
  it('rejects unauthenticated and insufficient-role requests', async () => {
    const unauth = await generateImagePost(
      makeJsonRequest('http://localhost/api/ai/generate-image', 'POST', undefined, { prompt: 'Test' }),
    );
    expect(unauth.status).toBe(401);

    const forbidden = await generateImagePost(
      makeJsonRequest('http://localhost/api/ai/generate-image', 'POST', tenantAViewerToken, { prompt: 'Test' }),
    );
    expect(forbidden.status).toBe(403);
  });

  it('rejects invalid payloads and unsupported dimensions', async () => {
    const emptyPrompt = await generateImagePost(
      makeJsonRequest('http://localhost/api/ai/generate-image', 'POST', tenantAAdminToken, { prompt: '   ' }),
    );
    expect(emptyPrompt.status).toBe(400);

    const badSize = await generateImagePost(
      makeJsonRequest('http://localhost/api/ai/generate-image', 'POST', tenantAAdminToken, {
        prompt: 'Valid prompt',
        size: '999x999',
      }),
    );
    expect(badSize.status).toBe(400);
  });

  it('returns 503 when no image provider is configured and never fabricates success', async () => {
    delete process.env.COMFYUI_BASE_URL;
    delete process.env.COMFYUI_IMAGE_CHECKPOINT;
    delete process.env.IMAGE_GENERATION_URL;
    process.env.ZAI_MEDIA_ENABLED = 'false';

    const res = await generateImagePost(
      makeJsonRequest('http://localhost/api/ai/generate-image', 'POST', tenantAAdminToken, {
        prompt: 'Product hero',
        saveToContent: false,
      }),
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.data).toBeUndefined();
    expect(typeof json.error).toBe('string');
  });

  it('handles upstream SD WebUI failure explicitly and succeeds when mocked local SD WebUI returns an image', async () => {
    delete process.env.COMFYUI_BASE_URL;
    delete process.env.COMFYUI_IMAGE_CHECKPOINT;
    process.env.ZAI_MEDIA_ENABLED = 'false';
    process.env.IMAGE_GENERATION_URL = 'http://127.0.0.1:7860';

    globalThis.fetch = (async () => new Response('upstream error', { status: 500 })) as typeof fetch;
    const failed = await generateImagePost(
      makeJsonRequest('http://localhost/api/ai/generate-image', 'POST', tenantAAdminToken, {
        prompt: 'Hero banner',
        saveToContent: false,
      }),
    );
    expect(failed.status).toBe(503);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          images: ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    const ok = await generateImagePost(
      makeJsonRequest('http://localhost/api/ai/generate-image', 'POST', tenantAAdminToken, {
        prompt: 'Clean editorial card',
        size: '1024x1024',
        saveToContent: false,
      }),
    );
    expect(ok.status).toBe(201);
    const payload = await ok.json();
    expect(payload.data.success).toBe(true);
    expect(payload.data.provider).toBe('self-hosted-stable-diffusion');
    expect(payload.data.image).toStartWith('data:image/png;base64,');
    expect(payload.data.imageUrl).toBe(payload.data.image);
  });
});

describe('POST /api/ai/diagram regression suite', () => {
  it('sanitizes user labels and supports deterministic fallback for core diagram types', () => {
    const cleaned = safeMermaidLabel('Unsafe [node] --> {inject}\n<script>');
    expect(cleaned).not.toContain('[');
    expect(cleaned).not.toContain('-->');
    expect(cleaned).not.toContain('<');

    expect(diagramFallback('flowchart', 'Lead routing')).toStartWith('graph TD');
    expect(diagramFallback('sequence', 'OAuth callback')).toStartWith('sequenceDiagram');
    expect(diagramFallback('class', 'Domain entities')).toStartWith('classDiagram');
    expect(diagramFallback('state', 'Ticket lifecycle')).toStartWith('stateDiagram-v2');
    expect(diagramFallback('er', 'CRM schema')).toStartWith('erDiagram');
    expect(diagramFallback('gantt', 'Launch schedule')).toStartWith('gantt');
  });

  it('validates authentication and inputs, labels fallback honestly, and distinguishes AI model output', async () => {
    const unauth = await diagramPost(
      makeJsonRequest('http://localhost/api/ai/diagram', 'POST', undefined, { description: 'Flow' }),
    );
    expect(unauth.status).toBe(401);

    const invalidType = await diagramPost(
      makeJsonRequest('http://localhost/api/ai/diagram', 'POST', tenantAAdminToken, {
        description: 'Flow',
        type: 'not-a-diagram',
      }),
    );
    expect(invalidType.status).toBe(400);

    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    const fallbackRes = await diagramPost(
      makeJsonRequest('http://localhost/api/ai/diagram', 'POST', tenantAAdminToken, {
        description: 'Customer onboarding',
        type: 'sequence',
      }),
    );
    expect(fallbackRes.status).toBe(200);
    const fbJson = await fallbackRes.json();
    expect(fbJson.data.generationMode).toBe('rule-based-fallback');
    expect(fbJson.data.degraded).toBe(true);
    expect(fbJson.data.mermaid).toContain('sequenceDiagram');

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ model: 'qwen2.5:7b', message: { content: 'graph TD\n  A[Visitor] --> B[Signup]' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const aiRes = await diagramPost(
      makeJsonRequest('http://localhost/api/ai/diagram', 'POST', tenantAAdminToken, {
        prompt: 'Signup flow',
        type: 'flowchart',
      }),
    );
    expect(aiRes.status).toBe(200);
    const aiJson = await aiRes.json();
    expect(aiJson.data.generationMode).toBe('local-model');
    expect(aiJson.data.degraded).toBe(false);
    expect(aiJson.data.mermaid).toBe('graph TD\n  A[Visitor] --> B[Signup]');
  });
});

describe('/api/social-accounts security & tenant isolation suite (10 scenarios)', () => {
  let createdAccountId = '';

  it('1-4. enforces authentication, RBAC role checks, valid platform, and required token', async () => {
    const r1 = await socialGet(makeJsonRequest('http://localhost/api/social-accounts', 'GET'));
    expect(r1.status).toBe(401);

    const r2 = await socialPost(
      makeJsonRequest('http://localhost/api/social-accounts', 'POST', tenantAViewerToken, {
        platform: 'X',
        accessToken: 'secret-tok',
      }),
    );
    expect(r2.status).toBe(403);

    const r3 = await socialPost(
      makeJsonRequest('http://localhost/api/social-accounts', 'POST', tenantAAdminToken, {
        platform: 'InvalidSocialNet',
        accessToken: 'secret-tok',
      }),
    );
    expect(r3.status).toBe(400);

    const r4 = await socialPost(
      makeJsonRequest('http://localhost/api/social-accounts', 'POST', tenantAAdminToken, {
        platform: 'X',
        accessToken: '   ',
      }),
    );
    expect(r4.status).toBe(400);
  });

  it('5-6. creates an encrypted social account, omits raw tokens, and isolates listing per tenant', async () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { id: 'x-999', name: 'Tenant A Brand', username: 'tenanta' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const rawSecret = 'super-secret-oauth-access-token-value-12345';
    const createRes = await socialPost(
      makeJsonRequest('http://localhost/api/social-accounts', 'POST', tenantAAdminToken, {
        platform: 'X',
        accountName: 'Tenant A Official',
        accountHandle: '@tenanta',
        accessToken: rawSecret,
        scopes: ['tweet.read', 'users.read'],
      }),
    );
    expect(createRes.status).toBe(201);
    const createText = await createRes.text();
    expect(createText).not.toContain(rawSecret);
    const createJson = JSON.parse(createText);
    expect(createJson.account.accessToken).toBeUndefined();
    createdAccountId = createJson.account.id;

    const dbRow = await db.socialAccount.findUnique({ where: { id: createdAccountId } });
    expect(dbRow).not.toBeNull();
    expect(dbRow!.accessToken).not.toContain(rawSecret);

    const listARes = await socialGet(makeJsonRequest('http://localhost/api/social-accounts', 'GET', tenantAAdminToken));
    expect(listARes.status).toBe(200);
    const listAText = await listARes.text();
    expect(listAText).not.toContain(rawSecret);
    const listAJson = JSON.parse(listAText);
    expect(listAJson.accounts.some((a: { id: string }) => a.id === createdAccountId)).toBe(true);

    const listBRes = await socialGet(makeJsonRequest('http://localhost/api/social-accounts', 'GET', tenantBAdminToken));
    expect(listBRes.status).toBe(200);
    const listBJson = await listBRes.json();
    expect(listBJson.accounts.some((a: { id: string }) => a.id === createdAccountId)).toBe(false);
  });

  it('7-10. enforces RBAC and tenant ownership on updates and deletions', async () => {
    const viewerPatch = await socialPatch(
      makeJsonRequest('http://localhost/api/social-accounts', 'PATCH', tenantAViewerToken, {
        id: createdAccountId,
        accountName: 'Hijacked Name',
      }),
    );
    expect(viewerPatch.status).toBe(403);

    const crossTenantPatch = await socialPatch(
      makeJsonRequest('http://localhost/api/social-accounts', 'PATCH', tenantBAdminToken, {
        id: createdAccountId,
        accountName: 'Cross Tenant Hijack',
      }),
    );
    expect(crossTenantPatch.status).toBe(404);

    const okPatch = await socialPatch(
      makeJsonRequest('http://localhost/api/social-accounts', 'PATCH', tenantAAdminToken, {
        id: createdAccountId,
        accountName: 'Tenant A Verified Brand',
        accountHandle: '@tenanta_verified',
      }),
    );
    expect(okPatch.status).toBe(200);
    const okPatchJson = await okPatch.json();
    expect(okPatchJson.account.accountName).toBe('Tenant A Verified Brand');
    expect(okPatchJson.account.accessToken).toBeUndefined();

    const viewerDel = await socialDelete(
      makeJsonRequest('http://localhost/api/social-accounts', 'DELETE', tenantAViewerToken, { id: createdAccountId }),
    );
    expect(viewerDel.status).toBe(403);

    const crossTenantDel = await socialDelete(
      makeJsonRequest('http://localhost/api/social-accounts', 'DELETE', tenantBAdminToken, { id: createdAccountId }),
    );
    expect(crossTenantDel.status).toBe(404);

    const okDel = await socialDelete(
      makeJsonRequest('http://localhost/api/social-accounts', 'DELETE', tenantAAdminToken, { id: createdAccountId }),
    );
    expect(okDel.status).toBe(200);
    const okDelJson = await okDel.json();
    expect(okDelJson.success).toBe(true);
  });
});
