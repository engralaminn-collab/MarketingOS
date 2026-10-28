import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

const isolatedDbFile = `/tmp/marketingos-backup-test-${process.pid}-${Date.now()}.db`;
const isolatedBackupDir = `/tmp/marketingos-backup-dir-${process.pid}-${Date.now()}`;
// `bun test` loads every test file into one process, and the Prisma client is a
// module singleton bound to whichever DATABASE_URL was set first. Only claim the
// database if no other suite already did; otherwise reuse theirs and learn the
// actual file from SQLite so the backup service targets the same file.
const ownsDatabase = !process.env.DATABASE_URL;
if (ownsDatabase) process.env.DATABASE_URL = `file:${isolatedDbFile}`;
process.env.BACKUP_DIR = isolatedBackupDir;
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'ephemeral-test-jwt-secret-at-least-32-chars-long';
}

let db: typeof import('../src/lib/db').db;
let backupGet: typeof import('../src/app/api/agency/backups/route').GET;
let backupPost: typeof import('../src/app/api/agency/backups/route').POST;
let backupVerify: typeof import('../src/app/api/agency/backups/[id]/verify/route').POST;
let gradeSubmission: typeof import('../src/app/api/assignments/[id]/submissions/[submissionId]/route').PUT;
let markRead: typeof import('../src/app/api/messages/[id]/read/route').POST;

let adminToken = '';
let viewerToken = '';

function jsonRequest(url: string, method: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'user-agent': 'BackupRouteTest/1.0',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new NextRequest(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  // Idempotent (CREATE ... IF NOT EXISTS): safe whether this suite owns the
  // database or another test file already selected one.
  execFileSync('node', ['scripts/init-sqlite-schema.mjs'], {
    env: { ...process.env },
    stdio: 'pipe',
  });

  ({ db } = await import('../src/lib/db'));

  // Point the backup service at the file this client actually opened.
  const databaseList = await db.$queryRawUnsafe<Array<{ name: string; file: string }>>('PRAGMA database_list');
  const mainFile = databaseList.find((row) => row.name === 'main')?.file;
  if (mainFile && !mainFile.startsWith(':memory:')) {
    process.env.DATABASE_URL = `file:${mainFile}`;
  }
  const { createSessionToken, hashPassword } = await import('../src/lib/auth');
  ({ GET: backupGet, POST: backupPost } = await import('../src/app/api/agency/backups/route'));
  ({ POST: backupVerify } = await import('../src/app/api/agency/backups/[id]/verify/route'));
  ({ PUT: gradeSubmission } = await import('../src/app/api/assignments/[id]/submissions/[submissionId]/route'));
  ({ POST: markRead } = await import('../src/app/api/messages/[id]/read/route'));

  const suffix = `bk_${Date.now()}`;
  const hashed = await hashPassword('BackupRouteTest!2026#Safe');

  const company = await db.company.create({
    data: { name: `Backup Test ${suffix}`, slug: `backup-${suffix}`, isActive: true },
  });
  const admin = await db.user.create({
    data: { email: `admin-${suffix}@test.local`, name: 'Backup Admin', passwordHash: hashed, role: 'admin', isActive: true },
  });
  const viewer = await db.user.create({
    data: { email: `viewer-${suffix}@test.local`, name: 'Backup Viewer', passwordHash: hashed, role: 'viewer', isActive: true },
  });
  await db.companyUser.createMany({
    data: [
      { userId: admin.id, companyId: company.id, role: 'admin' },
      { userId: viewer.id, companyId: company.id, role: 'viewer' },
    ],
  });

  const req = new Request('http://127.0.0.1:3000/api/auth/login', {
    headers: { 'user-agent': 'BackupRouteTest/1.0' },
  });
  adminToken = (
    await createSessionToken(req, { userId: admin.id, email: admin.email, role: 'admin', companyId: company.id })
  ).token;
  viewerToken = (
    await createSessionToken(req, { userId: viewer.id, email: viewer.email, role: 'viewer', companyId: company.id })
  ).token;
});

afterAll(async () => {
  try {
    await db?.$disconnect();
  } catch {
    // ignore
  }
  if (ownsDatabase) {
    for (const ext of ['', '-wal', '-shm', '-journal']) {
      fs.rmSync(`${isolatedDbFile}${ext}`, { force: true });
    }
  }
  fs.rmSync(isolatedBackupDir, { recursive: true, force: true });
});

describe('/api/agency/backups', () => {
  it('requires an authenticated administrator', async () => {
    const unauth = await backupGet(jsonRequest('http://localhost/api/agency/backups', 'GET'));
    expect(unauth.status).toBe(401);

    const forbidden = await backupGet(jsonRequest('http://localhost/api/agency/backups', 'GET', viewerToken));
    expect(forbidden.status).toBe(403);

    const forbiddenCreate = await backupPost(
      jsonRequest('http://localhost/api/agency/backups', 'POST', viewerToken, { kind: 'manual' }),
    );
    expect(forbiddenCreate.status).toBe(403);
  });

  it('rejects an unknown backup kind', async () => {
    const res = await backupPost(
      jsonRequest('http://localhost/api/agency/backups', 'POST', adminToken, { kind: 'not-a-kind' }),
    );
    expect(res.status).toBe(400);
  });

  it('creates, lists and verifies a real snapshot', async () => {
    const created = await backupPost(
      jsonRequest('http://localhost/api/agency/backups', 'POST', adminToken, { kind: 'manual' }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { data: { id: string; checksum: string; tableCount: number } };
    expect(createdBody.data.checksum).toHaveLength(64);
    expect(createdBody.data.tableCount).toBeGreaterThan(10);

    const listed = await backupGet(jsonRequest('http://localhost/api/agency/backups', 'GET', adminToken));
    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as { data: Array<{ id: string }>; meta: { directory: string } };
    expect(listedBody.data.some((row) => row.id === createdBody.data.id)).toBe(true);
    expect(listedBody.meta.directory).toBe(isolatedBackupDir);

    const verified = await backupVerify(
      jsonRequest(`http://localhost/api/agency/backups/${createdBody.data.id}/verify`, 'POST', adminToken),
      { params: Promise.resolve({ id: createdBody.data.id }) },
    );
    expect(verified.status).toBe(200);
    const verifiedBody = (await verified.json()) as { data: { ok: boolean; checks: Array<{ name: string }> } };
    expect(verifiedBody.data.ok).toBe(true);
    expect(verifiedBody.data.checks.map((check) => check.name)).toContain('checksum_matches');
  });

  it('returns 404 when verifying an unknown backup', async () => {
    const res = await backupVerify(
      jsonRequest('http://localhost/api/agency/backups/does-not-exist/verify', 'POST', adminToken),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/assignments/[id]/submissions/[submissionId]', () => {
  it('rejects an unauthenticated request and an unknown assignment', async () => {
    const unauth = await gradeSubmission(
      jsonRequest('http://localhost/api/assignments/a/submissions/b', 'PUT', undefined, { marks: 1 }),
      { params: Promise.resolve({ id: 'a', submissionId: 'b' }) },
    );
    expect(unauth.status).toBe(401);

    const missing = await gradeSubmission(
      jsonRequest('http://localhost/api/assignments/missing/submissions/missing', 'PUT', adminToken, { marks: 1 }),
      { params: Promise.resolve({ id: 'missing', submissionId: 'missing' }) },
    );
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/messages/[id]/read', () => {
  it('rejects unauthenticated requests and self-threads', async () => {
    const unauth = await markRead(
      jsonRequest('http://localhost/api/messages/someone/read', 'POST'),
      { params: Promise.resolve({ id: 'someone' }) },
    );
    expect(unauth.status).toBe(401);
  });
});
