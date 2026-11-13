import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/db-sync-schema.sh');

test('schema sync fails closed before applying without backup, a usable diff, or with destructive SQL', () => {
  const root = mkdtempSync(join(tmpdir(), 'marketingos-db-guard-'));
  try {
    const bin = join(root, 'bin'); mkdirSync(bin);
    const db = join(root, 'db.sqlite'); const backup = join(root, 'backup.sqlite'); const applied = join(root, 'applied');
    writeFileSync(db, 'existing'); writeFileSync(backup, 'backup');
    writeFileSync(join(bin, 'sqlite3'), '#!/bin/sh\ncase "$2" in *integrity_check*) echo ok;; *) echo 1;; esac\n', { mode: 0o755 });
    writeFileSync(join(bin, 'bunx'), '#!/bin/sh\nif [ "$1 $2" = "prisma migrate" ]; then [ "${FAKE_DIFF_FAIL:-0}" = 1 ] && exit 1; printf "%s\\n" "$FAKE_DIFF"; else echo applied >> "$APPLIED"; fi\n', { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, DATABASE_URL: `file:${db}`, BACKUP_PATH: backup, APPLIED: applied, FAKE_DIFF: 'CREATE TABLE "new_table" ("id" TEXT);' };
    const run = (extra = {}) => spawnSync('bash', [script], { cwd: process.cwd(), env: { ...env, ...extra }, encoding: 'utf8' });
    assert.notEqual(run({ BACKUP_PATH: '', ALLOW_NO_BACKUP: '1' }).status, 0);
    assert.notEqual(run({ BACKUP_PATH: db }).status, 0);
    assert.notEqual(run({ FAKE_DIFF_FAIL: '1' }).status, 0);
    assert.notEqual(run({ FAKE_DIFF: 'DROP TABLE "existing";' }).status, 0);
    assert.equal(run().status, 0);
    assert.equal(readFileSync(applied, 'utf8'), 'applied\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('proposed SetupBot SQL is additive on a disposable SQLite database and enforces keys', () => {
  const root = mkdtempSync(join(tmpdir(), 'marketingos-additive-sql-'));
  try {
    const database = join(root, 'migration.sqlite');
    const sql = join(process.cwd(), 'prisma/changes/20261029_setupbot_additive.sql');
    const python = `import sqlite3, sys\np, sql = sys.argv[1:]\nc = sqlite3.connect(p)\nc.execute('PRAGMA foreign_keys=ON')\nc.executescript("CREATE TABLE Company (id TEXT PRIMARY KEY, name TEXT); CREATE TABLE User (id TEXT PRIMARY KEY, name TEXT); INSERT INTO Company VALUES ('c','existing'); INSERT INTO User VALUES ('u','existing-user');")\nc.executescript(open(sql).read())\nassert c.execute('SELECT name FROM Company WHERE id=\\'c\\'').fetchone()[0] == 'existing'\nassert c.execute('SELECT name FROM User WHERE id=\\'u\\'').fetchone()[0] == 'existing-user'\nassert c.execute(\"SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('SetupSession','SetupImport','AuthLoginAttempt','SetupManagedResource','SetupHandoffReceipt')\").fetchone()[0] == 5\nc.execute(\"INSERT INTO SetupSession(id, companyId, userId, currentStep, encryptedData, updatedAt) VALUES ('s','c','u','start','ciphertext',CURRENT_TIMESTAMP)\")\ntry:\n c.execute(\"INSERT INTO SetupSession(id, companyId, userId, currentStep, encryptedData, updatedAt) VALUES ('s2','c','u','start','ciphertext',CURRENT_TIMESTAMP)\")\n raise AssertionError('unique key missing')\nexcept sqlite3.IntegrityError: pass\ntry:\n c.execute(\"INSERT INTO SetupImport(id, companyId, encryptedPayload, updatedAt) VALUES ('i','missing','ciphertext',CURRENT_TIMESTAMP)\")\n raise AssertionError('foreign key missing')\nexcept sqlite3.IntegrityError: pass\nassert c.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'\n`;
    execFileSync('python3', ['-c', python, database, sql], { stdio: 'pipe' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
