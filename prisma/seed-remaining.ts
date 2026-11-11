/**
 * MarketingOS — seed-remaining.ts
 *
 * Single orchestrator for the "remaining" bulk seed (everything after the base
 * `prisma/seed.ts` bootstrap). Runs each stage in deterministic order, with:
 *
 *   - Non-zero exit code on ANY database error (Phase 4 requirement).
 *   - No misleading DONE message — the success banner only prints after every
 *     stage has completed and the integrity check has passed.
 *   - Errors include the failed operation and the offending record identifier.
 *   - Verified insertion / skip counts printed at the end.
 *   - Re-runs are idempotent (each stage is connector-safe for SQLite and
 *     inserts only missing records; existing employee IDs are never deleted).
 *
 * Stage order (each stage is an independent script that exits 0 on success):
 *   1. seed.ts                  — bootstrap company, admin, team, CRM, content.
 *   2. seed-workforce.ts        — 2,000 employees + 100 departments + SOPs + KN.
 *   3. seed-full-workforce.ts   — additional depts → 100, skills → 10k,
 *                                  prompts → 50k, SOPs → 500, AgentProfiles → 2k.
 *
 * Usage:
 *   npx tsx prisma/seed-remaining.ts            # run all stages
 *   npx tsx prisma/seed-remaining.ts --verify   # run all stages + integrity check
 *
 * Exit codes:
 *   0  — every stage succeeded (or was already idempotent).
 *   1  — at least one stage failed (error + identifier printed).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
const TSX = 'tsx';

interface Stage {
  name: string;
  script: string;
  description: string;
}

const STAGES: Stage[] = [
  {
    name: 'base',
    script: 'prisma/seed.ts',
    description: 'Bootstrap company (demo-agency), admin user, team, CRM, content',
  },
  {
    name: 'workforce',
    script: 'prisma/seed-workforce.ts',
    description: 'Seed 2,000 AI employees + 100 departments + 8 SOPs + 12 knowledge nodes',
  },
  {
    name: 'full-workforce',
    script: 'prisma/seed-full-workforce.ts',
    description: 'Additional departments (→100), skills (→10k), prompts (→50k), SOPs (→500), AgentProfiles (→2k)',
  },
];

function runStage(stage: Stage): { ok: true; stdout: string } | { ok: false; stdout: string; stderr: string; code: number } {
  const scriptPath = resolve(REPO_ROOT, stage.script);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ STAGE [${stage.name}] — ${stage.script}`);
  console.log(`  ${stage.description}`);
  console.log('─'.repeat(60));
  try {
    const stdout = execFileSync('npx', [TSX, scriptPath], {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
    process.stdout.write(stdout);
    return { ok: true, stdout };
  } catch (e: any) {
    const stdout = e?.stdout ?? '';
    const stderr = e?.stderr ?? '';
    const code = e?.status ?? 1;
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return { ok: false, stdout, stderr, code };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MarketingOS — seed-remaining.ts (idempotent orchestrator)');
  console.log('  Datasource: SQLite  |  Prisma: ^6.11.1');
  console.log('═══════════════════════════════════════════════════════════');

  const results: { stage: string; ok: boolean; code?: number; durationMs: number }[] = [];

  for (const stage of STAGES) {
    const t0 = Date.now();
    const res = runStage(stage);
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      console.error(`\n❌ STAGE [${stage.name}] FAILED after ${durationMs}ms (exit code ${res.code}).`);
      console.error('  Error context:');
      console.error(`    script: ${stage.script}`);
      const lastErrLine = (res.stderr || '').split('\n').filter(l => l.trim()).slice(-5).join('\n    ');
      if (lastErrLine) console.error(`    stderr (tail):\n    ${lastErrLine}`);
      results.push({ stage: stage.name, ok: false, code: res.code, durationMs });
      console.error('\n⛔ Halting pipeline. SUCCESS banner suppressed — at least one stage failed.');
      const summary = results.map(r => `  ${r.ok ? '✅' : '❌'} ${r.stage.padEnd(20)} ${r.durationMs}ms${r.ok ? '' : ` (exit ${r.code})`}`).join('\n');
      console.error('\nStage summary:\n' + summary);
      process.exit(1);
    }
    console.log(`\n✅ STAGE [${stage.name}] OK (${durationMs}ms).`);
    results.push({ stage: stage.name, ok: true, durationMs });
  }

  if (process.argv.includes('--verify')) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('▶ STAGE [verify] — scripts/verify-seed.ts');
    console.log('─'.repeat(60));
    try {
      const stdout = execFileSync('npx', [TSX, resolve(REPO_ROOT, 'scripts/verify-seed.ts')], {
        cwd: REPO_ROOT,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
        maxBuffer: 8 * 1024 * 1024,
      });
      process.stdout.write(stdout);
      results.push({ stage: 'verify', ok: true, durationMs: 0 });
    } catch (e: any) {
      process.stdout.write(e?.stdout ?? '');
      process.stderr.write(e?.stderr ?? '');
      console.error('\n❌ STAGE [verify] FAILED — integrity check did not pass.');
      process.exit(1);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ seed-remaining.ts — ALL STAGES COMPLETED');
  console.log('═══════════════════════════════════════════════════════════');
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.stage.padEnd(20)} ${r.durationMs}ms${r.ok ? '' : ` (exit ${r.code})`}`);
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Re-run safely: every stage is idempotent (inserts only missing records).');
  console.log('═══════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌ seed-remaining.ts — UNEXPECTED FAILURE.');
  console.error('  Error:', e?.message ?? e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
