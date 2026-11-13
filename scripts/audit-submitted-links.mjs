#!/usr/bin/env node
/**
 * Audits a submitted link batch against the verified reference catalogue.
 *
 * Input : a plain-text file of URLs (one per line, `#` comments allowed),
 *         exactly as the operator submitted them — duplicates and typos included.
 * Joins : scripts/data/reference-links.json (the catalogue)
 *         docs/link-verification.json   (what each link actually returned)
 * Output: docs/SUBMITTED-LINKS-AUDIT.md + a console summary.
 *
 * The point is to be able to answer "did you check everything I sent?" with
 * evidence rather than a claim: every submitted line is accounted for, the
 * repairs are listed, and a link that is missing from the catalogue fails the
 * script instead of being silently dropped.
 *
 *   node scripts/audit-submitted-links.mjs [path-to-list.txt]
 */
import { readFile, writeFile } from 'node:fs/promises';

const LIST = process.argv[2] || 'scripts/data/submitted-links-2026-10-26.txt';
const CATALOGUE = 'scripts/data/reference-links.json';
const VERIFICATION = 'docs/link-verification.json';
const OUTPUT = 'docs/SUBMITTED-LINKS-AUDIT.md';

const raw = (await readFile(LIST, 'utf8')).split('\n');
const catalogue = JSON.parse(await readFile(CATALOGUE, 'utf8'));
const verification = JSON.parse(await readFile(VERIFICATION, 'utf8'));

const key = (url) => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();

/** Best-effort repair of a submitted line; returns the URL and what was fixed. */
function repair(line) {
  const fixes = [];
  let value = line.trim();
  if (!value) return null;

  // "https://https://github.com/a/b.git://github.com/c/d.git" — two URLs glued
  // together behind a doubled scheme. Keep both, repair each.
  const glued = value.match(/^https?:\/\/https?:\/\/(.*)$/i);
  if (glued) {
    fixes.push('doubled scheme');
    value = `https://${glued[1]}`;
  }
  // "ttps://host" — dropped 'h'.
  if (/^ttps:\/\//i.test(value)) {
    fixes.push("missing 'h' in scheme");
    value = `h${value}`;
  }
  // A second URL appended after the first (".git://github.com/…").
  const trailing = value.match(/^(.*?\.git):\/\/(.+)$/i);
  if (trailing) {
    fixes.push('two links in one line');
    value = trailing[1];
    return { url: value, extra: `https://${trailing[2]}`, fixes };
  }
  return { url: value, extra: null, fixes };
}

const catalogueKeys = new Map(catalogue.map((entry) => [key(entry.url), entry]));
const verificationByKey = new Map(verification.entries.map((entry) => [key(entry.url), entry]));

const seen = new Map();
const rows = [];
const repaired = [];
const missing = [];
let submitted = 0;
let duplicates = 0;

function record(url, originNote) {
  submitted += 1;
  const k = key(url);
  if (seen.has(k)) {
    duplicates += 1;
    seen.get(k).repeats += 1;
    return;
  }
  const catalogued = catalogueKeys.get(k);
  const verified = verificationByKey.get(k);
  const row = {
    url,
    repeats: 0,
    originNote,
    catalogued: Boolean(catalogued),
    category: catalogued?.category ?? null,
    module: catalogued?.module ?? null,
    status: verified?.status ?? 'not-checked',
    verification: verified ? (verified.status === 'ok' ? 'verified' : verified.status) : 'not-checked',
    verifiedBy: verified?.verifiedBy ?? (verified ? (verified.kind === 'external' ? 'sandbox-probe' : 'github-api') : null),
    title: verified?.title || catalogued?.url || null,
    stars: typeof verified?.stars === 'number' ? verified.stars : null,
    license: verified?.license ?? null,
    archived: Boolean(verified?.archived),
  };
  if (!catalogued) missing.push(url);
  seen.set(k, row);
  rows.push(row);
}

for (const line of raw) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const fixed = repair(line);
  if (!fixed) continue;
  if (fixed.fixes.length > 0 && !repaired.some((r) => r.to === fixed.url)) {
    repaired.push({ from: line.trim(), to: fixed.url, fixes: fixed.fixes });
  }
  record(fixed.url, fixed.fixes.length ? `repaired: ${fixed.fixes.join(', ')}` : '');
  if (fixed.extra && !repaired.some((r) => r.to === fixed.extra)) {
    repaired.push({ from: line.trim(), to: fixed.extra, fixes: ['second link recovered'] });
    record(fixed.extra, 'recovered from a combined line');
  }
}

const summary = rows.reduce((acc, row) => {
  acc[row.verification] = (acc[row.verification] || 0) + 1;
  return acc;
}, {});

const byStatus = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});

const externalChecks = rows.filter((row) => row.verifiedBy === 'page-fetch' || row.verifiedBy === 'host-probe').length;
const accessRequired = rows.filter((row) => row.verification === 'http-403' || row.verification === 'not-found');

const md = [];
md.push('# Submitted links — verification audit');
md.push('');
md.push(`List audited: \`${LIST}\` · generated ${new Date().toISOString()}`);
md.push('');
md.push('## What was submitted versus what is in the catalogue');
md.push('');
md.push('| Measure | Count |');
md.push('|---|---|');
md.push(`| Lines read (excluding blanks and comments) | ${submitted} |`);
md.push(`| Unique links after normalisation | ${rows.length} |`);
md.push(`| Exact duplicates collapsed | ${duplicates} |`);
md.push(`| Malformed lines repaired | ${repaired.length} |`);
md.push(`| Present in the catalogue | ${rows.length - missing.length} |`);
md.push(`| **Missing from the catalogue** | **${missing.length}** |`);
md.push(`| Verified | ${summary.verified ?? 0} |`);
md.push(`| Verified from a network outside the build sandbox | ${externalChecks} |`);
md.push(`| Access restricted (private / bot-protected) | ${accessRequired.length} |`);
md.push('');
if (repaired.length > 0) {
  md.push('## Repaired input');
  md.push('');
  md.push('| Submitted as | Treated as | Fix |');
  md.push('|---|---|---|');
  for (const item of repaired) md.push(`| \`${item.from}\` | \`${item.to}\` | ${item.fixes.join(', ')} |`);
  md.push('');
}
if (missing.length > 0) {
  md.push('## Missing from the catalogue');
  md.push('');
  for (const url of missing) md.push(`- ${url}`);
  md.push('');
}
md.push('## Every unique link');
md.push('');
md.push('| # | Link | Category | Status | Checked | How | GitHub status |');
md.push('|---|---|---|---|---|---|---|');
rows.forEach((row, index) => {
  const how = row.verifiedBy ?? '—';
  const gh = row.archived ? 'archived' : row.stars != null ? `${row.stars} stars` : row.status;
  md.push(`| ${index + 1} | ${row.url} | ${row.category ?? '—'} | ${row.verification} | ${how} | ${gh} |`);
});
md.push('');
md.push('## Reproduce');
md.push('');
md.push('```bash');
md.push(`node scripts/audit-submitted-links.mjs ${LIST}`);
md.push('```');
md.push('');

await writeFile(OUTPUT, md.join('\n'));
console.log(`Lines read: ${submitted}`);
console.log(`Unique links: ${rows.length} (${duplicates} duplicate line(s) collapsed, ${repaired.length} repaired)`);
console.log('Verification:', summary);
console.log(`Missing from catalogue: ${missing.length}`);
console.log('Wrote', OUTPUT);

if (missing.length > 0) {
  console.error('FAIL: every submitted link must exist in scripts/data/reference-links.json');
  process.exitCode = 1;
}
