/**
 * Take, register and verify a backup from the command line.
 *
 *   npx tsx scripts/agency-backup.ts                 # backup + verify
 *   npx tsx scripts/agency-backup.ts --kind scheduled
 *   npx tsx scripts/agency-backup.ts --verify-latest # verify the newest snapshot
 *   npx tsx scripts/agency-backup.ts --list
 *
 * Cron example (daily at 02:15):
 *   15 2 * * * cd /app && /usr/local/bin/tsx scripts/agency-backup.ts --kind scheduled >> /var/log/marketingos-backup.log 2>&1
 *
 * This complements scripts/db-backup.sh: the shell script is what deploy uses
 * before a schema change, this one also writes a verifiable row into
 * BackupRecord so the Agency Console can prove a restore will work.
 */
import { createBackup, listBackups, verifyBackup } from '../src/lib/backup';
import { db } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    const rows = await listBackups(20);
    if (rows.length === 0) console.log('No backups registered yet.');
    for (const row of rows) {
      console.log(`${row.createdAt}  ${row.status.padEnd(9)}  ${(row.sizeBytes / 1024 / 1024).toFixed(1)} MB  ${row.rowCount} rows  ${row.filename}`);
    }
    return;
  }

  if (args.includes('--verify-latest')) {
    const [latest] = await listBackups(1);
    if (!latest) {
      console.error('No backup to verify.');
      process.exit(1);
    }
    const result = await verifyBackup(latest.id);
    for (const check of result.checks) console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name.padEnd(16)} ${check.detail}`);
    if (!result.ok) process.exit(1);
    return;
  }

  const kindArg = args[args.indexOf('--kind') + 1];
  const kind = kindArg === 'scheduled' || kindArg === 'pre_deploy' ? kindArg : 'manual';

  const created = await createBackup({ kind });
  console.log(`Backup written: ${created.filename}`);
  console.log(`  size      ${(created.sizeBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  tables    ${created.tableCount}`);
  console.log(`  rows      ${created.rowCount}`);
  console.log(`  sha256    ${created.checksum}`);

  const verified = await verifyBackup(created.id);
  for (const check of verified.checks) console.log(`  ${check.ok ? 'PASS' : 'FAIL'}  ${check.name.padEnd(16)} ${check.detail}`);
  if (!verified.ok) {
    console.error('Backup verification FAILED — treat this snapshot as unusable.');
    process.exit(1);
  }
  console.log('Backup verified and registered.');
}

main()
  .catch((error) => {
    console.error('Backup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
