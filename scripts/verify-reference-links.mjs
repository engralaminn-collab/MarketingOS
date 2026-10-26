#!/usr/bin/env node
/**
 * Verify every link in the MarketingOS reference catalogue.
 *
 * - GitHub repository and profile URLs are checked through the GitHub REST API
 *   (authenticated with GH_TOKEN when available) so we capture the real
 *   description, license, stars, archive state and last push date.
 * - Non-GitHub URLs are probed with a plain HTTP request. This sandbox only has
 *   outbound access to a small allowlist, so an unreachable host is recorded as
 *   `blocked` rather than treated as a dead link.
 *
 * - Sites outside that allowlist are additionally merged with
 *   scripts/data/external-verification.json, which records checks performed
 *   from a network that can reach them. The sandbox probe result is preserved
 *   under `sandboxProbe` so nothing is overstated.
 *
 * Output: docs/link-verification.json (machine readable, used to build
 * src/data/reference-library.ts) and a human summary on stdout.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const INPUT = 'scripts/data/reference-links.json';
const EXTERNAL = 'scripts/data/external-verification.json';
const OUTPUT = 'docs/link-verification.json';
const CONCURRENCY = 6;

const entries = JSON.parse(await readFile(INPUT, 'utf8'));

function getToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
const token = getToken();
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'MarketingOS-reference-audit',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function ghJson(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers, redirect: 'follow' });
  const remaining = res.headers.get('x-ratelimit-remaining');
  const body = res.status === 200 ? await res.json() : null;
  return { status: res.status, body, remaining };
}

function classify(url) {
  const u = new URL(url);
  if (u.hostname === 'github.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return { kind: 'github' };
    if (parts.length === 1) return { kind: 'github-user', login: parts[0] };
    return { kind: 'github-repo', owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  }
  return { kind: 'external' };
}

async function probeExternal(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 MarketingOS-link-check' },
    });
    clearTimeout(timer);
    return { status: res.ok ? 'ok' : `http-${res.status}`, httpStatus: res.status };
  } catch (error) {
    return { status: 'blocked', error: error?.name === 'AbortError' ? 'timeout' : String(error?.cause?.code || error?.message || error) };
  }
}

async function check(entry) {
  const info = classify(entry.url);
  const base = { ...entry, ...info, checkedAt: new Date().toISOString() };
  try {
    if (info.kind === 'github-repo') {
      const { status, body, remaining } = await ghJson(`/repos/${info.owner}/${info.repo}`);
      if (status === 200 && body) {
        return {
          ...base,
          status: body.archived ? 'archived' : 'ok',
          name: body.full_name,
          title: body.name,
          description: body.description || '',
          stars: body.stargazers_count,
          forks: body.forks_count,
          language: body.language,
          license: body.license?.spdx_id || 'NOASSERTION',
          licenseName: body.license?.name || null,
          topics: body.topics || [],
          homepage: body.homepage || null,
          archived: Boolean(body.archived),
          pushedAt: body.pushed_at,
          createdAt: body.created_at,
          openIssues: body.open_issues_count,
          rateRemaining: remaining,
        };
      }
      return { ...base, status: status === 404 ? 'not-found' : `http-${status}`, rateRemaining: remaining };
    }
    if (info.kind === 'github-user') {
      const { status, body } = await ghJson(`/users/${info.login}`);
      if (status === 200 && body) {
        return {
          ...base,
          status: 'ok',
          name: body.login,
          title: body.name || body.login,
          description: body.bio || '',
          stars: null,
          followers: body.followers,
          publicRepos: body.public_repos,
          avatar: body.avatar_url,
        };
      }
      return { ...base, status: status === 404 ? 'not-found' : `http-${status}` };
    }
    if (info.kind === 'github') {
      return { ...base, status: 'ok', name: entry.url };
    }
    const probe = await probeExternal(entry.url);
    return {
      ...base,
      ...probe,
      name: new URL(entry.url).hostname.replace(/^www\./, ''),
      description: '',
      stars: null,
      license: null,
    };
  } catch (error) {
    return { ...base, status: 'error', error: String(error?.message || error) };
  }
}

// Out-of-band checks for hosts the sandbox cannot reach. Only applied to URLs
// the sandbox itself could not confirm, so a stale override can never mask a
// real regression that the sandbox *did* see.
let externalChecks = { checkedAt: null, entries: [] };
try {
  externalChecks = JSON.parse(await readFile(EXTERNAL, 'utf8'));
} catch {
  console.log(`No ${EXTERNAL}; external hosts will be reported as unreachable from this sandbox.`);
}
const overrides = new Map((externalChecks.entries || []).map((e) => [e.url, e]));

function normalize(url) {
  return url.replace(/\/+$/, '');
}

const results = new Array(entries.length);
let cursor = 0;
async function worker() {
  while (cursor < entries.length) {
    const index = cursor++;
    results[index] = await check(entries[index]);
    process.stdout.write(`\rchecked ${index + 1}/${entries.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
process.stdout.write('\n');

let externalApplied = 0;
for (let i = 0; i < results.length; i += 1) {
  const result = results[i];
  const override = overrides.get(normalize(result.url)) || overrides.get(result.url);
  if (!override) continue;
  if (!['blocked', 'error'].includes(result.status)) continue;
  results[i] = {
    ...result,
    status: override.status,
    httpStatus: override.httpStatus ?? result.httpStatus ?? null,
    title: result.title || override.title || null,
    description: result.description || override.description || '',
    verifiedBy: override.method,
    verifiedAt: override.checkedAt || externalChecks.checkedAt,
    verifiedNote: override.note || null,
    // Kept for transparency: what this sandbox itself observed.
    sandboxProbe: { status: result.status, error: result.error ?? null },
  };
  externalApplied += 1;
}

const summary = results.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});
const stillUnreachable = results.filter((r) => ['blocked', 'error'].includes(r.status));
console.log(`Merged ${externalApplied} out-of-band check(s) from ${EXTERNAL}.`);
if (stillUnreachable.length > 0) {
  console.log(`Still unverified from any network (${stillUnreachable.length}):`);
  for (const r of stillUnreachable) console.log(`  - ${r.status} ${r.url}`);
}

await mkdir('docs', { recursive: true });
await writeFile(
  OUTPUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: results.length,
      authenticated: Boolean(token),
      externalVerification: {
        source: EXTERNAL,
        checkedAt: externalChecks.checkedAt ?? null,
        applied: externalApplied,
      },
      summary,
      entries: results,
    },
    null,
    2
  )
);

console.log('Summary:', summary);
console.log('Wrote', OUTPUT);
if (!token) console.log('WARNING: no GitHub token found; rate limit is low and some checks may be throttled.');
