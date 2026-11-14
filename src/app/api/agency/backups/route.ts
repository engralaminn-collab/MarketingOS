import { NextResponse } from 'next/server';
import { getActor, isSystemAdministrator } from '@/lib/agency';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BACKUP_DIR = process.env.BACKUP_DIR || '/home/alamin/backups';

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!(await isSystemAdministrator(actor))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const files = await readdir(BACKUP_DIR).catch(() => []);
    const backups = [];
    for (const file of files) {
      const fullPath = path.join(BACKUP_DIR, file);
      const s = await stat(fullPath).catch(() => null);
      if (s) {
        backups.push({
          filename: file,
          sizeBytes: s.size,
          createdAt: s.mtime.toISOString(),
          kind: file.includes('weekly') ? 'weekly' : 'daily',
        });
      }
    }
    backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      data: backups,
      meta: {
        directory: BACKUP_DIR,
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
