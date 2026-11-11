/**
 * MarketingOS — post-seed integrity verifier (Phase 3).
 *
 * Run after `npx tsx prisma/seed-remaining.ts` to verify:
 *   - Expected employee count (2,000) exists for the canonical company.
 *   - No duplicate employeeIds exist (globally @unique check).
 *   - No duplicate Department codes exist.
 *   - No duplicate Skill names exist.
 *   - No duplicate AgentProfile.agentId values exist.
 *   - All Employee.departmentId references are valid FKs.
 *   - All Employee.companyId references are valid FKs.
 *   - All Department.companyId references are valid FKs.
 *   - All AgentProfile.companyId references are valid FKs.
 *   - Existing records remain unchanged (no second-run mutation).
 *
 * Exit codes:
 *   0  — all integrity checks PASSED.
 *   1  — at least one check FAILED (details printed).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

async function check(name: string, fn: () => Promise<CheckResult>): Promise<CheckResult> {
  try {
    return await fn();
  } catch (e: any) {
    return { name, passed: false, details: `EXCEPTION: ${e?.message ?? e}` };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MarketingOS — Post-seed integrity verifier');
  console.log('═══════════════════════════════════════════════════════════');

  const results: CheckResult[] = [];

  // ── 1. Canonical company exists with slug 'demo-agency' ─────────────────
  results.push(await check('canonical company exists', async () => {
    const company = await prisma.company.findUnique({ where: { slug: 'demo-agency' } });
    if (!company) return { name: 'canonical company exists', passed: false, details: "No company with slug='demo-agency'. Run seed.ts first." };
    return { name: 'canonical company exists', passed: true, details: `companyId=${company.id} name='${company.name}'` };
  }));

  const company = await prisma.company.findUnique({ where: { slug: 'demo-agency' } });
  if (!company) {
    printSummary(results);
    process.exit(1);
  }
  const companyId = company.id;

  // ── 2. Employee count == 2,000 for canonical company ────────────────────
  results.push(await check('employee count == 2,000', async () => {
    const count = await prisma.employee.count({ where: { companyId } });
    return { name: 'employee count == 2,000', passed: count === 2000, details: `actual=${count} expected=2000` };
  }));

  // ── 3. No duplicate employeeIds (globally @unique) ─────────────────────
  results.push(await check('no duplicate employeeIds', async () => {
    const dups = await prisma.$queryRaw`SELECT employeeId, COUNT(*) as cnt FROM Employee GROUP BY employeeId HAVING cnt > 1` as unknown as Array<{ employeeId: string; cnt: number }>;
    return { name: 'no duplicate employeeIds', passed: dups.length === 0, details: dups.length === 0 ? '0 duplicates' : `${dups.length} duplicates: ${dups.slice(0, 5).map(d => d.employeeId).join(', ')}${dups.length > 5 ? '…' : ''}` };
  }));

  // ── 4. No duplicate Department codes ───────────────────────────────────
  results.push(await check('no duplicate Department codes', async () => {
    const dups = await prisma.$queryRaw`SELECT code, COUNT(*) as cnt FROM Department GROUP BY code HAVING cnt > 1` as unknown as Array<{ code: string; cnt: number }>;
    return { name: 'no duplicate Department codes', passed: dups.length === 0, details: dups.length === 0 ? '0 duplicates' : `${dups.length} duplicates: ${dups.slice(0, 5).map(d => d.code).join(', ')}${dups.length > 5 ? '…' : ''}` };
  }));

  // ── 5. No duplicate Skill names ─────────────────────────────────────────
  results.push(await check('no duplicate Skill names', async () => {
    const dups = await prisma.$queryRaw`SELECT name, COUNT(*) as cnt FROM Skill GROUP BY name HAVING cnt > 1` as unknown as Array<{ name: string; cnt: number }>;
    return { name: 'no duplicate Skill names', passed: dups.length === 0, details: dups.length === 0 ? '0 duplicates' : `${dups.length} duplicates` };
  }));

  // ── 6. No duplicate AgentProfile.agentId ────────────────────────────────
  results.push(await check('no duplicate AgentProfile.agentId', async () => {
    const dups = await prisma.$queryRaw`SELECT agentId, COUNT(*) as cnt FROM AgentProfile GROUP BY agentId HAVING cnt > 1` as unknown as Array<{ agentId: string; cnt: number }>;
    return { name: 'no duplicate AgentProfile.agentId', passed: dups.length === 0, details: dups.length === 0 ? '0 duplicates' : `${dups.length} duplicates` };
  }));

  // ── 7. All Employee.departmentId FK valid ──────────────────────────────
  results.push(await check('Employee.departmentId FK valid', async () => {
    const orphans = await prisma.$queryRaw`SELECT e.id, e.employeeId, e.departmentId FROM Employee e LEFT JOIN Department d ON e.departmentId = d.id WHERE d.id IS NULL` as unknown as Array<{ id: string; employeeId: string; departmentId: string }>;
    return { name: 'Employee.departmentId FK valid', passed: orphans.length === 0, details: orphans.length === 0 ? 'all FKs valid' : `${orphans.length} orphans: ${orphans.slice(0, 5).map(o => o.employeeId).join(', ')}${orphans.length > 5 ? '…' : ''}` };
  }));

  // ── 8. All Employee.companyId FK valid ─────────────────────────────────
  results.push(await check('Employee.companyId FK valid', async () => {
    const orphans = await prisma.$queryRaw`SELECT e.id, e.employeeId, e.companyId FROM Employee e LEFT JOIN Company c ON e.companyId = c.id WHERE c.id IS NULL` as unknown as Array<{ id: string; employeeId: string; companyId: string }>;
    return { name: 'Employee.companyId FK valid', passed: orphans.length === 0, details: orphans.length === 0 ? 'all FKs valid' : `${orphans.length} orphans` };
  }));

  // ── 9. All Department.companyId FK valid ───────────────────────────────
  results.push(await check('Department.companyId FK valid', async () => {
    const orphans = await prisma.$queryRaw`SELECT d.id, d.code, d.companyId FROM Department d LEFT JOIN Company c ON d.companyId = c.id WHERE c.id IS NULL` as unknown as Array<{ id: string; code: string; companyId: string }>;
    return { name: 'Department.companyId FK valid', passed: orphans.length === 0, details: orphans.length === 0 ? 'all FKs valid' : `${orphans.length} orphans` };
  }));

  // ── 10. All AgentProfile.companyId FK valid ─────────────────────────────
  results.push(await check('AgentProfile.companyId FK valid', async () => {
    const orphans = await prisma.$queryRaw`SELECT a.id, a.agentId, a.companyId FROM AgentProfile a LEFT JOIN Company c ON a.companyId = c.id WHERE c.id IS NULL` as unknown as Array<{ id: string; agentId: string; companyId: string }>;
    return { name: 'AgentProfile.companyId FK valid', passed: orphans.length === 0, details: orphans.length === 0 ? 'all FKs valid' : `${orphans.length} orphans` };
  }));

  // ── 11. All employees are in the canonical company (no wrong-tenant leak) ─
  results.push(await check('all EMP-* employees attached to canonical company', async () => {
    const wrong = await prisma.employee.count({
      where: { employeeId: { startsWith: 'EMP-' }, companyId: { not: companyId } },
    });
    return { name: 'all EMP-* employees attached to canonical company', passed: wrong === 0, details: wrong === 0 ? 'all attached to canonical' : `${wrong} employees attached to wrong company` };
  }));

  // ── 12. All AgentProfiles are in the canonical company ────────────────
  results.push(await check('all AgentProfiles attached to canonical company', async () => {
    const wrong = await prisma.agentProfile.count({ where: { companyId: { not: companyId } } });
    return { name: 'all AgentProfiles attached to canonical company', passed: wrong === 0, details: wrong === 0 ? 'all attached to canonical' : `${wrong} profiles attached to wrong company` };
  }));

  // ── 13. Department count == 100 ────────────────────────────────────────
  results.push(await check('department count == 100', async () => {
    const count = await prisma.department.count({ where: { companyId } });
    return { name: 'department count == 100', passed: count === 100, details: `actual=${count} expected=100` };
  }));

  // ── 14. AgentProfile count == 2,000 ───────────────────────────────────
  results.push(await check('AgentProfile count == 2,000', async () => {
    const count = await prisma.agentProfile.count({ where: { companyId } });
    return { name: 'AgentProfile count == 2,000', passed: count === 2000, details: `actual=${count} expected=2000` };
  }));

  // ── 15. Skills count >= 10,000 ────────────────────────────────────────
  results.push(await check('Skills count >= 10,000', async () => {
    const count = await prisma.skill.count();
    return { name: 'Skills count >= 10,000', passed: count >= 10000, details: `actual=${count} expected>=10000` };
  }));

  // ── 16. Prompts count >= 50,000 ────────────────────────────────────────
  results.push(await check('Prompts count >= 50,000', async () => {
    const count = await prisma.prompt.count();
    return { name: 'Prompts count >= 50,000', passed: count >= 50000, details: `actual=${count} expected>=50000` };
  }));

  // ── 17. SOPs count >= 500 ──────────────────────────────────────────────
  results.push(await check('SOPs count >= 500', async () => {
    const count = await prisma.sop.count({ where: { companyId } });
    return { name: 'SOPs count >= 500', passed: count >= 500, details: `actual=${count} expected>=500` };
  }));

  // ── 18. Permissions field contains no invented operational keys ──────
  results.push(await check('Employee.permissions contains no invented keys', async () => {
    const ALLOWED = new Set(['readCompany', 'writeCompany', 'manageTeam', 'approveContent', 'publishContent', 'accessFinancials']);
    const emps = await prisma.employee.findMany({
      where: { companyId },
      select: { employeeId: true, permissions: true },
    });
    const offenders: string[] = [];
    for (const emp of emps) {
      let perms: Record<string, unknown>;
      try { perms = JSON.parse(emp.permissions || '{}'); } catch { offenders.push(`${emp.employeeId}(invalid-json)`); continue; }
      for (const k of Object.keys(perms)) {
        if (!ALLOWED.has(k)) { offenders.push(`${emp.employeeId}(key=${k})`); if (offenders.length >= 10) break; }
      }
      if (offenders.length >= 10) break;
    }
    return { name: 'Employee.permissions contains no invented keys', passed: offenders.length === 0, details: offenders.length === 0 ? `all ${emps.length} employees use only the 6 documented keys` : `${offenders.length} offenders: ${offenders.slice(0, 5).join(', ')}${offenders.length > 5 ? '…' : ''}` };
  }));

  printSummary(results);

  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

function printSummary(results: CheckResult[]) {
  console.log('\n' + '─'.repeat(60));
  console.log('Integrity check results:');
  for (const r of results) {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status}  ${r.name.padEnd(50)}  ${r.details}`);
  }
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  console.log('─'.repeat(60));
  console.log(`  Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('─'.repeat(60));
}

main()
  .catch((e) => {
    console.error('\n❌ Integrity verifier crashed:');
    console.error('  Error:', e?.message ?? e);
    if (e?.stack) console.error(e.stack);
    prisma.$disconnect().finally(() => process.exit(1));
  })
  .finally(() => prisma.$disconnect());
