import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/lib/db';
import { createClient, type Client } from '@libsql/client';

/**
 * Backup service.
 *
 * SQLite is backed up with `VACUUM INTO`, which writes a consistent snapshot
 * without stopping the application (a plain file copy can capture a torn write).
 * Every backup is checksummed, counted and registered in `BackupRecord`, so a
 * restore can be proven to match what was taken.
 */

export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

/** Tables that must be present and are counted in every backup. */
export const CRITICAL_TABLES = [
  'Company',
  'CompanyUser',
  'Department',
  'Employee',
  'AgentSpec',
  'DepartmentRuntime',
  'Sop',
  'Lead',
  'Deal',
  'Contact',
  'Campaign',
  'Content',
  'ClientConfig',
  'BrandVoice',
  'BrandPersona',
  'KnowledgeNode',
  'ToolDefinition',
  'AuditLog',
] as const;

export interface BackupSummary {
  id: string;
  filename: string;
  kind: string;
  sizeBytes: number;
  checksum: string;
  tableCount: number;
  rowCount: number;
  counts: Record<string, number>;
  status: string;
  verifiedAt: string | null;
  createdAt: string;
}

function sqliteFilePath(): string {
  const raw = (process.env.DATABASE_URL || 'file:./db/custom.db').trim();
  if (!raw.startsWith('file:')) {
    throw new Error('Backups are only implemented for the file-backed SQLite database used by this deployment.');
  }
  const withoutScheme = raw.slice('file:'.length).split('?')[0];
  return path.isAbsolute(withoutScheme) ? withoutScheme : path.resolve(/*turbopackIgnore: true*/ process.cwd(), withoutScheme);
}

async function sha256(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Count the snapshot itself, not a possibly-changing live database. */
async function countTables(snapshot: Client): Promise<{ counts: Record<string, number>; rowCount: number }> {
  const tables = await snapshot.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name");
  const counts: Record<string, number> = {};
  let rowCount = 0;
  for (const row of tables.rows) {
    const name = String(row.name);
    try {
      const escapedName = name.replace(/"/g, '""');
      const result = await snapshot.execute(`SELECT COUNT(*) as n FROM "${escapedName}"`);
      const value = Number(result.rows[0]?.n ?? 0);
      counts[name] = value;
      rowCount += value;
    } catch {
      counts[name] = -1;
    }
  }
  return { counts, rowCount };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

export async function createBackup(options?: {
  kind?: 'manual' | 'scheduled' | 'pre_deploy';
  createdBy?: string | null;
}): Promise<BackupSummary> {
  const kind = options?.kind ?? 'manual';
  await mkdir(BACKUP_DIR, { recursive: true });

  const filename = `marketingos_${timestamp()}_${kind}_${randomUUID()}.db`;
  const target = path.join(BACKUP_DIR, filename);

  const source = sqliteFilePath();
  // VACUUM INTO needs the destination as a SQL string literal.
  const escaped = target.replace(/'/g, "''");
  await db.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);

  const info = await stat(target);
  const checksum = await sha256(target);
  const snapshot = createClient({ url: `file:${target}` });
  let counts: Record<string, number>;
  let rowCount: number;
  try { ({ counts, rowCount } = await countTables(snapshot)); }
  finally { snapshot.close(); }

  const record = await db.backupRecord.create({
    data: {
      filename,
      kind,
      sizeBytes: Number(info.size),
      checksum,
      tableCount: Object.keys(counts).length,
      rowCount,
      counts: JSON.stringify(counts),
      status: 'completed',
      location: BACKUP_DIR,
      createdBy: options?.createdBy ?? null,
    },
  });

  // Backups are never pruned automatically. An owner-approved retention policy
  // and independently verified recovery copy are required before deletion.

  return {
    id: record.id,
    filename: record.filename,
    kind: record.kind,
    sizeBytes: record.sizeBytes,
    checksum: record.checksum,
    tableCount: record.tableCount,
    rowCount: record.rowCount,
    counts,
    status: record.status,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export interface VerifyResult {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
}

/**
 * Verifies a backup without touching production data: opens the snapshot in a
 * separate libSQL client, runs `PRAGMA integrity_check`, confirms the critical
 * tables exist, and compares row counts against the recorded manifest.
 */
export async function verifyBackup(id: string): Promise<VerifyResult> {
  const record = await db.backupRecord.findUnique({ where: { id } });
  if (!record) throw new Error('Backup not found');

  const file = path.join(/*turbopackIgnore: true*/ record.location || BACKUP_DIR, record.filename);
  const checks: VerifyResult['checks'] = [];

  const info = await stat(/*turbopackIgnore: true*/ file).catch(() => null);
  checks.push({
    name: 'file_present',
    ok: Boolean(info),
    detail: info ? `${record.filename} (${info.size} bytes)` : `${record.filename} is missing from disk`,
  });

  if (!info) {
    await db.backupRecord.update({ where: { id }, data: { status: 'failed', error: 'Snapshot file is missing', verifiedAt: new Date() } });
    return { ok: false, checks };
  }
  {
    const checksum = await sha256(file);
    checks.push({
      name: 'checksum_matches',
      ok: checksum === record.checksum,
      detail: checksum === record.checksum ? 'SHA-256 matches the recorded manifest' : `expected ${record.checksum}, got ${checksum}`,
    });
  }

  const client = createClient({ url: `file:${file}` });
  try {
    const integrity = await client.execute('PRAGMA integrity_check');
    const value = String(Object.values(integrity.rows[0] ?? {})[0] ?? 'unknown');
    checks.push({ name: 'integrity_check', ok: value === 'ok', detail: value });

    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const present = new Set(tables.rows.map((row) => String(row.name)));
    const missing = CRITICAL_TABLES.filter((table) => !present.has(table));
    checks.push({
      name: 'critical_tables',
      ok: missing.length === 0,
      detail: missing.length === 0 ? `${CRITICAL_TABLES.length} critical tables present` : `missing: ${missing.join(', ')}`,
    });

    const recorded = JSON.parse(record.counts || '{}') as Record<string, number>;
    const mismatches: string[] = [];
    for (const table of ['Company', 'Department', 'Employee', 'AgentSpec', 'Sop']) {
      if (!present.has(table) || typeof recorded[table] !== 'number') continue;
      const result = await client.execute(`SELECT COUNT(*) as n FROM "${table}"`);
      const actual = Number(result.rows[0]?.n ?? 0);
      if (actual !== recorded[table]) mismatches.push(`${table}: ${recorded[table]} -> ${actual}`);
    }
    checks.push({
      name: 'row_counts',
      ok: mismatches.length === 0,
      detail: mismatches.length === 0 ? 'Snapshot row counts match the manifest' : mismatches.join('; '),
    });
  } finally {
    client.close();
  }

  const ok = checks.every((check) => check.ok);
  await db.backupRecord.update({
    where: { id },
    data: { status: ok ? 'verified' : 'failed', verifiedAt: new Date(), error: ok ? null : checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`).join(' | ') },
  });

  return { ok, checks };
}

export async function listBackups(limit = 25): Promise<BackupSummary[]> {
  const rows = await db.backupRecord.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map((record) => ({
    id: record.id,
    filename: record.filename,
    kind: record.kind,
    sizeBytes: record.sizeBytes,
    checksum: record.checksum,
    tableCount: record.tableCount,
    rowCount: record.rowCount,
    counts: JSON.parse(record.counts || '{}'),
    status: record.status,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  }));
}

/** Reads the backup directory so orphaned files are visible too. */
export async function backupFiles(): Promise<Array<{ name: string; size: number; modified: string }>> {
  try {
    const names = (await readdir(/*turbopackIgnore: true*/ BACKUP_DIR)).filter((name) => name.endsWith('.db'));
    const files = await Promise.all(
      names.map(async (name) => {
        const info = await stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ BACKUP_DIR, name));
        return { name, size: Number(info.size), modified: info.mtime.toISOString() };
      })
    );
    return files.sort((a, b) => b.modified.localeCompare(a.modified));
  } catch {
    return [];
  }
}
