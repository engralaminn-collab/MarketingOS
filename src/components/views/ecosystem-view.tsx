'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  BadgeCheck,
  BookMarked,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  ClipboardCopy,
  Code2,
  Download,
  ExternalLink,
  FileDown,
  FileJson,
  Filter,
  GitFork,
  Github,
  Globe2,
  Layers,
  Library,
  Link2,
  Lock,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Table2,
  Tags,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  REFERENCE_CATEGORIES,
  REFERENCE_LIBRARY,
  REFERENCE_MODULES,
  REFERENCE_STATUS_META,
  REFERENCE_STATS,
  REFERENCE_VERIFICATION_META,
  type ReferenceEntry,
  type ReferenceStatus,
} from '@/data/reference-library';

const SAVED_KEY = 'mos_reference_saved_v1';

const STATUS_CLASSES: Record<ReferenceStatus, string> = {
  adopted: 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  blueprint: 'border-violet-300/60 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
  evaluated: 'border-slate-300/60 bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30',
  'license-review': 'border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  unavailable: 'border-rose-300/60 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  'external-reference': 'border-sky-300/60 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
};

const VERIFICATION_CLASSES: Record<string, string> = {
  verified: 'text-emerald-600 dark:text-emerald-400',
  'verified-archived': 'text-amber-600 dark:text-amber-400',
  'access-required': 'text-rose-600 dark:text-rose-400',
  external: 'text-sky-600 dark:text-sky-400',
  unverified: 'text-slate-500 dark:text-slate-400',
};

const MODULE_ACCENTS = ['from-primary to-chart-2', 'from-emerald-500 to-teal-500', 'from-violet-500 to-fuchsia-500', 'from-amber-500 to-orange-500', 'from-sky-500 to-cyan-500'];

/**
 * Curated stacks. They group the catalogue by the outcome a team is buying,
 * not by GitHub language, and reuse the same verified entries.
 */
const PLAYBOOKS = [
  {
    id: 'growth',
    name: 'Growth engine',
    description: 'Demand capture from first signal to closed deal: research, SEO, enrichment, pipeline and attribution.',
    modules: ['Market Intelligence', 'SEO & Live Crawler', 'CRM', 'Marketing Studio', 'Analytics & UTM', 'Content & Queue', 'News Feeds'],
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'conversation',
    name: 'Conversation desk',
    description: 'Chat, SMS and voice in one queue, with an honest hand-off when a human is needed.',
    modules: ['Messages', 'SMS, VoIP & Scraper', 'CRM'],
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    id: 'media',
    name: 'Media factory',
    description: 'Script, generate, caption, cut and publish — with every model behind an operator-controlled adapter.',
    modules: ['Media Studio', 'Content & Queue'],
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'intelligence',
    name: 'Agent & knowledge layer',
    description: 'Skills, memory, retrieval and orchestration that make the rest of the product feel intelligent.',
    modules: ['AI Command', 'Knowledge Wiki & RAG', 'Free AI Agent Hub', 'Workflow Studio'],
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: 'education',
    name: 'Education & UKVI suite',
    description: 'Student journey, study-abroad planning and assessment patterns for the academic side of the product.',
    modules: ['Study Abroad & UKVI', 'Students', 'Exams & Results'],
    accent: 'from-rose-500 to-pink-500',
  },
] as const;

type SortKey = 'stars' | 'name' | 'recent' | 'module';

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number') return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status: ReferenceStatus) {
  return REFERENCE_STATUS_META[status]?.label ?? status;
}

function matches(entry: ReferenceEntry, query: string) {
  if (!query) return true;
  const haystack = [
    entry.title,
    entry.fullName,
    entry.owner,
    entry.description,
    entry.note,
    entry.category,
    entry.module,
    entry.license ?? '',
    ...entry.topics,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}


/**
 * Builds a self-contained adoption brief for a reference. Deterministic on
 * purpose: no model call, no invented facts — everything comes from the
 * verified catalogue entry.
 */
function buildBrief(entry: ReferenceEntry) {
  const licenceNote =
    entry.license && entry.license !== 'NOASSERTION'
      ? `${entry.license}. Check the upstream licence text and any asset/model terms before copying code.`
      : 'No licence metadata was returned. Treat as all-rights-reserved until proven otherwise.';

  const steps: Record<ReferenceStatus, string[]> = {
    adopted: [
      `Keep the native implementation in \`${entry.evidence ?? 'the mapped module'}\` covered by regression tests.`,
      'Re-read the upstream changelog quarterly; only port ideas, never paste code across licences.',
      'Document the divergence so future maintainers know what was adapted and what was not.',
    ],
    blueprint: [
      `Confirm the runtime requirement for ${entry.module} (self-hosted service, model weights, or API key).`,
      'Write a thin adapter behind the existing provider interface rather than calling the upstream service directly.',
      'Ship behind a feature flag with an explicit "not configured" state so the module degrades honestly.',
      `Re-verify the link and licence before the first line of code: ${entry.url}`,
    ],
    evaluated: [
      'Keep as a design reference; revisit only if the product scope changes.',
      'Do not copy code or assets without a fresh licence review.',
    ],
    'license-review': [
      `${licenceNote}`,
      'If reuse is still wanted, isolate it behind a process boundary instead of linking it into the app.',
      'Record the decision in this library so the next reviewer does not repeat the analysis.',
    ],
    unavailable: [
      'Confirm the repository is visible to the deployment account and is not private or renamed.',
      'If it stays private, keep the reference marked as access-required rather than deleting it.',
    ],
    'external-reference': [
      'Open the site in a browser to confirm it is still live; this sandbox cannot reach it.',
      'Use it for product/UX reference only — do not scrape or redistribute its content.',
    ],
  };

  return [
    `# Adoption brief — ${entry.title}`,
    '',
    `- Repository / site: ${entry.url}`,
    `- Owner: ${entry.owner}`,
    `- Category: ${entry.category}`,
    `- MarketingOS module: ${entry.module}`,
    `- Status: ${REFERENCE_STATUS_META[entry.status].label}`,
    `- Licence: ${entry.license ?? 'unknown'}`,
    `- Language: ${entry.language ?? 'n/a'}`,
    `- Upstream signal: ${entry.stars ?? 0} stars · last push ${formatDate(entry.pushedAt)}`,
    `- Link verification: ${REFERENCE_VERIFICATION_META[entry.verification].label} (${formatDate(entry.checkedAt)})`,
    '',
    '## Why it is in the catalogue',
    '',
    entry.note,
    '',
    `> ${entry.description}`,
    '',
    '## Licence position',
    '',
    licenceNote,
    '',
    '## Suggested next steps',
    '',
    ...steps[entry.status].map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Guardrails',
    '',
    '- No upstream source, model weights, datasets or branding are bundled in this repository.',
    '- Any integration must keep working when the upstream dependency is absent.',
    '- Never send customer or student data to a third party without a documented basis.',
    '',
    `Generated from the MarketingOS reference library — verified ${formatDate(entry.checkedAt)}.`,
  ].join('\n');
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/60">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </div>
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function EcosystemView() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [module, setModule] = useState('all');
  const [sort, setSort] = useState<SortKey>('stars');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(36);
  const [selected, setSelected] = useState<ReferenceEntry | null>(null);
  const [activePlaybook, setActivePlaybook] = useState<string | null>(null);

  // Bookmarks live in localStorage. Load them after mount (not during render)
  // so the server-rendered markup and the first client render stay identical.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(SAVED_KEY);
        if (raw) setSaved(JSON.parse(raw));
      } catch {
        /* corrupted storage is not fatal */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = REFERENCE_LIBRARY.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (status !== 'all' && entry.status !== status) return false;
      if (module !== 'all' && entry.module !== module) return false;
      if (savedOnly && !saved.includes(entry.id)) return false;
      return matches(entry, needle);
    });
    return rows.sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title);
      if (sort === 'module') return a.module.localeCompare(b.module) || a.title.localeCompare(b.title);
      if (sort === 'recent') {
        const ta = a.pushedAt ? new Date(a.pushedAt).getTime() : 0;
        const tb = b.pushedAt ? new Date(b.pushedAt).getTime() : 0;
        return tb - ta;
      }
      return (b.stars ?? -1) - (a.stars ?? -1);
    });
  }, [query, category, status, module, sort, savedOnly, saved]);

  const byStatus = REFERENCE_STATS.byStatus as Record<string, number>;
  const byVerification = REFERENCE_STATS.byVerification as Record<string, number>;

  const coverage = useMemo(() => {
    const map = new Map<string, { total: number; adopted: number; blueprint: number; stars: number }>();
    for (const entry of REFERENCE_LIBRARY) {
      const row = map.get(entry.module) ?? { total: 0, adopted: 0, blueprint: 0, stars: 0 };
      row.total += 1;
      if (entry.status === 'adopted') row.adopted += 1;
      if (entry.status === 'blueprint') row.blueprint += 1;
      row.stars += entry.stars ?? 0;
      map.set(entry.module, row);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.adopted - a.adopted || b.total - a.total);
  }, []);

  const playbooks = useMemo(
    () =>
      PLAYBOOKS.map((playbook) => {
        const rows = REFERENCE_LIBRARY.filter((entry) => (playbook.modules as readonly string[]).includes(entry.module));
        return {
          ...playbook,
          rows,
          adopted: rows.filter((row) => row.status === 'adopted').length,
          stars: rows.reduce((total, row) => total + (row.stars ?? 0), 0),
        };
      }),
    []
  );

  const recentlyPushed = useMemo(
    () =>
      [...REFERENCE_LIBRARY]
        .filter((entry) => entry.pushedAt)
        .sort((a, b) => Date.parse(b.pushedAt!) - Date.parse(a.pushedAt!))
        .slice(0, 6),
    []
  );

  const unverified = useMemo(
    () => REFERENCE_LIBRARY.filter((entry) => entry.verification === 'access-required' || entry.verification === 'external'),
    []
  );

  /** Any filter change restarts the grid at page one. */
  const withReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setVisibleCount(36);
    setter(value);
  };

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visible.length;

  const activeFilters = [category, status, module].filter((value) => value !== 'all').length + (savedOnly ? 1 : 0) + (query ? 1 : 0);

  const resetFilters = () => {
    setCategory('all');
    setStatus('all');
    setModule('all');
    setQuery('');
    setSavedOnly(false);
    setVisibleCount(36);
  };

  const exportJson = () => {
    downloadFile(
      'marketingos-reference-library.json',
      JSON.stringify({ generatedAt: REFERENCE_STATS.verifiedAt, stats: REFERENCE_STATS, entries: filtered }, null, 2),
      'application/json'
    );
    toast.success(`Exported ${filtered.length} references as JSON`);
  };

  const exportCsv = () => {
    const header = ['title', 'repository', 'url', 'category', 'module', 'status', 'verification', 'stars', 'license', 'language', 'evidence', 'verified_at'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [header.join(','), ...filtered.map((entry) => [
      entry.title,
      entry.fullName,
      entry.url,
      entry.category,
      entry.module,
      entry.status,
      entry.verification,
      entry.stars ?? '',
      entry.license ?? '',
      entry.language ?? '',
      entry.evidence ?? '',
      entry.checkedAt,
    ].map(escape).join(','))];
    downloadFile('marketingos-reference-library.csv', lines.join('\n'), 'text/csv;charset=utf-8');
    toast.success(`Exported ${filtered.length} references as CSV`);
  };

  const copyLink = async (entry: ReferenceEntry) => {
    try {
      await navigator.clipboard.writeText(entry.url);
      toast.success('Link copied');
    } catch {
      toast.error('Clipboard is not available in this browser');
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-chart-2/10 p-5 md:p-6"
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-chart-2/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-primary/20 bg-primary/10 text-primary">
                <Library className="mr-1 h-3 w-3" /> Ecosystem reference library
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                verified {formatDate(REFERENCE_STATS.verifiedAt)}
              </Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">
              Every open-source reference, mapped to the module it strengthens
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {REFERENCE_STATS.total} deduplicated links from the project brief — repositories, maintainer profiles and product
              sites — each one checked, categorised, and marked as adopted with a code path, scheduled, or deliberately set aside.
              Nothing from the original list was dropped.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson}>
              <FileJson className="mr-1.5 h-3.5 w-3.5" /> JSON
            </Button>
            <Button size="sm" onClick={() => { setStatus('adopted'); setVisibleCount(36); }}>
              <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Show adopted
            </Button>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
          <div className="flex items-center gap-1.5"><Github className="h-3.5 w-3.5" /> {REFERENCE_STATS.total - 19} GitHub links</div>
          <div className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> {formatNumber(REFERENCE_STATS.stars)} combined stars</div>
          <div className="flex items-center gap-1.5"><Tags className="h-3.5 w-3.5" /> {REFERENCE_CATEGORIES.length} categories</div>
          <div className="flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5" /> {REFERENCE_MODULES.length} mapped modules</div>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Adopted patterns" value={String(byStatus.adopted ?? 0)} hint="Implemented natively with a verifiable code path." accent="from-emerald-500 to-teal-500" />
        <StatCard icon={Rocket} label="Blueprints" value={String(byStatus.blueprint ?? 0)} hint="Scheduled candidates kept on the roadmap, not silently dropped." accent="from-violet-500 to-fuchsia-500" />
        <StatCard icon={ClipboardCheck} label="Links verified" value={`${(byVerification.verified ?? 0) + (byVerification['verified-archived'] ?? 0)}/${REFERENCE_STATS.total}`} hint="Checked through the GitHub API on the date above." accent="from-sky-500 to-cyan-500" />
        <StatCard icon={ShieldAlert} label="Needs review" value={String((byStatus['license-review'] ?? 0) + (byStatus.unavailable ?? 0))} hint="Copyleft licences and links that returned 403." accent="from-amber-500 to-orange-500" />
      </div>

      <Tabs defaultValue="catalogue" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="catalogue"><Library className="mr-1.5 h-3.5 w-3.5" /> Catalogue</TabsTrigger>
          <TabsTrigger value="playbooks"><Boxes className="mr-1.5 h-3.5 w-3.5" /> Playbooks</TabsTrigger>
          <TabsTrigger value="coverage"><Layers className="mr-1.5 h-3.5 w-3.5" /> Coverage</TabsTrigger>
          <TabsTrigger value="verification"><ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Verification</TabsTrigger>
        </TabsList>

        {/* Catalogue */}
        <TabsContent value="catalogue" className="space-y-4">
          <Card className="border-border/60">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => withReset(setQuery)(event.target.value)}
                    placeholder={`Search ${REFERENCE_STATS.total} references — try 'video', 'CRM', 'licence', a maintainer, or a topic`}
                    className="pl-9 pr-9"
                  />
                  {query && (
                    <button
                      onClick={() => withReset(setQuery)('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={category} onValueChange={withReset(setCategory)}>
                    <SelectTrigger className="h-9 w-[168px] text-xs">
                      <Filter className="mr-1.5 h-3.5 w-3.5" />
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {REFERENCE_CATEGORIES.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={status} onValueChange={withReset(setStatus)}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {(Object.keys(REFERENCE_STATUS_META) as ReferenceStatus[]).map((key) => (
                        <SelectItem key={key} value={key}>{REFERENCE_STATUS_META[key].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={module} onValueChange={withReset(setModule)}>
                    <SelectTrigger className="h-9 w-[164px] text-xs">
                      <SelectValue placeholder="Module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All modules</SelectItem>
                      {REFERENCE_MODULES.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                    <SelectTrigger className="h-9 w-[136px] text-xs">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stars">Most stars</SelectItem>
                      <SelectItem value="recent">Recently pushed</SelectItem>
                      <SelectItem value="name">Name A–Z</SelectItem>
                      <SelectItem value="module">By module</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={savedOnly ? 'default' : 'outline'}
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setVisibleCount(36);
                      setSavedOnly((value) => !value);
                    }}
                  >
                    <BookMarked className="mr-1.5 h-3.5 w-3.5" /> Saved {saved.length > 0 ? `(${saved.length})` : ''}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {REFERENCE_STATS.total} references
                  {activeFilters > 0 ? ` · ${activeFilters} filter${activeFilters > 1 ? 's' : ''} active` : ''}
                </span>
                {activeFilters > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>
                    Reset filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">No reference matches those filters</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Every one of the {REFERENCE_STATS.total} links is in the catalogue, so an empty result means the search is too narrow.
                </p>
                <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((entry) => (
                <Card
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open details for ${entry.title}`}
                  className="group flex h-full cursor-pointer flex-col border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  onClick={() => setSelected(entry)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(entry);
                    }
                  }}
                >
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          {entry.origin === 'profile' ? <Users className="h-4 w-4" /> : entry.origin === 'website' ? <Globe2 className="h-4 w-4" /> : <Github className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-tight">{entry.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{entry.fullName}</p>
                        </div>
                      </div>
                      <button
                        aria-label={saved.includes(entry.id) ? 'Remove bookmark' : 'Bookmark reference'}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSaved(entry.id);
                        }}
                        className={`rounded p-1 transition-colors ${saved.includes(entry.id) ? 'text-amber-500' : 'text-muted-foreground/50 hover:text-foreground'}`}
                      >
                        <BookMarked className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>

                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASSES[entry.status]}`}>
                        {statusLabel(entry.status)}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal">{entry.module}</Badge>
                      {entry.stars !== null && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Star className="h-3 w-3" /> {formatNumber(entry.stars)}
                        </span>
                      )}
                      {entry.language && <span className="text-[10px] text-muted-foreground">· {entry.language}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[11px] text-muted-foreground">
                Showing {visible.length} of {filtered.length} matches
              </p>
              {hasMore && (
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((count) => count + 48)}>
                  Load 48 more
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Playbooks */}
        <TabsContent value="playbooks" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-4 w-4 text-primary" /> Curated adoption playbooks
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Five outcome-shaped stacks built from the same verified entries. Open one to see every reference it depends on
                and how much is already native.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {playbooks.map((playbook) => (
                <button
                  key={playbook.id}
                  onClick={() => setActivePlaybook(playbook.id)}
                  className="group flex h-full flex-col rounded-xl border border-border/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${playbook.accent} text-white shadow-sm`}>
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] text-muted-foreground">{playbook.rows.length} references</span>
                  </div>
                  <p className="mt-2.5 text-sm font-semibold">{playbook.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{playbook.description}</p>
                  <div className="mt-3">
                    <Progress value={playbook.rows.length ? (playbook.adopted / playbook.rows.length) * 100 : 0} className="h-1.5" />
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="text-emerald-600 dark:text-emerald-400">{playbook.adopted} adopted</span>
                      <span>{formatNumber(playbook.stars)} stars</span>
                    </div>
                  </div>
                  <span className="mt-3 flex items-center gap-1 text-[10px] font-medium text-primary">
                    Open stack <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-4 w-4 text-primary" /> Recently active upstream
              </CardTitle>
              <p className="text-xs text-muted-foreground">Last push dates from the verification run — a signal of what is still maintained.</p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentlyPushed.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{entry.fullName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{entry.module}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(entry.pushedAt)}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage */}
        <TabsContent value="coverage" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4 text-primary" /> Module coverage matrix
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Adopted references are patterns already running in the product. Blueprints sit behind them so each module has a
                concrete next step rather than a vague backlog.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {coverage.map((row, index) => (
                <div key={row.name} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-r ${MODULE_ACCENTS[index % MODULE_ACCENTS.length]}`} />
                      <p className="truncate text-sm font-medium">{row.name}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{row.total} links</span>
                  </div>
                  <Progress value={row.total ? (row.adopted / row.total) * 100 : 0} className="mt-2 h-1.5" />
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    <span className="text-emerald-600 dark:text-emerald-400">{row.adopted} adopted</span>
                    <span className="text-violet-600 dark:text-violet-400">{row.blueprint} blueprint</span>
                    <span>{formatNumber(row.stars)} stars</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-4 w-4 text-emerald-500" /> Adopted patterns with evidence
              </CardTitle>
              <p className="text-xs text-muted-foreground">Each row is a reference whose pattern is implemented in this repository. The path is the receipt.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {REFERENCE_LIBRARY.filter((entry) => entry.status === 'adopted').map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button className="text-sm font-medium hover:text-primary" onClick={() => setSelected(entry)}>{entry.title}</button>
                      <Badge variant="outline" className="text-[10px]">{entry.module}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.evidenceDetail}</p>
                  </div>
                  <code className="shrink-0 rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{entry.evidence}</code>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-4 w-4 text-violet-500" /> Highest-signal blueprints
              </CardTitle>
              <p className="text-xs text-muted-foreground">Deferred on purpose — each needs a runtime, licence or provider decision before it ships.</p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {REFERENCE_LIBRARY.filter((entry) => entry.status === 'blueprint')
                .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
                .slice(0, 10)
                .map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:border-violet-400/50 hover:bg-violet-500/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{entry.fullName}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{entry.module}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      <Star className="h-3 w-3" /> {formatNumber(entry.stars)}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </button>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification */}
        <TabsContent value="verification" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={CheckCircle2} label="Verified" value={String(byVerification.verified ?? 0)} hint="GitHub API returned 200 with metadata." accent="from-emerald-500 to-teal-500" />
            <StatCard icon={FileJson} label="Archived" value={String(byVerification['verified-archived'] ?? 0)} hint="Reachable but archived upstream." accent="from-amber-500 to-orange-500" />
            <StatCard icon={Lock} label="Access required" value={String(byVerification['access-required'] ?? 0)} hint="Private or renamed — kept with the link intact." accent="from-rose-500 to-pink-500" />
            <StatCard icon={Globe2} label="External sites" value={String(byVerification.external ?? 0)} hint="Live products outside the sandbox network allowlist." accent="from-sky-500 to-cyan-500" />
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleAlert className="h-4 w-4 text-amber-500" /> Links that could not be fully verified
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                These are not broken links — they are links this build environment cannot confirm. Enter them in a browser to
                complete the check.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {unverified.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1 rounded-lg border border-border/60 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{entry.fullName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{entry.url}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${VERIFICATION_CLASSES[entry.verification] ?? ''}`}>
                      {REFERENCE_VERIFICATION_META[entry.verification]?.label}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" asChild>
                      <a href={entry.url} target="_blank" rel="noreferrer noopener">
                        Open <ArrowUpRight className="ml-0.5 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-primary" /> How this list was verified
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">1. Deduplicate.</span> The brief contained repeated URLs; they are
                de-duplicated by canonical URL, keeping the most specific note.
              </p>
              <p>
                <span className="font-medium text-foreground">2. Check.</span> Every GitHub repository is queried through the REST
                API for description, stars, licence, language, archive state and last push. Profiles use the users endpoint.
              </p>
              <p>
                <span className="font-medium text-foreground">3. Classify.</span> Status reflects this product: adopted (with a code
                path), blueprint, evaluated, licence review, or access required. Copyleft licences are flagged, never copied.
              </p>
              <p>
                <span className="font-medium text-foreground">4. Re-run.</span> Regenerate the audit at any time:
              </p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[10px] leading-relaxed text-foreground">
{`NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/verify-reference-links.mjs
node scripts/build-reference-library.mjs`}
              </pre>
              <p className="text-[10px]">
                The TLS override is only needed inside this sandbox, whose egress proxy re-signs certificates. On a normal host,
                drop it.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
          {selected && (
            <>
              <DialogHeader className="border-b border-border/60 p-5 pb-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {selected.origin === 'profile' ? <Users className="h-5 w-5" /> : selected.origin === 'website' ? <Globe2 className="h-5 w-5" /> : <Github className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="truncate text-lg">{selected.title}</DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="truncate">{selected.fullName}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASSES[selected.status]}`}>
                        {statusLabel(selected.status)}
                      </span>
                      <span className={`text-[10px] ${VERIFICATION_CLASSES[selected.verification] ?? ''}`}>
                        {REFERENCE_VERIFICATION_META[selected.verification]?.label}
                      </span>
                    </DialogDescription>
                  </div>
                  <button
                    onClick={() => toggleSaved(selected.id)}
                    aria-label="Toggle bookmark"
                    className={`rounded p-1.5 ${saved.includes(selected.id) ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <BookMarked className="h-4 w-4" />
                  </button>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[58vh]">
                <div className="space-y-4 p-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>

                  {selected.movedTo && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-300/50 bg-sky-500/5 p-2.5 text-[11px]">
                      <Badge variant="info" className="text-[10px]">Renamed upstream</Badge>
                      <span className="text-muted-foreground">GitHub now serves this repository as</span>
                      <a
                        href={selected.canonicalUrl ?? selected.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-mono text-[10px] font-medium text-primary hover:underline"
                      >
                        {selected.movedTo}
                      </a>
                    </div>
                  )}

                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" /> Why it is here
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">{selected.note}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {REFERENCE_STATUS_META[selected.status]?.description}
                    </p>
                  </div>

                  {selected.evidence && (
                    <div className="rounded-xl border border-emerald-300/50 bg-emerald-500/5 p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <Code2 className="h-3.5 w-3.5" /> Implemented in this repository
                      </p>
                      <p className="mt-1 text-xs">{selected.evidenceDetail}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 overflow-x-auto rounded bg-background/70 px-2 py-1 font-mono text-[10px]">{selected.evidence}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selected.evidence!);
                              toast.success('Path copied');
                            } catch {
                              toast.error('Clipboard is not available');
                            }
                          }}
                        >
                          <ClipboardCopy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      { label: 'Stars', value: formatNumber(selected.stars), icon: Star },
                      { label: 'Forks', value: formatNumber(selected.forks), icon: GitFork },
                      { label: 'Language', value: selected.language ?? '—', icon: Code2 },
                      { label: 'Licence', value: selected.license ?? '—', icon: ShieldAlert },
                      { label: 'Last push', value: formatDate(selected.pushedAt), icon: Rocket },
                      { label: 'Checked', value: formatDate(selected.checkedAt), icon: ClipboardCheck },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-border/60 p-2">
                        <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <item.icon className="h-3 w-3" /> {item.label}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]"><Tags className="mr-1 h-3 w-3" /> {selected.category}</Badge>
                    <Badge variant="outline" className="text-[10px]"><Layers className="mr-1 h-3 w-3" /> {selected.module}</Badge>
                    {selected.archived && <Badge variant="warning" className="text-[10px]">Archived upstream</Badge>}
                    {(!selected.license || selected.license === 'NOASSERTION') && (
                      <Badge variant="warning" className="text-[10px]">No licence metadata</Badge>
                    )}
                    {selected.topics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-[10px] font-normal">{topic}</Badge>
                    ))}
                  </div>
                </div>
              </ScrollArea>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 p-4">
                <Button size="sm" asChild>
                  <a href={selected.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    {selected.origin === 'website' ? 'Open site' : selected.origin === 'profile' ? 'Open profile' : 'Open repository'}
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyLink(selected)}>
                  <Link2 className="mr-1.5 h-3.5 w-3.5" /> Copy link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildBrief(selected));
                      toast.success('Adoption brief copied as Markdown');
                    } catch {
                      toast.error('Clipboard is not available in this browser');
                    }
                  }}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" /> Copy brief
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadFile(`${selected.id}-brief.md`, buildBrief(selected), 'text/markdown;charset=utf-8');
                    toast.success('Adoption brief downloaded');
                  }}
                >
                  <Table2 className="mr-1.5 h-3.5 w-3.5" /> .md
                </Button>
                <span className="ml-auto text-[10px] text-muted-foreground">{selected.url}</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Playbook dialog */}
      <Dialog open={Boolean(activePlaybook)} onOpenChange={(open) => !open && setActivePlaybook(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
          {(() => {
            const playbook = playbooks.find((item) => item.id === activePlaybook);
            if (!playbook) return null;
            return (
              <>
                <DialogHeader className="border-b border-border/60 p-5 pb-4">
                  <DialogTitle className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${playbook.accent} text-white`}>
                      <Sparkles className="h-4 w-4" />
                    </span>
                    {playbook.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs">{playbook.description}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-2 p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{playbook.rows.length} references</Badge>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">{playbook.adopted} adopted</Badge>
                      <Badge variant="outline" className="text-[10px]">{formatNumber(playbook.stars)} stars</Badge>
                    </div>
                    {playbook.rows
                      .slice()
                      .sort((a, b) => (b.status === 'adopted' ? 1 : 0) - (a.status === 'adopted' ? 1 : 0) || (b.stars ?? 0) - (a.stars ?? 0))
                      .map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                          <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(entry)}>
                            <p className="truncate text-xs font-medium">{entry.title}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{entry.fullName} · {entry.module}</p>
                          </button>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${STATUS_CLASSES[entry.status]}`}>
                            {statusLabel(entry.status)}
                          </span>
                          <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2" asChild>
                            <a href={entry.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${entry.title}`}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Separator />
      <p className="pb-2 text-center text-[10px] text-muted-foreground">
        Reference catalogue regenerated from {REFERENCE_STATS.total} verified links · no upstream code, model weights or assets are
        bundled · licences stay with their authors.
      </p>
    </div>
  );
}
