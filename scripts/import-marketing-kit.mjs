#!/usr/bin/env node
// Imports the Marketing Skills kit (https://github.com/coreyhaines31/marketingskills, MIT)
// into src/data/marketing-kit/skills.json so the app can browse and run the skills.
//
// Usage:  node scripts/import-marketing-kit.mjs <path-to-marketingskills-checkout>
//
// Only SKILL.md bodies and references/*.md are kept. evals/ is test data and is skipped.

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/import-marketing-kit.mjs <marketingskills checkout>');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '..', 'src', 'data', 'marketing-kit', 'skills.json');

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  let lastKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv && !line.startsWith(' ')) {
      lastKey = kv[1];
      meta[lastKey] = kv[2].trim();
    } else if (lastKey && line.startsWith(' ')) {
      meta[lastKey] = `${meta[lastKey]} ${line.trim()}`.trim();
    }
  }
  return { meta, body: text.slice(m[0].length) };
}

async function walkMarkdown(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkMarkdown(p)));
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out.sort();
}

const skillsRoot = join(src, 'skills');
const dirs = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const skills = [];
for (const slug of dirs) {
  const skillDir = join(skillsRoot, slug);
  const mdPath = join(skillDir, 'SKILL.md');
  try {
    await stat(mdPath);
  } catch {
    continue;
  }
  const { meta, body } = parseFrontmatter(await readFile(mdPath, 'utf8'));
  const refs = [];
  const refDir = join(skillDir, 'references');
  try {
    for (const file of await walkMarkdown(refDir)) {
      refs.push({
        path: relative(skillDir, file),
        content: await readFile(file, 'utf8'),
      });
    }
  } catch {
    // no references folder
  }
  skills.push({
    slug,
    name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: meta.description || '',
    version: meta.version || meta['metadata.version'] || '',
    body: body.trim(),
    references: refs,
  });
}

const pkg = JSON.parse(await readFile(join(src, '.claude-plugin', 'marketplace.json'), 'utf8').catch(() => '{}'));

const payload = {
  source: 'https://github.com/coreyhaines31/marketingskills',
  license: 'MIT (Copyright (c) 2025 Corey Haines)',
  upstreamVersion: pkg?.metadata?.version || 'unknown',
  importedAt: new Date().toISOString(),
  skills,
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(payload));
console.log(`Wrote ${skills.length} skills (${Math.round(JSON.stringify(payload).length / 1024)} KB) -> ${relative(process.cwd(), outFile)}`);
