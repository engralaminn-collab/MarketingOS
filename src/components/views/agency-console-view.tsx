'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  ClipboardCheck,
  Cpu,
  DatabaseBackup,
  Download,
  ExternalLink,
  FileCheck2,
  Gauge,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Power,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  UserSquare,
  Users,
  Wand2,
  XCircle,
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
import { Label } from '@/components/ui/label';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, useApiQuery } from '@/hooks/use-api';

// ── types ───────────────────────────────────────────────────────────────────
interface ReadinessCheck {
  id: string;
  label: string;
  target: string;
  actual: string;
  pass: boolean;
  detail: string;
  evidence?: string | null;
}
interface ReadinessReport {
  generatedAt: string;
  company: { id: string; name: string; slug: string };
  overall: { pass: boolean; passed: number; total: number };
  checks: ReadinessCheck[];
  counts: Record<string, number>;
  models: { localRuntimes: number; externalRuntimes: number; fallbackEnabled: number; modelNames: string[] };
}

interface AgencyDepartment {
  id: string;
  name: string;
  code: string | null;
  level: number;
  description: string | null;
  color: string | null;
  employees: number;
  agents: number;
  sops: number;
  runtime: {
    modelName: string;
    modelTier: string;
    provider: string;
    isolationMode: string;
    fallbackPolicy: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    guardrails: string[];
    knowledgeScope: string[];
    sopIds: string[];
    isActive: boolean;
  } | null;
}

interface AgentRow {
  id: string;
  code: string;
  name: string;
  departmentCode: string;
  role: string;
  level: string;
  mission: string;
  modelTier: string;
  modelName: string | null;
  autonomy: string;
  skills: string[];
  tools: string[];
  guardrails: string[];
}

interface SopRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  departmentName: string | null;
  steps: Array<{ order: number; title: string; description: string }>;
  applicableRoles: string[];
  version: number;
}

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  country: string | null;
  plan: string;
  isActive: boolean;
  users: number;
  voices: number;
  personas: number;
  config: {
    credentialMode: string;
    autoLogoutMinutes: number;
    passwordRotationDays: number;
    allowedChannels: string[];
    onboardingStatus: string;
    dataRegion: string;
    personaLimit: number;
    notes: string | null;
  } | null;
}

interface VoiceRow {
  id: string;
  name: string;
  tone: string;
  personaLine: string;
  doList: string[];
  dontList: string[];
  bannedPhrases: string[];
  isDefault: boolean;
}

interface PersonaRow {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  voiceId: string | null;
  voiceName: string | null;
  assets: Array<{ id: string; label: string; status: string }>;
  consentGranted: boolean;
  consentOwner: string;
  consentProof: string;
  usageScope: string[];
  renderCount: number;
  lastRenderedAt: string | null;
}

interface BackupRow {
  id: string;
  filename: string;
  kind: string;
  sizeBytes: number;
  checksum: string;
  tableCount: number;
  rowCount: number;
  status: string;
  verifiedAt: string | null;
  createdAt: string;
}

const CHANNELS = ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'whatsapp', 'sms', 'email', 'google_ads', 'meta_ads'];

const AGENT_LEVELS = ['executive', 'director', 'manager', 'supervisor', 'specialist', 'worker'];
const AUTONOMY = ['autonomous', 'semi_autonomous', 'supervised'];

function fmtBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Stat({ icon: Icon, label, value, hint, accent }: { icon: React.ElementType; label: string; value: string; hint: string; accent: string }) {
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

export function AgencyConsoleView() {
  const readiness = useApiQuery<{ data: ReadinessReport }>('/api/agency/readiness');
  const departments = useApiQuery<{ data: AgencyDepartment[]; meta: { models: string[] } }>('/api/agency/departments');
  const sops = useApiQuery<{ data: SopRow[]; meta: { total: number; departmentsWithSop: number; departments: number } }>('/api/agency/sops');
  const clients = useApiQuery<{ data: ClientRow[]; meta: { deploymentModel: string } }>('/api/clients');
  const voices = useApiQuery<{ data: VoiceRow[] }>('/api/brand/voices');
  const personas = useApiQuery<{ data: PersonaRow[]; meta: { limit: number; used: number } }>('/api/brand/personas');
  const backups = useApiQuery<{ data: BackupRow[]; meta: { directory: string; pruneAfter: number } }>('/api/agency/backups');

  const [agentQuery, setAgentQuery] = useState('');
  const [agentDept, setAgentDept] = useState('all');
  const [agentLevel, setAgentLevel] = useState('all');
  const [agentPage, setAgentPage] = useState(0);
  const agents = useApiQuery<{ data: AgentRow[]; meta: { total: number; byLevel: Record<string, number>; byAutonomy: Record<string, number> } }>(
    `/api/agency/agents?limit=24&offset=${agentPage * 24}${agentQuery ? `&q=${encodeURIComponent(agentQuery)}` : ''}${
      agentDept !== 'all' ? `&department=${encodeURIComponent(agentDept)}` : ''
    }${agentLevel !== 'all' ? `&level=${agentLevel}` : ''}`
  );

  const [sopFilter, setSopFilter] = useState('all');
  const [detailDept, setDetailDept] = useState<AgencyDepartment | null>(null);
  const [detailSop, setDetailSop] = useState<SopRow | null>(null);
  const [detailAgent, setDetailAgent] = useState<AgentRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, { ok: boolean; checks: Array<{ name: string; ok: boolean; detail: string }> }>>({});

  const [newClient, setNewClient] = useState({ name: '', industry: '', country: '', channels: [...CHANNELS.slice(0, 6)], credentialMode: 'client_login', autoLogoutMinutes: 15, passwordRotationDays: 90 });
  const [voiceDraft, setVoiceDraft] = useState({ tone: 'warm-professional', personaLine: '', sampleCopy: '' });
  const [personaDraft, setPersonaDraft] = useState({ name: '', role: 'presenter', consentOwner: '', consentProof: '', channel: 'instagram' });
  const [renderScript, setRenderScript] = useState('Welcome to our channel — here is what we do in thirty seconds.');

  const report = readiness.data?.data;
  const deptRows = departments.data?.data ?? [];
  const sopRows = sops.data?.data ?? [];
  const clientRows = clients.data?.data ?? [];
  const voiceRows = voices.data?.data ?? [];
  const personaRows = personas.data?.data ?? [];
  const backupRows = backups.data?.data ?? [];

  const filteredSops = useMemo(
    () => (sopFilter === 'all' ? sopRows : sopRows.filter((sop) => (sop.departmentName ?? 'Cross-functional') === sopFilter)),
    [sopRows, sopFilter]
  );

  const deptOptions = useMemo(() => Array.from(new Set(deptRows.map((d) => d.code).filter(Boolean))) as string[], [deptRows]);

  async function run(label: string, fn: () => Promise<unknown>, success: string) {
    setBusy(label);
    try {
      await fn();
      toast.success(success);
      await Promise.all([readiness.refetch(), clients.refetch(), voices.refetch(), personas.refetch(), backups.refetch(), departments.refetch(), sops.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-chart-2/10 p-5 md:p-6"
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="mr-1 h-3 w-3" /> Agency operating model
              </Badge>
              <Badge variant="outline" className="text-[10px]">one platform · every client</Badge>
              {report && (
                <Badge variant={report.overall.pass ? 'success' : 'warning'} className="text-[10px]">
                  {report.overall.passed}/{report.overall.total} checks passing
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">
              100 departments, 2,000 agents, SOPs everywhere — verified, not assumed
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every department runs as its own local model with its own prompt, guardrails and SOP. Client workspaces are configuration,
              not new applications: onboarding a client is a form, not a deployment. Nothing here calls a hosted AI provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => run('backup', () => apiFetch('/api/agency/backups', { method: 'POST', body: JSON.stringify({ kind: 'manual' }) }), 'Backup created')}
              disabled={busy === 'backup'}
            >
              {busy === 'backup' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <DatabaseBackup className="mr-1.5 h-3.5 w-3.5" />}
              Back up now
            </Button>
            <Button variant="outline" size="sm" onClick={() => { void readiness.refetch(); void departments.refetch(); void sops.refetch(); }} disabled={readiness.isLoading}>
              {readiness.isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Re-audit
            </Button>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Building2} label="Departments" value={String(report?.counts.departments ?? '—')} hint={`${report?.counts.departmentsWithRuntime ?? 0} have their own model runtime`} accent="from-sky-500 to-cyan-500" />
        <Stat icon={Users} label="Agents" value={(report?.counts.agents ?? 0).toLocaleString()} hint="Versioned specs bound to a department and SOP" accent="from-emerald-500 to-teal-500" />
        <Stat icon={FileCheck2} label="SOPs" value={String(report?.counts.sops ?? '—')} hint={`${report?.counts.departmentsWithSop ?? 0}/${report?.counts.departments ?? 0} departments covered`} accent="from-violet-500 to-fuchsia-500" />
        <Stat icon={DatabaseBackup} label="Verified backups" value={String(report?.counts.verifiedBackups ?? 0)} hint={report?.counts.backups ? `${report.counts.backups} snapshot(s) registered` : 'Take the first snapshot now'} accent="from-amber-500 to-orange-500" />
      </div>

      <Tabs defaultValue="readiness" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="readiness"><Gauge className="mr-1.5 h-3.5 w-3.5" /> Readiness</TabsTrigger>
          <TabsTrigger value="departments"><Building2 className="mr-1.5 h-3.5 w-3.5" /> Departments</TabsTrigger>
          <TabsTrigger value="agents"><Users className="mr-1.5 h-3.5 w-3.5" /> Agents</TabsTrigger>
          <TabsTrigger value="sops"><FileCheck2 className="mr-1.5 h-3.5 w-3.5" /> SOPs</TabsTrigger>
          <TabsTrigger value="clients"><KeyRound className="mr-1.5 h-3.5 w-3.5" /> Clients</TabsTrigger>
          <TabsTrigger value="brand"><UserSquare className="mr-1.5 h-3.5 w-3.5" /> Brand & personas</TabsTrigger>
          <TabsTrigger value="backups"><DatabaseBackup className="mr-1.5 h-3.5 w-3.5" /> Backups</TabsTrigger>
        </TabsList>

        {/* ── readiness ───────────────────────────────────────────────── */}
        <TabsContent value="readiness" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-primary" /> Specification audit
                {report && (
                  <Badge variant={report.overall.pass ? 'success' : 'warning'} className="ml-1 text-[10px]">
                    {report.overall.pass ? 'All checks pass' : `${report.overall.total - report.overall.passed} to fix`}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Computed from live data on every load — nothing is hard-coded to look complete.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {readiness.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Auditing…</p>}
              {readiness.error && (
                <div className="rounded-lg border border-rose-300/50 bg-rose-500/5 p-3 text-xs">
                  <p className="font-medium text-rose-600 dark:text-rose-400">Could not load the audit</p>
                  <p className="mt-0.5 text-muted-foreground">{readiness.error}</p>
                </div>
              )}
              {report?.checks.map((check) => (
                <div
                  key={check.id}
                  className={`flex flex-col gap-1.5 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                    check.pass ? 'border-emerald-300/40 bg-emerald-500/[0.03]' : 'border-amber-300/60 bg-amber-500/5'
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    {check.pass ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{check.detail}</p>
                      {check.evidence && <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">{check.evidence}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-6 sm:pl-0">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">actual</p>
                      <p className="text-xs font-semibold tabular-nums">{check.actual}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">target</p>
                      <p className="text-xs text-muted-foreground">{check.target}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-sky-500" /> Model isolation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Local runtimes</span>
                  <span className="font-semibold text-foreground">{report?.models.localRuntimes ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Hosted runtimes</span>
                  <span className="font-semibold text-foreground">{report?.models.externalRuntimes ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Departments allowing fallback</span>
                  <span className={`font-semibold ${report?.models.fallbackEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {report?.models.fallbackEnabled ?? 0}
                  </span>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-1">
                  {(report?.models.modelNames ?? []).map((model) => (
                    <Badge key={model} variant="secondary" className="font-mono text-[10px]">{model}</Badge>
                  ))}
                </div>
                <p className="pt-1 text-[10px] leading-relaxed">
                  Each department carries its own system prompt, temperature and guardrails. When the local model is unavailable the
                  department fails explicitly instead of silently escalating to a paid provider.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4 text-violet-500" /> Backup policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Directory</span>
                  <code className="font-mono text-[10px]">{backups.data?.meta.directory ?? './backups'}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span>Snapshots kept</span>
                  <span className="font-semibold text-foreground">{backups.data?.meta.pruneAfter ?? 14}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Latest snapshot</span>
                  <span className="font-semibold text-foreground">{backupRows[0] ? fmtDate(backupRows[0].createdAt) : 'none yet'}</span>
                </div>
                <Separator />
                <p className="text-[10px] leading-relaxed">
                  Snapshots use <code className="font-mono">VACUUM INTO</code> so a live write cannot tear the file. Each one is
                  SHA-256 checksummed, counted per table and verified against the manifest before it is trusted.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── departments ─────────────────────────────────────────────── */}
        <TabsContent value="departments" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" /> Departments as independent models
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {deptRows.length} departments · {deptRows.filter((d) => d.runtime).length} with a model runtime ·{" "}
                {deptRows.filter((d) => d.sops > 0).length} with an SOP. Click a card for its prompt, guardrails and staffing.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {deptRows.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => setDetailDept(dept)}
                    className="group flex flex-col rounded-xl border border-border/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                          style={{ backgroundColor: dept.color || '#64748b' }}
                        >
                          {(dept.code ?? dept.name).slice(0, 3)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{dept.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">L{dept.level} · {dept.code}</p>
                        </div>
                      </div>
                      {dept.runtime ? (
                        <Badge variant="outline" className="shrink-0 font-mono text-[9px]">{dept.runtime.modelTier}</Badge>
                      ) : (
                        <Badge variant="warning" className="shrink-0 text-[9px]">no runtime</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {dept.employees}</span>
                      <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> {dept.agents} agents</span>
                      <span className="flex items-center gap-1"><FileCheck2 className="h-3 w-3" /> {dept.sops} SOP</span>
                    </div>
                    {dept.runtime && (
                      <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground/80">{dept.runtime.modelName}</p>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── agents ─────────────────────────────────────────────────── */}
        <TabsContent value="agents" className="space-y-3">
          <Card className="border-border/60">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={agentQuery}
                    onChange={(event) => { setAgentQuery(event.target.value); setAgentPage(0); }}
                    placeholder="Search the agent roster by name, role, code or department"
                    className="pl-9"
                  />
                </div>
                <Select value={agentDept} onValueChange={(value) => { setAgentDept(value); setAgentPage(0); }}>
                  <SelectTrigger className="h-9 w-[190px] text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {deptOptions.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={agentLevel} onValueChange={(value) => { setAgentLevel(value); setAgentPage(0); }}>
                  <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    {AGENT_LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {agents.data?.meta.total.toLocaleString() ?? '…'} matching agents · page {agentPage + 1}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {(agents.data?.data ?? []).map((agent) => (
              <button
                key={agent.id}
                onClick={() => setDetailAgent(agent)}
                className="flex flex-col rounded-xl border border-border/60 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{agent.role}</p>
                  <Badge variant="outline" className="shrink-0 font-mono text-[9px]">{agent.code}</Badge>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{agent.name}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{agent.mission}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[9px]">{agent.level}</Badge>
                  <Badge variant="outline" className="text-[9px]">{agent.modelTier}</Badge>
                  <Badge
                    variant={agent.autonomy === 'autonomous' ? 'warning' : agent.autonomy === 'supervised' ? 'neutral' : 'info'}
                    className="text-[9px]"
                  >
                    {agent.autonomy.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {agents.data && agents.data.meta.total > 0 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={agentPage === 0} onClick={() => setAgentPage((page) => Math.max(0, page - 1))}>
                Previous
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {agentPage * 24 + 1}–{Math.min((agentPage + 1) * 24, agents.data.meta.total)} of {agents.data.meta.total.toLocaleString()}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(agentPage + 1) * 24 >= agents.data.meta.total}
                onClick={() => setAgentPage((page) => page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── SOPs ───────────────────────────────────────────────────── */}
        <TabsContent value="sops" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck2 className="h-4 w-4 text-violet-500" /> SOP library
                <Badge variant="outline" className="ml-1 text-[10px]">
                  {sops.data?.meta.departmentsWithSop ?? 0}/{sops.data?.meta.departments ?? 0} departments covered
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                One procedure per department plus cross-functional playbooks (onboarding, publishing, persona consent, invoicing, backups).
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={sopFilter} onValueChange={setSopFilter}>
                <SelectTrigger className="h-9 w-full max-w-sm text-xs"><SelectValue placeholder="Filter by department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {Array.from(new Set(sopRows.map((sop) => sop.departmentName ?? 'Cross-functional'))).map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                {filteredSops.slice(0, 60).map((sop) => (
                  <button
                    key={sop.id}
                    onClick={() => setDetailSop(sop)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:border-violet-400/50 hover:bg-violet-500/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{sop.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {sop.departmentName ?? 'Cross-functional'} · {sop.steps.length} steps · v{sop.version}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {filteredSops.length > 60 && (
                  <p className="text-center text-[10px] text-muted-foreground">Showing 60 of {filteredSops.length}. Narrow the filter to see more.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── clients ────────────────────────────────────────────────── */}
        <TabsContent value="clients" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" /> Client workspaces
                <Badge variant="outline" className="ml-1 text-[10px]">{clients.data?.meta.deploymentModel ?? 'single-tenant-configurable'}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Adding a client creates a workspace plus a configuration row — never a new app. The client signs in with their own
                platform credentials, the job runs, and the session closes automatically after the configured minutes.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {clientRows.map((client) => (
                <div key={client.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium">{client.name}</p>
                        <Badge variant={client.isActive ? 'success' : 'neutral'} className="text-[9px]">
                          {client.isActive ? 'active' : 'inactive'}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">{client.plan}</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {client.slug} · {client.industry ?? 'industry n/a'} · {client.users} user(s) · {client.voices} voice(s) · {client.personas} persona(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="info" className="text-[9px]">{client.config?.credentialMode ?? 'not configured'}</Badge>
                      {client.config && <Badge variant="neutral" className="text-[9px]">auto-logout {client.config.autoLogoutMinutes}m</Badge>}
                    </div>
                  </div>
                  {client.config && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {client.config.allowedChannels.map((channel) => (
                        <Badge key={channel} variant="secondary" className="text-[9px]">{channel}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" /> Provision a client
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Same code path for every client. Choose the channels they use and how credentials are handled.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Client name</Label>
                  <Input value={newClient.name} onChange={(event) => setNewClient({ ...newClient, name: event.target.value })} placeholder="e.g. Northwind Travel" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Industry</Label>
                  <Input value={newClient.industry} onChange={(event) => setNewClient({ ...newClient, industry: event.target.value })} placeholder="e.g. Travel" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <Input value={newClient.country} onChange={(event) => setNewClient({ ...newClient, country: event.target.value })} placeholder="e.g. United Kingdom" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Channels this client uses</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.map((channel) => {
                    const active = newClient.channels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() =>
                          setNewClient({
                            ...newClient,
                            channels: active ? newClient.channels.filter((c) => c !== channel) : [...newClient.channels, channel],
                          })
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {channel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Credential mode</Label>
                  <Select value={newClient.credentialMode} onValueChange={(value) => setNewClient({ ...newClient, credentialMode: value })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client_login">Client signs in (auto-logout)</SelectItem>
                      <SelectItem value="managed">We hold the connection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Auto-logout (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={240}
                    value={newClient.autoLogoutMinutes}
                    onChange={(event) => setNewClient({ ...newClient, autoLogoutMinutes: Number(event.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Password rotation (days)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={365}
                    value={newClient.passwordRotationDays}
                    onChange={(event) => setNewClient({ ...newClient, passwordRotationDays: Number(event.target.value) })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy === 'client' || !newClient.name.trim()}
                  onClick={() =>
                    run(
                      'client',
                      () =>
                        apiFetch('/api/clients', {
                          method: 'POST',
                          body: JSON.stringify({
                            name: newClient.name,
                            industry: newClient.industry,
                            country: newClient.country,
                            channels: newClient.channels,
                            credentialMode: newClient.credentialMode,
                            autoLogoutMinutes: newClient.autoLogoutMinutes,
                            passwordRotationDays: newClient.passwordRotationDays,
                          }),
                        }),
                      `Client "${newClient.name}" provisioned`
                    )
                  }
                >
                  {busy === 'client' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  Provision workspace
                </Button>
                <p className="text-[10px] text-muted-foreground">
                  Creates the workspace, its client configuration, its channel map and a house brand voice in one call.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── brand + personas ───────────────────────────────────────── */}
        <TabsContent value="brand" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wand2 className="h-4 w-4 text-primary" /> Brand voice
                </CardTitle>
                <p className="text-xs text-muted-foreground">One voice profile drives every post, email, script and persona.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {voiceRows.map((voice) => (
                  <div key={voice.id} className="rounded-lg border border-border/60 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{voice.name}</p>
                      {voice.isDefault && <Badge variant="success" className="text-[9px]">default</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{voice.tone} · {voice.personaLine}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {voice.bannedPhrases.slice(0, 5).map((phrase) => (
                        <Badge key={phrase} variant="warning" className="text-[9px]">✕ {phrase}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tone</Label>
                    <Input value={voiceDraft.tone} onChange={(event) => setVoiceDraft({ ...voiceDraft, tone: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Voice in one line</Label>
                    <Input
                      value={voiceDraft.personaLine}
                      onChange={(event) => setVoiceDraft({ ...voiceDraft, personaLine: event.target.value })}
                      placeholder="We sound like a knowledgeable guide, never a hype machine."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sample copy</Label>
                    <Textarea
                      rows={2}
                      value={voiceDraft.sampleCopy}
                      onChange={(event) => setVoiceDraft({ ...voiceDraft, sampleCopy: event.target.value })}
                      placeholder="Paste one approved paragraph — it anchors tone for every agent."
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy === 'voice' || !voiceDraft.personaLine.trim()}
                    onClick={() =>
                      run(
                        'voice',
                        () =>
                          apiFetch('/api/brand/voices', {
                            method: 'POST',
                            body: JSON.stringify({ name: `${report?.company.name ?? 'Client'} voice`, isDefault: true, ...voiceDraft }),
                          }),
                        'Brand voice saved'
                      )
                    }
                  >
                    {busy === 'voice' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                    Save voice
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <UserSquare className="h-4 w-4 text-fuchsia-500" /> Face agents
                  <Badge variant="outline" className="ml-1 text-[9px]">
                    {personas.data?.meta.used ?? 0}/{personas.data?.meta.limit ?? 3}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Built only from photos the client supplies, with recorded consent. Rendering is blocked server-side until consent and
                  usage scope are on file.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {personaRows.map((persona) => (
                  <div key={persona.id} className="rounded-lg border border-border/60 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <p className="text-xs font-medium">{persona.name}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant={persona.status === 'ready' ? 'success' : 'neutral'} className="text-[9px]">{persona.status}</Badge>
                        <Badge variant={persona.consentGranted ? 'info' : 'warning'} className="text-[9px]">
                          {persona.consentGranted ? 'consent on file' : 'no consent'}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{persona.description}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Voice: {persona.voiceName ?? 'default'} · renders: {persona.renderCount} · last: {fmtDate(persona.lastRenderedAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {persona.usageScope.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-[9px]">{scope}</Badge>
                      ))}
                    </div>
                  </div>
                ))}

                <Separator />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Persona name</Label>
                    <Input value={personaDraft.name} onChange={(event) => setPersonaDraft({ ...personaDraft, name: event.target.value })} placeholder="e.g. Sam — Product Host" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Channel</Label>
                    <Select value={personaDraft.channel} onValueChange={(value) => setPersonaDraft({ ...personaDraft, channel: value })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['instagram', 'tiktok', 'youtube', 'linkedin', 'website'].map((channel) => (
                          <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Consent owner</Label>
                    <Input value={personaDraft.consentOwner} onChange={(event) => setPersonaDraft({ ...personaDraft, consentOwner: event.target.value })} placeholder="Who signed the likeness permission" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Consent proof reference</Label>
                    <Input value={personaDraft.consentProof} onChange={(event) => setPersonaDraft({ ...personaDraft, consentProof: event.target.value })} placeholder="Contract or document id" />
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={busy === 'persona' || !personaDraft.name.trim()}
                  onClick={() =>
                    run(
                      'persona',
                      () =>
                        apiFetch('/api/brand/personas', {
                          method: 'POST',
                          body: JSON.stringify({
                            ...personaDraft,
                            status: 'ready',
                            consentGranted: Boolean(personaDraft.consentOwner && personaDraft.consentProof),
                            usageScope: [personaDraft.channel],
                            assets: [{ id: 'upload-1', label: 'Client-supplied portrait', status: 'pending_upload' }],
                          }),
                        }),
                      'Persona saved'
                    )
                  }
                >
                  {busy === 'persona' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserSquare className="mr-1.5 h-3.5 w-3.5" />}
                  Add persona
                </Button>

                {personaRows[0] && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <p className="text-[11px] font-medium">Request a render (consent-gated)</p>
                    <Textarea
                      rows={2}
                      className="mt-1.5 text-xs"
                      value={renderScript}
                      onChange={(event) => setRenderScript(event.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={busy === 'render'}
                      onClick={() =>
                        run(
                          'render',
                          () =>
                            apiFetch(`/api/brand/personas/${personaRows[0].id}/render`, {
                              method: 'POST',
                              body: JSON.stringify({ channel: personaRows[0].usageScope[0], script: renderScript }),
                            }),
                          'Render request recorded'
                        )
                      }
                    >
                      {busy === 'render' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Power className="mr-1.5 h-3.5 w-3.5" />}
                      Request render for {personaRows[0].name}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── backups ────────────────────────────────────────────────── */}
        <TabsContent value="backups" className="space-y-3">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DatabaseBackup className="h-4 w-4 text-amber-500" /> Backup register
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Every snapshot is checksummed and verified against the live manifest. Verification opens the copy in a separate
                client — production data is never touched.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {backupRows.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <DatabaseBackup className="mx-auto h-6 w-6 text-muted-foreground/60" />
                  <p className="mt-2 text-xs font-medium">No backup has been taken yet</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Use “Back up now” at the top of this page before going live.</p>
                </div>
              )}
              {backupRows.map((backup) => (
                <div key={backup.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-mono text-[11px] font-medium">{backup.filename}</p>
                        <Badge variant={backup.status === 'verified' ? 'success' : backup.status === 'failed' ? 'destructive' : 'neutral'} className="text-[9px]">
                          {backup.status}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">{backup.kind}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {fmtDate(backup.createdAt)} · {fmtBytes(backup.sizeBytes)} · {backup.tableCount} tables · {backup.rowCount.toLocaleString()} rows
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground/70">sha256 {backup.checksum.slice(0, 32)}…</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={busy === backup.id}
                      onClick={async () => {
                        setBusy(backup.id);
                        try {
                          const result = await apiFetch<{ data: { ok: boolean; checks: Array<{ name: string; ok: boolean; detail: string }> } }>(
                            `/api/agency/backups/${backup.id}/verify`,
                            { method: 'POST' }
                          );
                          setVerifyResult((current) => ({ ...current, [backup.id]: result.data }));
                          toast[result.data.ok ? 'success' : 'error'](result.data.ok ? 'Backup verified' : 'Backup verification failed');
                          await backups.refetch();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : 'Verification failed');
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === backup.id ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <BadgeCheck className="mr-1.5 h-3 w-3" />}
                      Verify
                    </Button>
                  </div>
                  {verifyResult[backup.id] && (
                    <div className="mt-2 space-y-1 rounded-lg bg-muted/40 p-2">
                      {verifyResult[backup.id].checks.map((check) => (
                        <div key={check.name} className="flex items-start gap-1.5 text-[10px]">
                          {check.ok ? (
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                          )}
                          <span className="font-mono">{check.name}</span>
                          <span className="text-muted-foreground">— {check.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* department detail */}
      <Dialog open={Boolean(detailDept)} onOpenChange={(open) => !open && setDetailDept(null)}>
        <DialogContent className="max-h-[86vh] max-w-2xl overflow-hidden p-0">
          {detailDept && (
            <>
              <DialogHeader className="border-b border-border/60 p-5 pb-4">
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: detailDept.color || '#64748b' }}>
                    {(detailDept.code ?? detailDept.name).slice(0, 3)}
                  </span>
                  {detailDept.name}
                </DialogTitle>
                <DialogDescription className="text-xs">{detailDept.description}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[62vh]">
                <div className="space-y-3 p-5">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Employees', value: detailDept.employees, icon: Users },
                      { label: 'Agents', value: detailDept.agents, icon: Cpu },
                      { label: 'SOPs', value: detailDept.sops, icon: FileCheck2 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-border/60 p-2">
                        <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <item.icon className="h-3 w-3" /> {item.label}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {detailDept.runtime ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                        {[
                          { label: 'Model', value: detailDept.runtime.modelName },
                          { label: 'Tier', value: detailDept.runtime.modelTier },
                          { label: 'Provider', value: detailDept.runtime.provider },
                          { label: 'Isolation', value: detailDept.runtime.isolationMode },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg border border-border/60 p-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                            <p className="mt-0.5 truncate font-mono text-[10px]">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">System prompt</p>
                        <p className="mt-1 text-[11px] leading-relaxed">{detailDept.runtime.systemPrompt}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/60 p-2.5">
                          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <Lock className="h-3 w-3" /> Guardrails
                          </p>
                          <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                            {detailDept.runtime.guardrails.map((rule) => <li key={rule}>• {rule}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-border/60 p-2.5">
                          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            <Layers className="h-3 w-3" /> Knowledge scope
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {detailDept.runtime.knowledgeScope.map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-[9px]">{scope}</Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            Fallback policy: <span className={detailDept.runtime.fallbackPolicy === 'none' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{detailDept.runtime.fallbackPolicy}</span>
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-amber-300/60 bg-amber-500/5 p-3 text-xs">
                      <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> No runtime configured
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        This department exists but has no model profile yet. Run <code className="font-mono">prisma/seed-agency.ts</code> to
                        generate one for every department.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex items-center gap-2 border-t border-border/60 p-3">
                <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(JSON.stringify(detailDept.runtime, null, 2)); toast.success('Runtime profile copied'); }}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Copy profile
                </Button>
                <span className="ml-auto text-[10px] text-muted-foreground">{detailDept.code}</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* SOP detail */}
      <Dialog open={Boolean(detailSop)} onOpenChange={(open) => !open && setDetailSop(null)}>
        <DialogContent className="max-h-[86vh] max-w-xl overflow-hidden p-0">
          {detailSop && (
            <>
              <DialogHeader className="border-b border-border/60 p-5 pb-4">
                <DialogTitle className="text-base">{detailSop.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {detailSop.departmentName ?? 'Cross-functional'} · v{detailSop.version} · {detailSop.steps.length} steps
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[62vh]">
                <div className="space-y-2 p-5">
                  <p className="text-xs text-muted-foreground">{detailSop.description}</p>
                  {detailSop.steps.map((step) => (
                    <div key={step.order} className="flex gap-2.5 rounded-lg border border-border/60 p-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {step.order}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium">{step.title}</p>
                        <p className="text-[10px] leading-relaxed text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* agent detail */}
      <Dialog open={Boolean(detailAgent)} onOpenChange={(open) => !open && setDetailAgent(null)}>
        <DialogContent className="max-h-[86vh] max-w-lg overflow-hidden p-0">
          {detailAgent && (
            <>
              <DialogHeader className="border-b border-border/60 p-5 pb-4">
                <DialogTitle className="text-base">{detailAgent.role}</DialogTitle>
                <DialogDescription className="text-xs">{detailAgent.name} · {detailAgent.code}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-3 p-5">
                  <p className="text-xs leading-relaxed text-muted-foreground">{detailAgent.mission}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Department</p>
                      <p className="mt-0.5 font-mono text-[10px]">{detailAgent.departmentCode}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Autonomy</p>
                      <p className="mt-0.5">{detailAgent.autonomy.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Model</p>
                      <p className="mt-0.5 font-mono text-[10px]">{detailAgent.modelName ?? detailAgent.modelTier}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Level</p>
                      <p className="mt-0.5">{detailAgent.level}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Skills</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {detailAgent.skills.map((skill) => <Badge key={skill} variant="secondary" className="text-[9px]">{skill}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tools</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {detailAgent.tools.map((tool) => <Badge key={tool} variant="outline" className="text-[9px]">{tool}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Guardrails</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {detailAgent.guardrails.map((rule) => <Badge key={rule} variant="warning" className="text-[9px]">{rule.replace(/_/g, ' ')}</Badge>)}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
