import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// Isolated temporary database and network stub: these tests must never contact
// any real provider, spend money, publish, or send a message.
const dbFile = `/tmp/marketingos-safety-${process.pid}-${Date.now()}.db`;
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.JWT_SECRET = 'safety-tests-only-jwt-secret-more-than-32-characters';
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let db: typeof import('../src/lib/db').db;
let workflow: typeof import('../src/app/api/workflows/route');
let execute: typeof import('../src/app/api/workflows/execute/route');
let workflowById: typeof import('../src/app/api/workflows/[id]/route');
let runs: typeof import('../src/app/api/workflows/[id]/runs/route');
let content: typeof import('../src/app/api/content/route');
let contentById: typeof import('../src/app/api/content/[id]/route');
let analytics: typeof import('../src/app/api/analytics/route');
let dashboard: typeof import('../src/app/api/dashboard/route');
let campaigns: typeof import('../src/app/api/campaigns/route');
let email: typeof import('../src/app/api/email/send/route');
let sms: typeof import('../src/app/api/sms/send/route');
let broadcast: typeof import('../src/app/api/sms/broadcast/route');
let otp: typeof import('../src/app/api/sms/otp/route');
let verifyOtp: typeof import('../src/app/api/sms/otp/verify/route');
let voice: typeof import('../src/app/api/voip/call/route');
let smsMessages: typeof import('../src/app/api/sms/messages/route');
let inbox: typeof import('../src/app/api/social/inbox/route');
let knowledge: typeof import('../src/app/api/workforce/knowledge/route');
let wiki: typeof import('../src/app/api/knowledge/wiki/route');
let memory: typeof import('../src/app/api/workforce/memory/route');
let conversation: typeof import('../src/app/api/workforce/conversations/[id]/route');
let workforceChat: typeof import('../src/app/api/workforce/chat/route');
let music: typeof import('../src/app/api/ai/generate-music/route');
let agentRun: typeof import('../src/app/api/ai/agents/[id]/run/route');
let transcribe: typeof import('../src/app/api/ai/transcribe/route');
let clients: typeof import('../src/app/api/clients/route');
let clientById: typeof import('../src/app/api/clients/[id]/route');
let readiness: typeof import('../src/app/api/agency/readiness/route');
let agencyDepartments: typeof import('../src/app/api/agency/departments/route');
let users: typeof import('../src/app/api/users/route');
let userById: typeof import('../src/app/api/users/[id]/route');
let agencySops: typeof import('../src/app/api/agency/sops/route');
let personaRender: typeof import('../src/app/api/brand/personas/[id]/render/route');
let personaApi: typeof import('../src/app/api/brand/personas/route');
let lipsync: typeof import('../src/app/api/media/lipsync/route');
let talkingHead: typeof import('../src/app/api/media/talking-head/route');
let talkingHeadAudio: typeof import('../src/app/api/media/talking-head/audio/route');
let engine: typeof import('../src/lib/workforce/engine');
let hasPermission: typeof import('../src/lib/auth').hasPermission;
let a = '', b = '', userA = '', userB = '', employeeA = '', employeeB = '', convId = '';
let owner = '', otherOwner = '', viewer = '', specialist = '', institutionOnly = '', scopedSuperRole = '';

function req(path: string, method: string, token?: string, body?: unknown, headers?: Record<string, string>): any {
  return new Request(`https://marketingos.test${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const routeContext = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  execFileSync('node', ['scripts/init-sqlite-schema.mjs'], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: 'pipe' });
  globalThis.fetch = (async () => { fetchCalls++; throw new Error('Network forbidden in safety tests'); }) as typeof fetch;
  ({ db } = await import('../src/lib/db'));
  workflow = await import('../src/app/api/workflows/route');
  execute = await import('../src/app/api/workflows/execute/route');
  workflowById = await import('../src/app/api/workflows/[id]/route');
  runs = await import('../src/app/api/workflows/[id]/runs/route');
  content = await import('../src/app/api/content/route');
  contentById = await import('../src/app/api/content/[id]/route');
  analytics = await import('../src/app/api/analytics/route');
  dashboard = await import('../src/app/api/dashboard/route');
  campaigns = await import('../src/app/api/campaigns/route');
  email = await import('../src/app/api/email/send/route');
  sms = await import('../src/app/api/sms/send/route');
  broadcast = await import('../src/app/api/sms/broadcast/route');
  otp = await import('../src/app/api/sms/otp/route');
  verifyOtp = await import('../src/app/api/sms/otp/verify/route');
  voice = await import('../src/app/api/voip/call/route');
  smsMessages = await import('../src/app/api/sms/messages/route');
  inbox = await import('../src/app/api/social/inbox/route');
  knowledge = await import('../src/app/api/workforce/knowledge/route');
  wiki = await import('../src/app/api/knowledge/wiki/route');
  memory = await import('../src/app/api/workforce/memory/route');
  conversation = await import('../src/app/api/workforce/conversations/[id]/route');
  workforceChat = await import('../src/app/api/workforce/chat/route');
  music = await import('../src/app/api/ai/generate-music/route');
  agentRun = await import('../src/app/api/ai/agents/[id]/run/route');
  transcribe = await import('../src/app/api/ai/transcribe/route');
  clients = await import('../src/app/api/clients/route');
  clientById = await import('../src/app/api/clients/[id]/route');
  readiness = await import('../src/app/api/agency/readiness/route');
  agencyDepartments = await import('../src/app/api/agency/departments/route');
  users = await import('../src/app/api/users/route');
  userById = await import('../src/app/api/users/[id]/route');
  agencySops = await import('../src/app/api/agency/sops/route');
  personaRender = await import('../src/app/api/brand/personas/[id]/render/route');
  personaApi = await import('../src/app/api/brand/personas/route');
  lipsync = await import('../src/app/api/media/lipsync/route');
  talkingHead = await import('../src/app/api/media/talking-head/route');
  talkingHeadAudio = await import('../src/app/api/media/talking-head/audio/route');
  engine = await import('../src/lib/workforce/engine');
  const auth = await import('../src/lib/auth');
  hasPermission = auth.hasPermission;

  const coA = await db.company.create({ data: { name: 'Safety A', slug: 'safety-a' } });
  const coB = await db.company.create({ data: { name: 'Safety B', slug: 'safety-b' } });
  a = coA.id; b = coB.id;
  const user = await db.user.create({ data: { email: 'safety-a@example.test', name: 'A owner', passwordHash: 'unused' } });
  const other = await db.user.create({ data: { email: 'safety-b@example.test', name: 'B owner', passwordHash: 'unused' } });
  const observer = await db.user.create({ data: { email: 'safety-viewer@example.test', name: 'Viewer', passwordHash: 'unused' } });
  const editor = await db.user.create({ data: { email: 'safety-editor@example.test', name: 'Editor', passwordHash: 'unused' } });
  const scopedRole = await db.user.create({ data: { email: 'safety-scoped@example.test', name: 'Scoped role', passwordHash: 'unused', isSuperAdmin: false } });
  const institution = await db.institution.create({ data: { name: 'Test school', code: 'test-school' } });
  const student = await db.user.create({ data: { email: 'student@example.test', name: 'Student', passwordHash: 'unused', role: 'student', institutionId: institution.id } });
  userA = user.id; userB = other.id;
  await db.companyUser.createMany({ data: [
    { userId: user.id, companyId: a, role: 'company_owner' },
    { userId: other.id, companyId: b, role: 'company_owner' },
    { userId: observer.id, companyId: a, role: 'viewer' },
    { userId: editor.id, companyId: a, role: 'content_manager' },
    { userId: scopedRole.id, companyId: a, role: 'super_admin' },
  ] });
  const r = req('/', 'POST');
  owner = (await auth.createSessionToken(r, { userId: user.id, email: user.email, role: 'company_owner', companyId: a })).token;
  otherOwner = (await auth.createSessionToken(r, { userId: other.id, email: other.email, role: 'company_owner', companyId: b })).token;
  viewer = (await auth.createSessionToken(r, { userId: observer.id, email: observer.email, role: 'viewer', companyId: a })).token;
  specialist = (await auth.createSessionToken(r, { userId: editor.id, email: editor.email, role: 'content_manager', companyId: a })).token;
  institutionOnly = (await auth.createSessionToken(r, { userId: student.id, email: student.email, role: 'student', institutionId: institution.id })).token;
  scopedSuperRole = (await auth.createSessionToken(r, { userId: scopedRole.id, email: scopedRole.email, role: 'super_admin', companyId: a })).token;
  const deptA = await db.department.create({ data: { name: 'A', companyId: a } });
  const deptB = await db.department.create({ data: { name: 'B', companyId: b } });
  await db.departmentRuntime.create({ data: { departmentId: deptB.id, departmentCode: 'FOREIGN', modelName: 'foreign-private-model', systemPrompt: 'private prompt', provider: 'ollama' } });
  const ea = await db.employee.create({ data: { employeeId: 'SAFE-A', name: 'Agent A', title: 'Writer', mission: 'Draft', departmentId: deptA.id, companyId: a } });
  const eb = await db.employee.create({ data: { employeeId: 'SAFE-B', name: 'Agent B', title: 'Writer', mission: 'Draft', departmentId: deptB.id, companyId: b } });
  employeeA = ea.id; employeeB = eb.id;
  const c = await db.workforceConversation.create({ data: { employeeId: ea.id, userId: userA, companyId: a, messages: JSON.stringify([{ role: 'user', content: 'private conversation' }]) } });
  convId = c.id;
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  await db?.$disconnect();
  for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${dbFile}${suffix}`, { force: true });
});

describe('bounded workflow execution', () => {
  it('enforces role, manual triggers, supported steps and input validation', async () => {
    expect((await workflow.POST(req('/api/workflows', 'POST', viewer, { name: 'x', steps: [{ type: 'log_activity' }] }))).status).toBe(403);
    expect((await workflow.POST(req('/api/workflows', 'POST', owner, { name: 'x', trigger: 'schedule', steps: [{ type: 'log_activity' }] }))).status).toBe(422);
    expect((await workflow.POST(req('/api/workflows', 'POST', owner, { name: 'x', steps: [{ type: 'post_social' }] }))).status).toBe(422);
    expect((await execute.POST(req('/api/workflows/execute', 'POST', owner, { workflowId: 'x' }))).status).toBe(400);
  });

  it('commits local steps once, replays the receipt, rejects conflicts and isolates tenants', async () => {
    const created = await workflow.POST(req('/api/workflows', 'POST', owner, { name: 'Local work', isActive: true, steps: [
      { type: 'email', config: { subject: 'Workflow draft', body: 'draft body' } },
      { type: 'log_activity', config: { description: 'Local note' } },
      { type: 'create_notification', config: { title: 'Review' } },
    ] }));
    expect(created.status).toBe(201);
    const id = (await created.json()).data.id;
    const headers = { 'Idempotency-Key': 'test-workflow-unique-01' };
    const first = await execute.POST(req('/api/workflows/execute', 'POST', owner, { workflowId: id }, headers));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.data.status).toBe('completed');
    expect(firstBody.data.steps).toHaveLength(3);
    const replay = await execute.POST(req('/api/workflows/execute', 'POST', owner, { workflowId: id }, headers));
    expect(replay.status).toBe(200);
    expect((await replay.json()).data).toMatchObject({ runId: firstBody.data.runId, status: 'completed', replayed: true });
    expect(await db.content.count({ where: { companyId: a, title: 'Workflow draft' } })).toBe(1);
    expect(await db.activity.count({ where: { companyId: a, type: 'workflow.step' } })).toBe(1);
    expect((await execute.POST(req('/api/workflows/execute', 'POST', owner, { workflowId: id, payload: 'different' }, headers))).status).toBe(409);
    expect((await execute.POST(req('/api/workflows/execute', 'POST', otherOwner, { workflowId: id }, { 'Idempotency-Key': 'different-tenant-key' }))).status).toBe(404);
    expect((await runs.GET(req('/api/workflows/runs', 'GET', otherOwner), routeContext(id))).status).toBe(404);
    expect((await runs.GET(req('/api/workflows/runs', 'GET', owner), routeContext(id))).status).toBe(200);
    expect((await workflowById.DELETE(req('/api/workflows/id', 'DELETE', owner), routeContext(id))).status).toBe(409);
    expect((await workflowById.PATCH(req('/api/workflows/id', 'PATCH', owner, { isActive: false }), routeContext(id))).status).toBe(200);
    expect((await execute.POST(req('/api/workflows/execute', 'POST', owner, { workflowId: id }, { 'Idempotency-Key': 'test-workflow-unique-02' }))).status).toBe(409);
  });

  it('rejects legacy unsupported steps and rolls back a mid-run error without partial drafts', async () => {
    const unsupported = await db.workflow.create({ data: { name: 'Legacy unsupported', trigger: 'manual', companyId: a, createdBy: userA, isActive: true, steps: JSON.stringify([{ type: 'email', config: { subject: 'Must not exist' } }, { type: 'post_social' }]) } });
    const rejected = await execute.POST(req('/api/workflows/execute', 'POST', owner, { workflowId: unsupported.id }, { 'Idempotency-Key': 'legacy-invalid-key' }));
    expect(rejected.status).toBe(422);
    expect(await db.content.count({ where: { title: 'Must not exist' } })).toBe(0);
    const rollback = await db.workflow.create({ data: { name: 'Rollback', trigger: 'manual', companyId: a, createdBy: userA, isActive: true, steps: JSON.stringify([{ type: 'email', config: { subject: 'Rollback draft' } }, { type: 'create_notification', config: { recipientId: userB } }]) } });
    const failure = await execute.POST(req('/api/workflows/execute', 'POST', owner, { workflowId: rollback.id }, { 'Idempotency-Key': 'rollback-invalid-key' }));
    expect(failure.status).toBe(500);
    expect((await failure.json()).data.status).toBe('failed');
    expect(await db.content.count({ where: { title: 'Rollback draft' } })).toBe(0);
  });
});

describe('publication, metrics and outbound safety', () => {
  it('stores planning drafts but refuses unconfirmed publication', async () => {
    const draft = await content.POST(req('/api/content', 'POST', owner, { title: 'Draft', type: 'social' }));
    expect(draft.status).toBe(201);
    const id = (await draft.json()).content.id;
    expect((await content.POST(req('/api/content', 'POST', owner, { title: 'Fake published', type: 'social', status: 'published' }))).status).toBe(422);
    expect((await contentById.PATCH(req('/api/content/id', 'PATCH', owner, { status: 'published' }), routeContext(id))).status).toBe(422);
    expect((await contentById.PATCH(req('/api/content/id', 'PATCH', owner, { publishedAt: new Date().toISOString() }), routeContext(id))).status).toBe(422);
    expect((await contentById.PATCH(req('/api/content/id', 'PATCH', otherOwner, { title: 'cross-tenant' }), routeContext(id))).status).toBe(404);
    const saved = await db.content.findUnique({ where: { id } });
    expect(saved?.status).toBe('draft');
    expect(saved?.publishedAt).toBeNull();
  });

  it('returns tenant-scoped CRM facts and unavailable provider metrics without treating legacy JSON as evidence', async () => {
    await db.lead.create({ data: { name: 'A lead', companyId: a } });
    await db.lead.create({ data: { name: 'B lead', companyId: b } });
    await db.deal.create({ data: { name: 'A CRM won', value: 500, stage: 'won', companyId: a } });
    await db.deal.create({ data: { name: 'B CRM won', value: 9000, stage: 'won', companyId: b } });
    await db.campaign.create({ data: { name: 'Legacy', type: 'social', companyId: a, metrics: JSON.stringify({ reach: 999999, conversions: 10 }) } });
    const response = await analytics.GET(req('/api/analytics?period=30d', 'GET', owner));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.overview).toMatchObject({ leadsCount: 1, wonDealValue: 500, totalReach: null, totalEngagement: null, revenue: null, roi: null });
    expect(body.provenance.crm).toContain('workspace database');
    const campaignResponse = await campaigns.GET(req('/api/campaigns', 'GET', owner));
    const campaignBody = await campaignResponse.json();
    expect(campaignBody.campaigns[0].metrics).toMatchObject({ reach: null, conversions: null });
    expect(campaignBody.summary.totalReach).toBeNull();
    expect((await analytics.GET(req('/api/analytics?period=bad', 'GET', owner))).status).toBe(400);
    expect((await dashboard.GET(req('/api/dashboard', 'GET', institutionOnly))).status).toBe(401);
  });

  it('fails closed for SMS, voice, OTP, broadcast and live email without creating or sending anything', async () => {
    const before = await db.smsMessage.count();
    const calls = [
      () => sms.POST(req('/api/sms/send', 'POST', owner, { to: '+10000000000', body: 'test' })),
      () => broadcast.POST(req('/api/sms/broadcast', 'POST', owner, { to: ['+10000000000'], body: 'test' })),
      () => otp.POST(req('/api/sms/otp', 'POST', owner, {})),
      () => verifyOtp.POST(req('/api/sms/otp/verify', 'POST', owner, { code: 'synthetic' })),
      () => voice.POST(req('/api/voip/call', 'POST', owner, { to: '+10000000000' })),
      () => email.POST(req('/api/email/send', 'POST', owner, { adapter: 'smtp', subject: 'x', html: 'y' })),
    ];
    for (const call of calls) expect((await call()).status).toBe(503);
    expect((await sms.POST(req('/api/sms/send', 'POST', viewer, {}))).status).toBe(403);
    expect(await db.smsMessage.count()).toBe(before);
    expect(fetchCalls).toBe(0);
    const savedDraft = await email.POST(req('/api/email/send', 'POST', owner, { adapter: 'stage', subject: 'Draft email', html: '<p>Hello</p>', to: 'ignored@example.test' }));
    expect(savedDraft.status).toBe(201);
    expect((await savedDraft.json()).data.status).toBe('draft');
    expect(fetchCalls).toBe(0);
  });

  it('withholds historical OTP-shaped rows and labels synthetic broadcasts unverified', async () => {
    await db.smsMessage.createMany({ data: [
      { to: 'example', body: 'synthetic-legacy-secret', status: 'sent', providerMessageId: 'otp_fake_test', companyId: a },
      { to: 'example', body: 'legacy broadcast', status: 'sent', providerMessageId: 'broadcast_fake_test', companyId: a },
      { to: 'example', body: 'ordinary legacy', status: 'queued', providerMessageId: null, companyId: a },
      { to: 'example', body: 'other tenant', status: 'queued', providerMessageId: null, companyId: b },
    ] });
    const listed = await (await smsMessages.GET(req('/api/sms/messages', 'GET', owner))).json();
    expect(JSON.stringify(listed)).not.toContain('synthetic-legacy-secret');
    expect(JSON.stringify(listed)).not.toContain('other tenant');
    expect(listed.data.find((x: any) => x.body === 'legacy broadcast').status).toBe('legacy_unverified');
    expect(listed.data.find((x: any) => x.body === 'ordinary legacy')).toBeTruthy();
    const unified = await (await inbox.GET(req('/api/social/inbox', 'GET', owner))).json();
    expect(JSON.stringify(unified)).not.toContain('synthetic-legacy-secret');
    expect(JSON.stringify(unified)).not.toContain('other tenant');
  });
});

describe('workforce and knowledge access', () => {
  it('does not grant same-rank specialist roles cross-domain privileges', () => {
    expect(hasPermission('seo_manager', 'content_manager')).toBe(false);
    expect(hasPermission('teacher', 'social_media_manager')).toBe(false);
    expect(hasPermission('manager', 'content_manager')).toBe(true);
    expect(hasPermission('viewer', 'ai_agent_manager')).toBe(false);
    expect(hasPermission('unknown', 'unknown')).toBe(false);
  });

  it('prevents tenant admins from escalating roles or changing other users global accounts', async () => {
    const auth = await import('../src/lib/auth');
    expect((await auth.verifyToken(scopedSuperRole))?.role).toBe('admin');
    expect((await users.POST(req('/api/users', 'POST', owner, { name: 'New', email: 'new@example.test', password: 'synthetic-long-password', role: 'super_admin' }))).status).toBe(403);
    expect((await userById.GET(req('/api/users/id', 'GET', owner), routeContext(userB))).status).toBe(404);
    expect((await userById.PUT(req('/api/users/id', 'PUT', owner, { password: 'synthetic-long-password' }), routeContext(userB))).status).toBe(403);
    expect((await userById.DELETE(req('/api/users/id', 'DELETE', scopedSuperRole), routeContext(userB))).status).toBe(403);
    expect((await db.user.findUnique({ where: { id: userB } }))?.isActive).toBe(true);
  });

  it('keeps client administration and readiness tenant-scoped', async () => {
    const listed = await clients.GET(req('/api/clients', 'GET', owner));
    expect(listed.status).toBe(200);
    const data = await listed.json();
    expect(data.data.map((item: any) => item.id)).toEqual([a]);
    expect((await clients.GET(req('/api/clients', 'GET', viewer))).status).toBe(403);
    expect((await clients.POST(req('/api/clients', 'POST', owner, { name: 'Overwrite', slug: 'safety-b' }))).status).toBe(403);
    expect((await clientById.PATCH(req('/api/clients/id', 'PATCH', owner, { name: 'Overwrite' }), routeContext(b))).status).toBe(404);
    expect((await db.company.findUnique({ where: { id: b } }))?.name).toBe('Safety B');
    const reportResponse = await readiness.GET(req('/api/agency/readiness', 'GET', owner));
    expect(reportResponse.status).toBe(200);
    const report = (await reportResponse.json()).data;
    expect(report.counts.clients).toBe(1);
    expect(report.counts.backups).toBeNull();
    expect(report.models.modelNames).not.toContain('foreign-private-model');
    expect((await agencyDepartments.GET(req('/api/agency/departments', 'GET', viewer))).status).toBe(403);
  });

  it('filters knowledge and SOPs by tenant and suppresses restricted records', async () => {
    await db.knowledgeNode.createMany({ data: [
      { title: 'Marketing public A', content: 'company-visible', accessLevel: 'company', companyId: a },
      { title: 'Marketing restricted A', content: 'secret-a', accessLevel: 'restricted', companyId: a },
      { title: 'Marketing other tenant', content: 'secret-b', accessLevel: 'company', companyId: b },
    ] });
    const result = await engine.retrieveKnowledge(a, 'marketing');
    expect(result.map((x) => x.content)).toContain('company-visible');
    expect(JSON.stringify(result)).not.toContain('secret-a');
    expect(JSON.stringify(result)).not.toContain('secret-b');
    const api = await (await knowledge.GET(req('/api/workforce/knowledge?query=marketing', 'GET', owner))).json();
    expect(JSON.stringify(api)).not.toContain('secret-a');
    expect(JSON.stringify(api)).not.toContain('secret-b');
    const wikiResult = await (await wiki.GET(req('/api/knowledge/wiki', 'GET', owner))).json();
    expect(JSON.stringify(wikiResult)).not.toContain('secret-a');
    expect(JSON.stringify(wikiResult)).not.toContain('secret-b');
    expect((await wiki.POST(req('/api/knowledge/wiki', 'POST', viewer, { title: 'No', content: 'No' }))).status).toBe(403);
    await db.sop.createMany({ data: [
      { name: 'SOP A', category: 'marketing', companyId: a },
      { name: 'SOP B', category: 'marketing', companyId: b },
    ] });
    const sops = await engine.findApplicableSops(a, 'marketing', 'specialist');
    expect(sops.map((item) => item.name)).toContain('SOP A');
    expect(sops.map((item) => item.name)).not.toContain('SOP B');
    const restrictedDept = await db.department.create({ data: { name: 'Restricted', companyId: a } });
    await db.sop.createMany({ data: [
      { name: 'Department confidential', category: 'marketing', companyId: a, departmentId: restrictedDept.id },
      { name: 'Role confidential', category: 'marketing', companyId: a, applicableRoles: '["manager"]' },
    ] });
    expect((await agencySops.GET(req('/api/agency/sops', 'GET', viewer))).status).toBe(403);
    expect((await agencySops.GET(req(`/api/agency/sops?departmentId=${restrictedDept.id}`, 'GET', owner))).status).toBe(403);
    const sopList = await (await agencySops.GET(req('/api/agency/sops', 'GET', owner))).json();
    expect(sopList.data.map((x: { name: string }) => x.name)).toContain('SOP A');
    expect(JSON.stringify(sopList)).not.toContain('confidential');
    expect(JSON.stringify(sopList)).not.toContain('SOP B');
  });

  it('uses approved, unexpired tenant memories only and protects employee conversations', async () => {
    await db.employeeMemory.createMany({ data: [
      { employeeId: employeeA, companyId: a, memoryType: 'semantic', title: 'approved', content: 'approved-memory', isApproved: true },
      { employeeId: employeeA, companyId: a, memoryType: 'semantic', title: 'pending', content: 'pending-memory', isApproved: false },
      { employeeId: employeeA, companyId: a, memoryType: 'semantic', title: 'expired', content: 'expired-memory', isApproved: true, expiresAt: new Date('2020-01-01') },
      { employeeId: employeeB, companyId: b, memoryType: 'semantic', title: 'foreign', content: 'foreign-memory', isApproved: true },
    ] });
    const memories = await engine.getMemories(a, 'SAFE-A');
    expect(memories.map((x) => x.content)).toEqual(['approved-memory']);
    expect(await engine.getMemories(a, 'SAFE-B')).toEqual([]);
    expect((await memory.GET(req(`/api/workforce/memory?employeeId=${employeeB}`, 'GET', owner))).status).toBe(404);
    expect((await memory.GET(req(`/api/workforce/memory?employeeId=${employeeA}`, 'GET', viewer))).status).toBe(403);
    expect((await conversation.GET(req('/api/workforce/conversations/id', 'GET', owner), routeContext(convId))).status).toBe(200);
    expect((await conversation.GET(req('/api/workforce/conversations/id', 'GET', viewer), routeContext(convId))).status).toBe(404);
    expect((await conversation.GET(req('/api/workforce/conversations/id', 'GET', otherOwner), routeContext(convId))).status).toBe(404);
    expect((await workforceChat.POST(req('/api/workforce/chat', 'POST', owner, { employeeId: 'SAFE-B', message: 'hello' }))).status).toBe(404);
    expect((await workforceChat.POST(req('/api/workforce/chat', 'POST', owner, { employeeId: 'SAFE-A', message: 'hello', conversationId: 'someone-elses' }))).status).toBe(404);
    expect((await workforceChat.POST(req('/api/workforce/chat', 'POST', viewer, { employeeId: 'SAFE-A', message: 'hello' }))).status).toBe(403);
    expect(fetchCalls).toBe(0);
  });

  it('fails closed for unimplemented persona and likeness rendering without external calls or false counts', async () => {
    const persona = await db.brandPersona.create({ data: {
      name: 'Consenting persona', companyId: a, status: 'ready', consentGranted: true,
      consentOwner: 'Owner', consentProof: 'verified-reference', usageScope: '["social"]',
    } });
    expect((await personaApi.GET(req('/personas', 'GET', viewer))).status).toBe(403);
    expect((await personaApi.POST(req('/personas', 'POST', viewer, { name: 'No access' }))).status).toBe(403);
    expect((await personaApi.POST(req('/personas', 'POST', owner, { name: 'Invalid consent', status: 'ready', consentGranted: 'false', consentOwner: 'Owner', consentProof: 'ref' }))).status).toBe(400);
    expect((await personaApi.POST(req('/personas', 'POST', otherOwner, { id: persona.id, name: 'Wrong tenant' }))).status).toBe(404);
    expect((await db.brandPersona.findUniqueOrThrow({ where: { id: persona.id } })).name).toBe('Consenting persona');
    const body = { channel: 'social', script: 'A sufficiently long draft script.' };
    expect((await personaRender.POST(req('/render', 'POST', viewer, body), routeContext(persona.id))).status).toBe(403);
    expect((await personaRender.POST(req('/render', 'POST', otherOwner, body), routeContext(persona.id))).status).toBe(404);
    expect((await personaRender.POST(req('/render', 'POST', owner, { ...body, channel: 'unapproved' }), routeContext(persona.id))).status).toBe(400);
    expect((await personaRender.POST(req('/render', 'POST', owner, body), routeContext(persona.id))).status).toBe(503);
    const after = await db.brandPersona.findUniqueOrThrow({ where: { id: persona.id } });
    expect(after.renderCount).toBe(0);
    expect(after.lastRenderedAt).toBeNull();
    const previous = process.env.LIPSYNC_ADAPTER_URL;
    process.env.LIPSYNC_ADAPTER_URL = 'https://private-adapter.invalid/secret';
    try {
      expect((await lipsync.POST(req('/lipsync', 'POST', viewer, {}))).status).toBe(403);
      expect((await lipsync.POST(req('/lipsync', 'POST', specialist, {}))).status).toBe(503);
      const capabilities = await (await lipsync.GET(req('/lipsync', 'GET', owner))).json();
      expect(capabilities.data.configured).toBe(false);
      expect(JSON.stringify(capabilities)).not.toContain('private-adapter');
      expect((await (await talkingHead.GET(req('/talking-head', 'GET', owner))).json()).data.configured.lipsyncAdapter).toBe(false);
      expect((await talkingHeadAudio.POST(req('/audio', 'POST', viewer, { text: 'hello' }))).status).toBe(403);
      expect(fetchCalls).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.LIPSYNC_ADAPTER_URL;
      else process.env.LIPSYNC_ADAPTER_URL = previous;
    }
  });

  it('labels estimated captions and does not send a transcript to AI without explicit approval', async () => {
    const result = await transcribe.POST(req('/api/ai/transcribe', 'POST', owner, { transcript: 'We agreed to review the draft. Action: check the plan.', translateTo: 'none' }));
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.data.captionTiming).toBe('estimated-from-word-count');
    expect(body.data.meetingNotesSource).toBe('deterministic-extract');
    expect((await transcribe.POST(req('/api/ai/transcribe', 'POST', owner, { transcript: 'private text', translateTo: 'Bengali' }))).status).toBe(403);
    expect((await transcribe.POST(req('/api/ai/transcribe', 'POST', specialist, { transcript: 'private text', analyzeWithAi: true }))).status).toBe(403);
    expect((await transcribe.POST(req('/api/ai/transcribe', 'POST', viewer, { transcript: 'private text' }))).status).toBe(403);
    expect(fetchCalls).toBe(0);
  });

  it('requires an interactive manager approval before paid music and restricts agent invocation', async () => {
    expect((await music.POST(req('/api/ai/generate-music', 'POST', owner, { prompt: 'instrumental', model: 'auto' }))).status).toBe(403);
    expect((await music.POST(req('/api/ai/generate-music', 'POST', specialist, { prompt: 'instrumental', model: 'auto', approveCharges: true }))).status).toBe(403);
    expect((await agentRun.POST(req('/api/ai/agents/id/run', 'POST', viewer, { task: 'run' }), routeContext('any'))).status).toBe(403);
    expect(fetchCalls).toBe(0);
  });
});
