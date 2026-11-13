#!/usr/bin/env node
// Route suites each initialize their own DATABASE_URL and Prisma singleton.
// Bun shares module/process state across files in a single invocation, so run
// each suite in a fresh process to prevent one suite closing another's DB.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = readdirSync('tests').filter((file) => file.endsWith('.test.ts')).sort();
for (const file of files) {
  const result = spawnSync('bun', ['test', `tests/${file}`], { stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error(`Unable to run ${file}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
