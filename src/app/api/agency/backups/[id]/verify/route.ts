import { NextResponse } from 'next/server';
import { getActor, isSystemAdministrator } from '@/lib/agency';
import { verifyBackup } from '@/lib/backup';

/**
 * POST /api/agency/backups/[id]/verify
 *
 * Re-opens the snapshot in a separate libSQL client and proves it is usable:
 * file present, SHA-256 matches the manifest, `PRAGMA integrity_check` is ok,
 * every critical table exists, and the row counts still match. Production data
 * is never touched. The result is persisted on the BackupRecord.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSystemAdministrator(actor))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Backup id is required' }, { status: 400 });

  try {
    const result = await verifyBackup(id);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    const status = message === 'Backup not found' ? 404 : 500;
    if (status === 500) console.error('[POST /api/agency/backups/[id]/verify]', error);
    return NextResponse.json({ error: status === 404 ? 'Backup not found' : 'Backup verification failed' }, { status });
  }
}
