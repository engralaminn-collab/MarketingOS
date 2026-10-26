#!/usr/bin/env node
/**
 * Builds src/data/reference-library.ts from the verified link audit.
 *
 * Input : docs/link-verification.json (produced by verify-reference-links.mjs)
 * Output: src/data/reference-library.ts
 *
 * Status rules
 *  - `adopted`      : the pattern is implemented natively in this repository and
 *                     `evidence` points at the code that implements it.
 *  - `blueprint`    : assessed as useful, deliberately not built yet.
 *  - `evaluated`    : reviewed, not a fit for this product/runtime.
 *  - `license-review`: licence or asset terms need review before reuse.
 *  - `unavailable`  : the link could not be verified (private or access denied).
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const verification = JSON.parse(await readFile('docs/link-verification.json', 'utf8'));

const ADOPTED = {
  'every-app/open-seo': {
    evidence: 'src/app/api/seo/crawl/route.ts',
    detail: 'Live crawler, topic clustering and on-page audit scoring.',
  },
  'firecrawl/firecrawl': {
    evidence: 'src/lib/firecrawl-scraper.ts',
    detail: 'Optional self-hosted Firecrawl adapter with size and timeout limits.',
  },
  'coreyhaines31/marketingskills': {
    evidence: 'src/lib/marketing-studio.ts',
    detail: '52-skill marketing kit catalogue plus diagram and CTA generators.',
  },
  'cathrynlavery/diagram-design': {
    evidence: 'src/app/api/ai/diagram/route.ts',
    detail: '14 diagram grammars rendered as Mermaid from structured input.',
  },
  'NdoleStudio/httpsms': {
    evidence: 'src/app/api/sms/send/route.ts',
    detail: 'HTTP SMS gateway delivery path with per-message failure records.',
  },
  'domovinatv/sms.domovina.ai': {
    evidence: 'src/app/api/sms/send/route.ts',
    detail: 'Self-hosted handset gateway pattern for low-cost SMS.',
  },
  'nashsu/llm_wiki': {
    evidence: 'src/app/api/knowledge/wiki/route.ts',
    detail: 'Incremental wiki nodes with summaries and [[WikiLinks]].',
  },
  'Lin-jun-xiang/docGPT-langchain': {
    evidence: 'src/app/api/knowledge/wiki/route.ts',
    detail: 'Document-grounded answers returning citations.',
  },
  'volcengine/OpenViking': {
    evidence: 'src/app/api/knowledge/wiki/route.ts',
    detail: 'Context retrieval service pattern for agent knowledge.',
  },
  'guifav/market-intelligence-radar': {
    evidence: 'src/components/studio/radar-icp-panel.tsx',
    detail: 'ICP scoring and market radar over competitor and feed signals.',
  },
  'parthasarathy123/n8n-gtm-lead-enrichment': {
    evidence: 'src/components/studio/lead-enrichment-panel.tsx',
    detail: 'Domain-based lead enrichment with confidence and source rows.',
  },
  'brightdata/open-enrich': {
    evidence: 'src/lib/enrichment.ts',
    detail: 'Provider-agnostic enrichment contract with SSRF guards.',
  },
  'frappe/crm': {
    evidence: 'src/components/views/crm-view.tsx',
    detail: 'Drag-and-drop deal pipeline with inline lead status changes.',
  },
  'languagetool-org/languagetool': {
    evidence: 'src/app/api/ai/grammar-check/route.ts',
    detail: 'Grammar and style findings API; local model by default.',
  },
  'blader/humanizer': {
    evidence: 'src/app/api/ai/humanize/route.ts',
    detail: 'De-robotise copy pass with banned-phrase detection.',
  },
  'WEIFENG2333/VideoCaptioner': {
    evidence: 'src/components/studio/video-captioner-panel.tsx',
    detail: 'Transcription plus SRT/VTT export and translation.',
  },
  'DIYgod/RSSHub': {
    evidence: 'src/components/views/feeds-view.tsx',
    detail: 'Feed source registry, refresh and item ingestion.',
  },
  'akitaonrails/ai-memory': {
    evidence: 'src/app/api/ai/memory/route.ts',
    detail: 'Scoped memory records that agents read before answering.',
  },
};

const BLUEPRINT = new Set([
  'cometchat/cometchat-uikit-react',
  'cometchat/cometchat-uikit-react-native',
  'microsoft/call-center-ai',
  'rasonyang/ai-native-callcenter',
  'amulchapla/AI-Powered-Call-Center-Intelligence',
  'video-db/call.md',
  'CALLE-AI/awesome-phone-call-agents',
  'twentyhq/twenty',
  'ArnasDon/wacrm',
  'chatwoot/chatwoot',
  'ToolJet/ToolJet',
  'remotion-dev/remotion',
  'harry0703/MoneyPrinterTurbo',
  'HEYGEN_PLACEHOLDER',
  'heygen-com/hyperframes',
  'MeiGen-AI/InfiniteTalk',
  'GAIR-NLP/LiveTalk',
  'OpenTalker/video-retalking',
  'google-research/timesfm',
  'arupdas0825/studytra',
  'Bhawana0218/NextStep-Abroad',
  'google-research/timesfm',
  'ruvnet/ruflo',
  'mksglu/context-mode',
  'Artistsyn/cortex_suite',
  'sulabhdubey/rta-smriti-brain',
  'EfficientStreet/hindsight',
  'clawnify/OpenProspector',
  'ioi-labs/molx',
  'firecrawl/web-agent',
  'umami-software/umami',
  'TryGhost/Ghost',
  'nextcloud/server',
  'dani-garcia/vaultwarden',
  'huggingface/education-toolkit',
  'THU-MAIC/OpenMAIC',
  'FoundationAgents/MetaGPT',
  'unorouter/unorouter',
  'getgoapi/Free-GPT-Grok-Gemini-Claude-API',
  'zai-org/GLM-5',
  'timharris707/modeldeck',
  'templetongroup/radiant',
  'sibnerian/electron-promise-ipc',
  'monkscode/Natural-Language-to-Robot-Framework',
  'iamakshayshar/AITestCaseGenerator',
  'cometchat/docs-mcp',
  'k-dense-ai/scientific-agent-skills',
  'affaan-m/ECC',
  'cursor/plugins',
  'anthropics/claude-plugins-community',
  'capsoftware/Cap',
  'onyx-dev-labs/doodle-note',
  'bilawalsidhu/gods-eye-view',
  'tt-a1i/archify',
  'wtz2017/videomaker',
  '0perationPrivacy/VoIP',
  'jitsi/jitsi-videobridge',
  'debpalash/VoiceStudio',
]);

const CATEGORY_ORDER = [
  'Marketing, SEO & Growth',
  'CRM & Sales',
  'Conversational AI & Chat',
  'Voice, Telephony & Contact Center',
  'Content, Video & Media',
  'AI Models, Agents & Skills',
  'Knowledge, Docs & Data',
  'Automation, ERP & Business Ops',
  'Education & Study Abroad',
  'Developer Tooling & Infrastructure',
  'Websites & Platforms',
  'Community & Credits',
];

const MODULE_ORDER = [
  'Ecosystem',
  'Marketing Studio',
  'SEO & Live Crawler',
  'Market Intelligence',
  'CRM',
  'Content & Queue',
  'News Feeds',
  'Analytics & UTM',
  'SMS, VoIP & Scraper',
  'Media Studio',
  'AI Command',
  'Free AI Agent Hub',
  'Knowledge Wiki & RAG',
  'Messages',
  'Workflow Studio',
  'Integrations',
  'Study Abroad & UKVI',
  'Students',
  'Exams & Results',
  'Finance',
  'Settings',
];

function prettify(value) {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bCrm\b/g, 'CRM')
    .replace(/\bSeo\b/g, 'SEO')
    .replace(/\bSms\b/g, 'SMS')
    .replace(/\bVoip\b/g, 'VoIP')
    .replace(/\bWebrtc\b/g, 'WebRTC')
    .replace(/\bUi\b/g, 'UI')
    .replace(/\bUx\b/g, 'UX')
    .replace(/\bTts\b/g, 'TTS')
    .replace(/\bLlm\b/g, 'LLM')
    .replace(/\bRag\b/g, 'RAG')
    .replace(/\bVideo\b/g, 'Video');
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function verificationLabel(status, kind) {
  if (status === 'ok') return 'verified';
  if (status === 'archived') return 'verified-archived';
  if (status === 'http-403') return 'access-required';
  if (status === 'blocked') return 'external';
  return 'unverified';
}

function resolveStatus(entry, fullName) {
  if (entry.status === 'http-403') return 'unavailable';
  if (entry.status === 'blocked') return 'external-reference';
  if (ADOPTED[fullName]) return 'adopted';
  if (BLUEPRINT.has(fullName) || BLUEPRINT.has(fullName?.toLowerCase())) return 'blueprint';
  const license = (entry.license || '').toUpperCase();
  if (['GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0'].includes(license)) return 'license-review';
  return 'evaluated';
}

// ── Integrity checks ────────────────────────────────────────────────────────
// The catalogue is not allowed to contain invented rows: every URL must be a
// well-formed link from the request, statuses must be known, and an `adopted`
// claim must point at a file that actually exists in this repository.
const VALID_STATUS = new Set([
  'adopted',
  'blueprint',
  'evaluated',
  'license-review',
  'unavailable',
  'external-reference',
]);
const seenUrls = new Set();
const problems = [];
for (const entry of verification.entries) {
  if (!/^https?:\/\//.test(entry.url)) problems.push(`malformed URL: ${entry.url}`);
  if (seenUrls.has(entry.url)) problems.push(`duplicate URL: ${entry.url}`);
  seenUrls.add(entry.url);
}
for (const [fullName, record] of Object.entries(ADOPTED)) {
  try {
    await access(record.evidence, constants.R_OK);
  } catch {
    problems.push(`adopted evidence missing for ${fullName}: ${record.evidence}`);
  }
}
if (problems.length > 0) {
  console.error('Reference library integrity check failed:');
  for (const problem of problems) console.error('  -', problem);
  process.exitCode = 1;
  throw new Error('Fix the catalogue before regenerating.');
}

const entries = verification.entries.map((entry, index) => {
  const isRepo = entry.kind === 'github-repo';
  const isProfile = entry.kind === 'github-user';
  const fullName = isRepo ? `${entry.owner}/${entry.repo}` : null;
  const title = isRepo
    ? prettify(entry.repo)
    : isProfile
      ? entry.title || entry.login
      : prettify(entry.name || new URL(entry.url).hostname.replace(/^www\./, ''));
  const adopted = fullName ? ADOPTED[fullName] : null;
  const canonical = isRepo && entry.name && fullName && entry.name.toLowerCase() !== fullName.toLowerCase()
    ? `https://github.com/${entry.name}`
    : null;
  const status = resolveStatus(entry, fullName);
  const description =
    (entry.description && entry.description.trim()) ||
    (isProfile
      ? `${entry.note}. GitHub profile.`
      : isRepo
        ? `${entry.note}. No public description was returned by the GitHub API.`
        : entry.note);
  return {
    id: `${slug(title)}-${index}`,
    title,
    fullName: fullName || entry.login || new URL(entry.url).hostname.replace(/^www\./, ''),
    owner: isRepo ? entry.owner : isProfile ? 'GitHub community' : new URL(entry.url).hostname.replace(/^www\./, ''),
    url: entry.url,
    /** Set when GitHub redirected the request: the upstream repository was renamed. */
    canonicalUrl: canonical,
    movedTo: canonical ? entry.name : null,
    category: entry.category,
    module: entry.module,
    note: entry.note,
    description,
    status,
    evidence: adopted?.evidence ?? null,
    evidenceDetail: adopted?.detail ?? null,
    stars: typeof entry.stars === 'number' ? entry.stars : null,
    forks: typeof entry.forks === 'number' ? entry.forks : null,
    followers: typeof entry.followers === 'number' ? entry.followers : null,
    language: entry.language ?? null,
    license: entry.license ?? null,
    topics: Array.isArray(entry.topics) ? entry.topics.slice(0, 6) : [],
    archived: Boolean(entry.archived),
    pushedAt: entry.pushedAt ?? null,
    verification: verificationLabel(entry.status, entry.kind),
    httpStatus: typeof entry.httpStatus === 'number' ? entry.httpStatus : null,
    origin: isRepo ? 'repository' : isProfile ? 'profile' : 'website',
    checkedAt: entry.checkedAt,
  };
});

// Stable ordering: category order, then stars desc, then title.
entries.sort((a, b) => {
  const ca = CATEGORY_ORDER.indexOf(a.category);
  const cb = CATEGORY_ORDER.indexOf(b.category);
  if (ca !== cb) return ca - cb;
  const sa = a.stars ?? -1;
  const sb = b.stars ?? -1;
  if (sa !== sb) return sb - sa;
  return a.title.localeCompare(b.title);
});

for (const entry of entries) {
  if (!VALID_STATUS.has(entry.status)) problems.push(`unknown status ${entry.status} on ${entry.url}`);
}
if (entries.length !== verification.entries.length) {
  throw new Error('Entry count drifted from the verified source');
}

const categoryCounts = {};
const moduleCounts = {};
const statusCounts = {};
const verificationCounts = {};
let totalStars = 0;
for (const entry of entries) {
  categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  moduleCounts[entry.module] = (moduleCounts[entry.module] || 0) + 1;
  statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
  verificationCounts[entry.verification] = (verificationCounts[entry.verification] || 0) + 1;
  if (entry.stars) totalStars += entry.stars;
}

const REFERENCE_STATUS_LABELS = {
  adopted: 'Adopted',
  blueprint: 'Blueprint',
  evaluated: 'Evaluated',
  'license-review': 'Licence review',
  unavailable: 'Access required',
  'external-reference': 'External site',
};

const REFERENCE_VERIFICATION_LABELS = {
  verified: 'Verified',
  'verified-archived': 'Verified · archived',
  'access-required': 'Access required',
  external: 'Not fetched here',
  unverified: 'Unverified',
};

const asStringArray = (values) => values.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(', ');

const file = `/**
 * MarketingOS open-source reference library.
 *
 * GENERATED FILE — do not edit by hand.
 *   source of truth : scripts/data/reference-links.json
 *   verification    : scripts/verify-reference-links.mjs -> docs/link-verification.json
 *   generator       : scripts/build-reference-library.mjs
 *   last verified   : ${verification.generatedAt}
 *
 * Every entry is a real, checked link. Status is about *this* repository:
 * - adopted          pattern implemented natively (evidence = code path)
 * - blueprint        assessed, deliberately deferred
 * - evaluated        reviewed, not a fit, or reference-only
 * - license-review   copyleft/asset terms need review before reuse
 * - unavailable      link exists in the request but could not be verified
 * - external-reference website outside the build sandbox allowlist
 */

export type ReferenceStatus =
  | 'adopted'
  | 'blueprint'
  | 'evaluated'
  | 'license-review'
  | 'unavailable'
  | 'external-reference';

export type ReferenceOrigin = 'repository' | 'profile' | 'website';

export type ReferenceVerification =
  | 'verified'
  | 'verified-archived'
  | 'access-required'
  | 'external'
  | 'unverified';

export interface ReferenceEntry {
  id: string;
  title: string;
  fullName: string;
  owner: string;
  url: string;
  /** Canonical URL when the upstream repository was renamed (GitHub redirect). */
  canonicalUrl: string | null;
  movedTo: string | null;
  category: string;
  module: string;
  note: string;
  description: string;
  status: ReferenceStatus;
  /** Code path in this repository that implements the pattern, when adopted. */
  evidence: string | null;
  evidenceDetail: string | null;
  stars: number | null;
  forks: number | null;
  followers: number | null;
  language: string | null;
  license: string | null;
  topics: string[];
  archived: boolean;
  pushedAt: string | null;
  verification: ReferenceVerification;
  httpStatus: number | null;
  origin: ReferenceOrigin;
  checkedAt: string;
}

export const REFERENCE_CATEGORIES = [${asStringArray(CATEGORY_ORDER)}] as const;

export const REFERENCE_MODULES = [${asStringArray(MODULE_ORDER)}] as const;

export const REFERENCE_STATUS_META: Record<
  ReferenceStatus,
  { label: string; description: string; tone: string }
> = {
  adopted: {
    label: 'Adopted',
    description: 'The pattern is implemented natively in MarketingOS. Evidence points at the code.',
    tone: 'emerald',
  },
  blueprint: {
    label: 'Blueprint',
    description: 'Assessed as valuable and deliberately scheduled rather than rushed in.',
    tone: 'violet',
  },
  evaluated: {
    label: 'Evaluated',
    description: 'Reviewed against product scope; kept as a reference rather than integrated.',
    tone: 'slate',
  },
  'license-review': {
    label: 'Licence review',
    description: 'Copyleft or asset terms must be reviewed before any code is reused.',
    tone: 'amber',
  },
  unavailable: {
    label: 'Access required',
    description: 'The link could not be verified from the build environment (private or denied).',
    tone: 'rose',
  },
  'external-reference': {
    label: 'External site',
    description: 'A live product or site reference outside the build sandbox network allowlist.',
    tone: 'sky',
  },
};

export const REFERENCE_VERIFICATION_META: Record<
  ReferenceVerification,
  { label: string; tone: string }
> = {
  verified: { label: 'Link verified', tone: 'emerald' },
  'verified-archived': { label: 'Verified · archived', tone: 'amber' },
  'access-required': { label: 'Access required', tone: 'rose' },
  external: { label: 'Not fetched here', tone: 'sky' },
  unverified: { label: 'Unverified', tone: 'slate' },
};

export const REFERENCE_LIBRARY: ReferenceEntry[] = ${JSON.stringify(entries, null, 2)};

export const REFERENCE_STATS = {
  total: ${entries.length},
  stars: ${totalStars},
  verifiedAt: '${verification.generatedAt}',
  byStatus: ${JSON.stringify(statusCounts)},
  byVerification: ${JSON.stringify(verificationCounts)},
  byCategory: ${JSON.stringify(categoryCounts)},
  byModule: ${JSON.stringify(moduleCounts)},
} as const;

/** Modules that currently have at least one adopted reference. */
export const ADOPTED_MODULES = ${JSON.stringify(
  Array.from(new Set(entries.filter((e) => e.status === 'adopted').map((e) => e.module))).sort()
)} as const;
`;

await writeFile('src/data/reference-library.ts', file);

// ── Human-readable inventory ────────────────────────────────────────────────
const isoDate = verification.generatedAt.slice(0, 10);
const escapeCell = (value) => String(value ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const adoptedRows = entries.filter((entry) => entry.status === 'adopted');
const blueprintRows = entries.filter((entry) => entry.status === 'blueprint');
const licenceRows = entries.filter((entry) => entry.status === 'license-review');
const unavailableRows = entries.filter((entry) => entry.verification === 'access-required');
const externalRows = entries.filter((entry) => entry.verification === 'external');
const archivedRows = entries.filter((entry) => entry.archived);

const table = (rows) => [
  '| # | Reference | Module | Status | Stars | Licence | Link check |',
  '|---|---|---|---|---|---|---|',
  ...rows.map((entry, index) => `| ${index + 1} | [${escapeCell(entry.fullName)}](${entry.url}) | ${escapeCell(entry.module)} | ${REFERENCE_STATUS_LABELS[entry.status]} | ${entry.stars ?? '—'} | ${escapeCell(entry.license ?? '—')} | ${REFERENCE_VERIFICATION_LABELS[entry.verification]} |`),
].join('\n');

const md = `# MarketingOS reference library — full link inventory

**Verified:** ${isoDate}  
**Unique links:** ${entries.length}  
**Combined upstream stars:** ${totalStars.toLocaleString('en-GB')}  
**Source of truth:** \`scripts/data/reference-links.json\` → \`docs/link-verification.json\` → \`src/data/reference-library.ts\`

This file is generated. Do not edit it by hand — run:

\`\`\`bash
node scripts/verify-reference-links.mjs   # re-check every link
node scripts/build-reference-library.mjs  # rebuild data + this document
\`\`\`

## What the statuses mean

| Status | Meaning |
|---|---|
| Adopted | The pattern is implemented natively in this repository; the evidence column in the app points at the code path. |
| Blueprint | Assessed as valuable for a named module and deliberately scheduled instead of rushed in. |
| Evaluated | Reviewed against product scope; kept as a reference, not integrated. |
| Licence review | Copyleft or unasserted licence/asset terms must be reviewed before any reuse. |
| Access required | The link exists in the request but returned HTTP 403 from the audit account. |
| External site | A live product/site outside the build sandbox network allowlist; not fetched here. |

**No upstream source, asset, model weight or dataset is bundled.** A link in this table is a reference, not a dependency.

## Summary

| Measure | Count |
|---|---|
| Unique links | ${entries.length} |
| Adopted with evidence | ${adoptedRows.length} |
| Blueprints | ${blueprintRows.length} |
| Licence review | ${licenceRows.length} |
| Verified through the GitHub API | ${verificationCounts.verified ?? 0} |
| Verified but archived upstream | ${verificationCounts['verified-archived'] ?? 0} |
| Access required (HTTP 403) | ${unavailableRows.length} |
| External sites (not fetchable here) | ${externalRows.length} |
| Categories | ${Object.keys(categoryCounts).length} |

## Adopted patterns and their evidence

${adoptedRows.map((entry) => `- **${entry.title}** (${entry.fullName}) → \`${entry.evidence}\` — ${entry.evidenceDetail}`).join('\n')}

## Licence review queue

${licenceRows.map((entry) => `- [${entry.fullName}](${entry.url}) — ${entry.license ?? 'unasserted'}${entry.archived ? ' (archived upstream)' : ''}`).join('\n')}

## Links needing a manual check

${[...unavailableRows, ...externalRows].map((entry) => `- [${entry.fullName}](${entry.url}) — ${REFERENCE_VERIFICATION_LABELS[entry.verification]}`).join('\n')}

## Renamed upstream (links still resolve)

${entries.filter((entry) => entry.movedTo).length ? entries.filter((entry) => entry.movedTo).map((entry) => `- [${entry.fullName}](${entry.url}) → now served as [${entry.movedTo}](${entry.canonicalUrl})`).join('\n') : '- None.'}

## Archived upstream (still referenced)

${archivedRows.length ? archivedRows.map((entry) => `- [${entry.fullName}](${entry.url}) — ${entry.stars ?? 0} stars`).join('\n') : '- None.'}

## Full inventory by category

${CATEGORY_ORDER.filter((category) => categoryCounts[category]).map((category) => `### ${category} (${categoryCounts[category]})\n\n${table(entries.filter((entry) => entry.category === category))}`).join('\n\n')}

## Method and limits

- Repeats in the request were de-duplicated by canonical URL, keeping the most specific note.
- GitHub repositories and profiles were checked through the REST API for description, stars, licence, language, archive state and last push time. HTTP 403 is recorded, never hidden.
- GitHub org links are recorded without a metadata lookup.
- Non-GitHub sites were probed once; the sandbox egress allowlist blocks them, so they are marked external rather than dead.
- Licence metadata is a signal, not a legal opinion. Model weights, datasets, media and trademarks are licensed separately from code.
`;

await writeFile('docs/REFERENCE-LIBRARY.md', md);
console.log(`Wrote src/data/reference-library.ts with ${entries.length} entries`);
console.log('statuses', statusCounts);
console.log('verification', verificationCounts);
