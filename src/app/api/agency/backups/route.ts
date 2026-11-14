import { NextResponse } from 'next/server';
import { getActor, isSystemAdministrator } from '@/lib/agency';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BACKUP_BASE = '/home/alamin/backups';
const BACKUP_DIRS = [
  path.join(BACKUP_BASE, 'daily'),
  path.join(BACKUP_BASE, 'weekly'),
  BACKUP_BASE,
];

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSystemAdministrator(actor))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const backups: Array<{ filename: string; directory: string; sizeBytes: number; createdAt: string; kind: string }> = [];

    for (const dir of BACKUP_DIRS) {
      const files = await readdir(dir).catch(() => []);
      for (const file of files) {
        if (!file.endsWith('.tar.gz') && !file.endsWith('.sql') && !file.endsWith('.sql.gz')) continue;
        const fullPath = path.join(dir, file);
        const s = await stat(fullPath).catch(() => null);
        if (s && s.isFile()) {
          backups.push({
            filename: file,
            directory: dir,
            sizeBytes: s.size,
            createdAt: s.mtime.toISOString(),
            kind: dir.includes('weekly') ? 'weekly' : dir.includes('daily') ? 'daily' : 'manual',
          });
        }
      }
    }

    backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      data: backups,
      meta: {
        directory: BACKUP_BASE,
        engine: 'postgresql',
        retentionNote: 'Daily backups via cron. 7-day daily / 30-day weekly retention.',
        total: backups.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/agency/backups]', error);
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSystemAdministrator(actor))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    execSync('bash /home/alamin/scripts/alo-backup.sh', { timeout: 120000 });
    return NextResponse.json({ data: { status: 'completed', message: 'Manual backup triggered' } }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/agency/backups]', error);
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
  }
}
