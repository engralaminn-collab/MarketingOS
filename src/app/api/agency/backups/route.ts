import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { hasPermission } from '@/lib/auth';
import { BACKUP_DIR, BACKUP_RETENTION, backupFiles, createBackup, listBackups } from '@/lib/backup';

/**
 * /api/agency/backups — verified SQLite snapshots.
 *
 * GET  lists every registered snapshot plus files found on disk, so an orphan
 *      left behind by a failed prune is visible instead of invisible.
 * POST takes a new snapshot (`VACUUM INTO` + SHA-256 manifest) and applies the
 *      retention policy.
 *
 * Backup metadata is deployment-wide (BackupRecord has no companyId), so both
 * verbs require an administrator. A regular member must not be able to trigger
 * disk writes or enumerate deployment internals.
 */

const KINDS = ['manual', 'scheduled', 'pre_deploy'] as const;
type BackupKind = (typeof KINDS)[number];

function isBackupKind(value: unknown): value is BackupKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [backups, files] = await Promise.all([listBackups(50), backupFiles()]);
    return NextResponse.json({
      data: backups,
      meta: {
        directory: BACKUP_DIR,
        pruneAfter: BACKUP_RETENTION,
        files,
      },
    });
  } catch (error) {
    console.error('[GET /api/agency/backups]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list backups' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Body is optional; the console sends { kind: 'manual' }.
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind === undefined ? 'manual' : body.kind;
  if (!isBackupKind(kind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${KINDS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const backup = await createBackup({ kind, createdBy: actor.userId });
    return NextResponse.json({ data: backup }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/agency/backups]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backup failed' },
      { status: 500 },
    );
  }
}
