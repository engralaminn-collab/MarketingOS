'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Layers,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, useApiQuery } from '@/hooks/use-api';

interface FreeHubData {
  activeStatus: {
    provider: string;
    model: string | null;
    status: string;
    reachable: boolean;
    detail: string;
  };
  providers: Array<{
    id: string;
    name: string;
    badge?: string;
    tier: string;
    baseUrl: string;
    envKey: string;
    defaultModel: string;
    freeModels: string[];
    limits: string;
    signupUrl: string;
    supportsToolCalling: boolean;
    requiresKey: boolean;
  }>;
  telemetry: Array<{
    id: string;
    name: string;
    configured: boolean;
    rpmUsed: number;
    rpmLimit: number;
    rpmPctLeft: number;
    rpdUsed: number;
    rpdLimit: number;
    rpdPctLeft: number;
    totalTokens: number;
    cacheHits: number;
    errors: number;
    lastLatencyMs: number | null;
  }>;
  openRouterFree: {
    source: 'live' | 'curated';
    count: number;
    models: Array<{ id: string; name: string; strength?: string; toolCalling?: boolean }>;
  };
  embeddings: Array<{ provider: string; models: string[]; allowance: string }>;
  multimodal: {
    image: Array<{ service: string; notes: string }>;
    stt: Array<{ service: string; models: string; allowance: string }>;
    tts: Array<{ service: string; notes: string }>;
  };
  infraAndFrameworks: {
    storageAndInfra: Array<{ category: string; options: string }>;
    frameworks: Array<{ name: string; lang: string; why: string }>;
    mcpServers: Array<{ id: string; pkg: string; desc: string }>;
    hardwareSizing: Array<{ tier: string; models: string; notes: string }>;
    quickStartPaths: Array<{ goal: string; recipe: string }>;
  };
}

export default function FreeAiHubView() {
  const { data: resp, refetch } = useApiQuery<any>('/api/ai/free-hub');
  const hub: FreeHubData | undefined = resp?.data ?? resp;

  // Agent Playground state
  const [goal, setGoal] = useState(
    'Fetch our live workspace CRM metrics, list qualified leads with score >= 60, calculate UKVI London CAS bank funds for £16,500 tuition (£3,000 deposit paid), and build a LinkedIn UTM campaign link.',
  );
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('qwen2.5:7b');
  const [fallbackCsv, setFallbackCsv] = useState('groq,cerebras,openrouter,gemini,ollama');
  const [runningAgent, setRunningAgent] = useState(false);
  const [agentOutput, setAgentOutput] = useState<{
    answer: string;
    provider: string;
    model: string;
    degradedToDeterministicPlanner: boolean;
    steps: Array<{
      step: number;
      type: string;
      toolName?: string;
      toolArgs?: Record<string, unknown>;
      toolOutput?: string;
      durationMs: number;
      provider?: string;
    }>;
  } | null>(null);

  // Code exporter state
  const [selectedMcp, setSelectedMcp] = useState<string[]>(['filesystem', 'git', 'github', 'playwright', 'memory']);
  const [codeBundle, setCodeBundle] = useState<{
    listFreePy: string;
    agentPy: string;
    ollamaSetupSh: string;
    mcpConfigJson: string;
  } | null>(null);
  const [activeCodeFile, setActiveCodeFile] = useState<'agentPy' | 'listFreePy' | 'ollamaSetupSh' | 'mcpConfigJson'>('agentPy');
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState('');

  useEffect(() => {
    apiFetch<{ data: NonNullable<typeof codeBundle> }>('/api/ai/free-hub', {
      method: 'POST',
      body: JSON.stringify({
        action: 'export-code',
        provider: selectedProvider,
        model: selectedModel,
        mcpServers: selectedMcp,
      }),
    })
      .then((r) => setCodeBundle(r.data))
      .catch(() => undefined);
  }, [selectedProvider, selectedModel, selectedMcp]);

  async function handleRunAgent() {
    if (!goal.trim()) return;
    setRunningAgent(true);
    try {
      const chain = fallbackCsv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiFetch<{ data: NonNullable<typeof agentOutput> }>('/api/ai/agent-loop', {
        method: 'POST',
        body: JSON.stringify({
          goal,
          provider: selectedProvider,
          model: selectedModel,
          fallbackChain: chain,
          maxSteps: 6,
        }),
      });
      setAgentOutput(res.data);
      refetch();
      toast.success(`Completed ${res.data.steps.length} agent step(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Agent loop failed');
    } finally {
      setRunningAgent(false);
    }
  }

  async function handleTestProvider(providerId: string) {
    setTestingProviderId(providerId);
    try {
      const res = await apiFetch<{
        data: { ok: boolean; provider: string; model?: string; reply?: string; latencyMs: number; error?: string };
      }>('/api/ai/free-hub', {
        method: 'POST',
        body: JSON.stringify({ action: 'test-provider', provider: providerId }),
      });
      refetch();
      if (res.data.ok) {
        toast.success(`${providerId} online (${res.data.latencyMs}ms): ${res.data.reply}`);
      } else {
        toast.info(`${providerId}: ${res.data.error}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingProviderId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">100% Free AI & Autonomous Agent Hub</h1>
            <Badge variant="secondary">$0 Stack · 17 Providers · 11 Live Tools · 23 MCP Servers</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Multi-provider free LLM router (Groq, Gemini, Cerebras, OpenRouter :free, Ollama), ModelDeck RPM/RPD meters, Radiant tool traces & runnable Python/MCP exports.
          </p>
        </div>
        {hub?.activeStatus && (
          <Badge variant={hub.activeStatus.reachable ? 'default' : 'outline'} className="self-start md:self-auto">
            Active Default: {hub.activeStatus.provider} ({hub.activeStatus.status})
          </Badge>
        )}
      </div>

      <Tabs defaultValue="playground" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="playground" className="gap-1.5"><Bot className="h-4 w-4" /> Tool-Calling Agent Loop</TabsTrigger>
          <TabsTrigger value="providers" className="gap-1.5"><Activity className="h-4 w-4" /> 17 Free Providers & Quotas</TabsTrigger>
          <TabsTrigger value="openrouter" className="gap-1.5"><Sparkles className="h-4 w-4" /> OpenRouter :free Explorer</TabsTrigger>
          <TabsTrigger value="stack" className="gap-1.5"><Layers className="h-4 w-4" /> Multimodal, MCP & Hardware</TabsTrigger>
          <TabsTrigger value="code" className="gap-1.5"><Code2 className="h-4 w-4" /> Export agent.py & MCP JSON</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: REAL MULTI-STEP AGENT PLAYGROUND + RADIANT TRACE ── */}
        <TabsContent value="playground" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Autonomous Tool-Calling Agent</CardTitle>
                <CardDescription>Executes real SQLite CRM, Knowledge Wiki RAG, UKVI, Humanizer & UTM tools in a multi-step loop</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Primary Free Provider</Label>
                    <select
                      value={selectedProvider}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSelectedProvider(next);
                        const spec = hub?.providers.find((p) => p.id === next);
                        if (spec) setSelectedModel(spec.defaultModel);
                      }}
                      className="w-full h-9 rounded-md border bg-background px-2.5 text-xs"
                    >
                      {(hub?.providers || []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Model ID</Label>
                    <Input
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Multi-Provider Fallback Chain (429 / offline resilience)</Label>
                  <Input
                    value={fallbackCsv}
                    onChange={(e) => setFallbackCsv(e.target.value)}
                    placeholder="groq,cerebras,openrouter,gemini,ollama"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs">Agent Mission / Prompt</Label>
                  <Textarea rows={5} value={goal} onChange={(e) => setGoal(e.target.value)} className="text-xs" />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'CRM + UKVI Audit',
                      prompt: 'Check workspace metrics, list top CRM leads (score >= 70), and calculate UKVI Outside London CAS funds for £15,000 tuition with £2,500 deposit.',
                    },
                    {
                      label: 'Knowledge Wiki RAG + UTM',
                      prompt: 'Search the Knowledge Wiki for marketing SOPs and generate a clean UTM tracking URL for https://demo-agency.com/launch on LinkedIn.',
                    },
                    {
                      label: 'Save Memory + Copy Audit',
                      prompt: 'Remember in brand_rule memory that we never use AI buzzwords, and audit this copy: "Certainly! Our groundbreaking tapestry delves into seamless synergy."',
                    },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setGoal(preset.prompt)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                <Button className="w-full" onClick={handleRunAgent} disabled={runningAgent}>
                  {runningAgent ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  {runningAgent ? 'Running Multi-Step Agent Loop...' : 'Run Multi-Step Tool Agent'}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Radiant Live Execution Trace & Grounded Answer</CardTitle>
                <CardDescription>
                  {agentOutput
                    ? `Engine: ${agentOutput.provider} (${agentOutput.model}) · ${agentOutput.steps.length} execution step(s)`
                    : 'Inspect every tool call, JSON argument, latency, and database response'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agentOutput ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Step-by-Step Tool Trace
                      </div>
                      {agentOutput.steps.map((s, idx) => (
                        <div key={idx} className="rounded-lg border p-2.5 text-xs space-y-1 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1.5">
                              <Wrench className="h-3.5 w-3.5 text-primary" />
                              Step {s.step}: {s.toolName || s.type}
                            </span>
                            <Badge variant="outline" className="text-[10px]">{s.durationMs}ms</Badge>
                          </div>
                          {s.toolArgs && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              args: {JSON.stringify(s.toolArgs)}
                            </div>
                          )}
                          {s.toolOutput && (
                            <pre className="rounded bg-background p-2 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                              {s.toolOutput}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="rounded-lg border p-4 bg-card space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Final Agent Response
                      </div>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">{agentOutput.answer}</div>
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Click &ldquo;Run Multi-Step Tool Agent&rdquo; to execute real workspace tools and inspect the live Radiant trace.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: 17 FREE LLM PROVIDERS & MODELDECK QUOTA METERS ── */}
        <TabsContent value="providers" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(hub?.providers || []).map((p) => {
              const t = hub?.telemetry.find((m) => m.id === p.id);
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-1.5">
                          {p.name}
                          {p.badge && <Badge variant="secondary" className="text-[10px]">{p.badge}</Badge>}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">{p.limits}</CardDescription>
                      </div>
                      <Badge variant={t?.configured ? 'default' : 'outline'} className="text-[10px]">
                        {t?.configured ? 'Ready' : `Set ${p.envKey}`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="font-mono text-[11px] text-muted-foreground truncate">
                      Default: {p.defaultModel}
                    </div>
                    {t && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>RPM Quota Left: {t.rpmPctLeft}% ({t.rpmUsed}/{t.rpmLimit})</span>
                          <span>RPD Left: {t.rpdPctLeft}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${t.rpmPctLeft}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Tokens: {t.totalTokens}</span>
                          <span>Cache Hits: {t.cacheHits}</span>
                          <span>{t.lastLatencyMs ? `${t.lastLatencyMs}ms` : 'idle'}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={() => handleTestProvider(p.id)}
                        disabled={testingProviderId === p.id}
                      >
                        <Zap className="mr-1 h-3 w-3" />
                        {testingProviderId === p.id ? 'Testing...' : 'Ping'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        asChild
                      >
                        <a href={p.signupUrl} target="_blank" rel="noreferrer">
                          Key <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── TAB 3: OPENROUTER :FREE LIVE EXPLORER ── */}
        <TabsContent value="openrouter" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    OpenRouter `:free` Zero-Cost Model Catalog ({hub?.openRouterFree.count || 0} models · {hub?.openRouterFree.source || 'curated'})
                  </CardTitle>
                  <CardDescription>
                    Every model ending in `:free` costs $0/M input and $0/M output tokens. Click Use to route your agent through it.
                  </CardDescription>
                </div>
                <Input
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  placeholder="Filter qwen, deepseek, gpt-oss, llama..."
                  className="max-w-xs h-8 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {(hub?.openRouterFree.models || [])
                  .filter((m) => !modelFilter || m.id.toLowerCase().includes(modelFilter.toLowerCase()))
                  .map((m) => (
                    <div key={m.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs font-semibold">{m.id}</div>
                        <div className="text-xs text-muted-foreground">{m.strength}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.toolCalling && <Badge variant="secondary" className="text-[10px]">Tools ✅</Badge>}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSelectedProvider('openrouter');
                            setSelectedModel(m.id);
                            toast.success(`Selected ${m.id} for Agent Loop & Code Export`);
                          }}
                        >
                          Use
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: EMBEDDINGS, SPEECH/IMAGE, FRAMEWORKS, 23 MCP SERVERS & HARDWARE ── */}
        <TabsContent value="stack" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-1.5"><Server className="h-4 w-4" /> 23 Free MCP Servers (Click to Toggle in Config)</CardTitle>
                <CardDescription>Plug directly into Claude Desktop, Cursor, LibreChat, Open WebUI, or custom agents</CardDescription>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto space-y-1.5">
                {(hub?.infraAndFrameworks.mcpServers || []).map((mcp) => {
                  const active = selectedMcp.includes(mcp.id);
                  return (
                    <button
                      key={mcp.id}
                      type="button"
                      onClick={() =>
                        setSelectedMcp((prev) =>
                          prev.includes(mcp.id) ? prev.filter((x) => x !== mcp.id) : [...prev, mcp.id],
                        )
                      }
                      className={`w-full text-left rounded border p-2 text-xs flex items-center justify-between ${
                        active ? 'border-primary bg-primary/5' : ''
                      }`}
                    >
                      <div>
                        <span className="font-semibold">{mcp.id}</span>{' '}
                        <span className="font-mono text-[11px] text-muted-foreground">({mcp.pkg})</span>
                        <div className="text-muted-foreground">{mcp.desc}</div>
                      </div>
                      <Badge variant={active ? 'default' : 'outline'} className="text-[10px]">
                        {active ? 'Included' : 'Add'}
                      </Badge>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-1.5"><Cpu className="h-4 w-4" /> Local Ollama Hardware Sizing & Quick-Start Recipes</CardTitle>
                <CardDescription>Pick the right open-weight model for your RAM/VRAM budget</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {(hub?.infraAndFrameworks.hardwareSizing || []).map((hw) => (
                  <div key={hw.tier} className="rounded border p-2.5">
                    <div className="font-semibold">{hw.tier} — <span className="text-muted-foreground font-normal">{hw.notes}</span></div>
                    <div className="font-mono text-[11px] mt-0.5 text-primary">{hw.models}</div>
                  </div>
                ))}
                <div className="pt-2 space-y-1.5">
                  <div className="font-semibold uppercase tracking-wider text-muted-foreground">8 Proven $0 Stack Blueprints</div>
                  {(hub?.infraAndFrameworks.quickStartPaths || []).map((q) => (
                    <div key={q.goal} className="rounded bg-muted/40 p-2">
                      <strong>{q.goal}:</strong> {q.recipe}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Free Embeddings (RAG & Memory)</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                {(hub?.embeddings || []).map((e) => (
                  <div key={e.provider} className="border-b pb-1.5 last:border-0">
                    <div className="font-semibold">{e.provider}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{e.models.join(', ')}</div>
                    <div className="text-emerald-600 text-[11px]">{e.allowance}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Free Whisper STT, Neural TTS & Image</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                {(hub?.multimodal.stt || []).slice(0, 4).map((s) => (
                  <div key={s.service} className="border-b pb-1.5">
                    <div className="font-semibold">STT: {s.service}</div>
                    <div className="text-muted-foreground">{s.models} — {s.allowance}</div>
                  </div>
                ))}
                {(hub?.multimodal.tts || []).slice(0, 3).map((t) => (
                  <div key={t.service} className="border-b pb-1.5 last:border-0">
                    <div className="font-semibold">TTS: {t.service}</div>
                    <div className="text-muted-foreground">{t.notes}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Free Agent Frameworks & Vector Infra</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs max-h-72 overflow-y-auto">
                {(hub?.infraAndFrameworks.frameworks || []).map((f) => (
                  <div key={f.name} className="border-b pb-1 last:border-0">
                    <span className="font-semibold">{f.name}</span> <Badge variant="outline" className="text-[10px]">{f.lang}</Badge>
                    <div className="text-muted-foreground">{f.why}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 5: RUNNABLE CODE EXPORTER ── */}
        <TabsContent value="code" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Production-Ready Free Agent Scripts
                </CardTitle>
                <CardDescription>
                  Pre-configured for <strong>{selectedProvider}</strong> ({selectedModel}) with multi-provider fallback & {selectedMcp.length} MCP servers
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['agentPy', 'agent.py'],
                    ['listFreePy', 'list_free.py'],
                    ['ollamaSetupSh', 'ollama-setup.sh'],
                    ['mcpConfigJson', 'mcp-config.json'],
                  ] as const
                ).map(([k, label]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={activeCodeFile === k ? 'default' : 'outline'}
                    className="h-7 text-xs font-mono"
                    onClick={() => setActiveCodeFile(k)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {codeBundle && (
                <>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(codeBundle[activeCodeFile]);
                        toast.success('Copied script to clipboard');
                      }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const names = {
                          agentPy: 'agent.py',
                          listFreePy: 'list_free.py',
                          ollamaSetupSh: 'ollama-setup.sh',
                          mcpConfigJson: 'mcp-config.json',
                        };
                        const blob = new Blob([codeBundle[activeCodeFile]], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = names[activeCodeFile];
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                  <pre className="rounded-lg border bg-muted/40 p-4 text-xs font-mono overflow-x-auto max-h-[460px]">
                    {codeBundle[activeCodeFile]}
                  </pre>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
