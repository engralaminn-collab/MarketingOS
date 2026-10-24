'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  FolderOpen,
  GitBranch,
  Layers,
  MousePointerClick,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
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
import {
  bestButtonTextColor,
  buildMarketingKit,
  buttonCodeExports,
  contrastRatio,
  DEFAULT_KIT_FORM,
  DIAGRAM_PRESETS,
  exportInteractiveArchifyHtml,
  importDiagramSourceToNodes,
  isCtaButtonData,
  isMarketingDiagramData,
  isMarketingKitData,
  KIT_TYPES,
  normalizeHexColor,
  reimagineSourceContent,
  renderEditorialDiagramSvg,
  safeButtonHref,
  softButtonBackground,
  type CtaButtonData,
  type CtaButtonVariant,
  type MarketingDiagramNode,
  type MarketingDiagramType,
  type MarketingKitForm,
  type MarketingKitType,
} from '@/lib/marketing-studio';

interface SavedStudioAsset {
  id: string;
  title: string;
  type: string;
  body: string | null;
  createdAt: string;
}

const CTA_VARIANTS: Array<{ id: CtaButtonVariant; label: string }> = [
  { id: 'solid', label: 'Solid Primary' },
  { id: 'outline', label: 'Crisp Outline' },
  { id: 'soft', label: 'Soft Tinted' },
  { id: 'ghost', label: 'Minimal Ghost' },
  { id: 'gradient', label: 'Depth Gradient' },
  { id: 'pill-badge', label: 'Announcement Pill + Badge' },
  { id: 'split-arrow', label: 'Split Icon Action' },
  { id: 'subtext-stack', label: 'Two-Line Microcopy CTA' },
  { id: 'glass-editorial', label: 'Editorial Paper Inset' },
  { id: 'brutalist-offset', label: 'Neo-Brutalist Offset' },
  { id: 'minimal-underline', label: 'Editorial Link Rule' },
  { id: 'dual-pair', label: 'Primary + Secondary Pair' },
];

export function MarketingStudioView() {
  const [activeTab, setActiveTab] = useState('kits');

  // ── 1. Marketing Kits (coreyhaines31/marketingskills 52+ skills) ──
  const [kitPillar, setKitPillar] = useState('All');
  const [kitSearch, setKitSearch] = useState('');
  const [kitForm, setKitForm] = useState<MarketingKitForm>({
    ...DEFAULT_KIT_FORM,
    brand: 'North Star Labs',
    product: 'MarketingOS Sovereign Growth Suite',
    audience: 'B2B marketing leads & education consultancies',
    description: 'Run 48 editorial diagrams, 52 campaign playbooks, CRM enrichment, and $0 free AI agents in one workspace.',
    goal: 'Turn high-intent visitors into qualified pipeline without SaaS sprawl',
    offer: 'Launch your free workspace in 5 minutes',
    proof: '71 multi-tenant SQLite tables, 17 free LLM providers, and 116 cataloged integrations',
  });
  const kitResult = useMemo(() => buildMarketingKit(kitForm), [kitForm]);

  const pillars = useMemo(
    () => ['All', ...Array.from(new Set(KIT_TYPES.map((k) => k.pillar)))],
    [],
  );
  const filteredKits = useMemo(() => {
    const q = kitSearch.trim().toLowerCase();
    return KIT_TYPES.filter((k) => {
      if (kitPillar !== 'All' && k.pillar !== kitPillar) return false;
      if (!q) return true;
      return (
        k.label.toLowerCase().includes(q) ||
        k.value.toLowerCase().includes(q) ||
        k.description.toLowerCase().includes(q)
      );
    });
  }, [kitPillar, kitSearch]);

  // ── 2. Editorial Diagrams (cathrynlavery/diagram-design 48 presets + Archify) ──
  const [diagramCategory, setDiagramCategory] = useState('All');
  const [diagramSearch, setDiagramSearch] = useState('');
  const [diagramType, setDiagramType] = useState<MarketingDiagramType>('architecture');
  const [diagramTitle, setDiagramTitle] = useState('Sovereign MarketingOS System Architecture');
  const [diagramAccent, setDiagramAccent] = useState('#bf4520');
  const [diagramTheme, setDiagramTheme] = useState<'editorial-light' | 'monograph-dark'>('editorial-light');
  const [diagramNodes, setDiagramNodes] = useState<MarketingDiagramNode[]>(
    DIAGRAM_PRESETS.find((p) => p.id === 'architecture')?.nodes || DIAGRAM_PRESETS[0].nodes,
  );
  const [importSource, setImportSource] = useState('');
  const [aiDiagramPrompt, setAiDiagramPrompt] = useState('');
  const [generatingDiagram, setGeneratingDiagram] = useState(false);

  const diagramCategories = useMemo(
    () => ['All', ...Array.from(new Set(DIAGRAM_PRESETS.map((p) => p.category)))],
    [],
  );
  const filteredPresets = useMemo(() => {
    const q = diagramSearch.trim().toLowerCase();
    return DIAGRAM_PRESETS.filter((p) => {
      if (diagramCategory !== 'All' && p.category !== diagramCategory) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [diagramCategory, diagramSearch]);

  const renderedSvg = useMemo(
    () =>
      renderEditorialDiagramSvg({
        type: diagramType,
        title: diagramTitle,
        accent: diagramAccent,
        theme: diagramTheme,
        nodes: diagramNodes,
      }),
    [diagramType, diagramTitle, diagramAccent, diagramTheme, diagramNodes],
  );

  // ── 3. Rich CTA Button System (astryx 12 variants + VML + React/Tailwind) ──
  const [cta, setCta] = useState<CtaButtonData>({
    version: 1,
    label: 'Book Strategy Audit',
    href: 'https://demo-agency.com/audit',
    accent: '#bf4520',
    variant: 'solid',
    size: 'standard',
    corners: 'rounded',
    badgeText: 'FREE',
    subtext: 'No credit card · 15-min teardown',
    secondaryLabel: 'Explore Playbooks',
    secondaryHref: '/studio',
  });
  const [ctaCodeTab, setCtaCodeTab] = useState<'html' | 'emailVml' | 'tailwind' | 'reactComponent' | 'cssTokens'>('html');

  const ctaExports = useMemo(() => {
    try {
      return buttonCodeExports(cta);
    } catch {
      return null;
    }
  }, [cta]);

  const wcagInfo = useMemo(() => {
    const norm = normalizeHexColor(cta.accent);
    const fg = cta.variant === 'solid' || cta.variant === 'gradient' || cta.variant === 'split-arrow' || cta.variant === 'subtext-stack' || cta.variant === 'brutalist-offset'
      ? bestButtonTextColor(norm)
      : norm;
    const bg = cta.variant === 'soft' ? softButtonBackground(norm) : cta.variant === 'outline' || cta.variant === 'ghost' || cta.variant === 'minimal-underline' ? '#ffffff' : norm;
    const ratio = contrastRatio(fg, bg) || 1;
    return {
      ratio: ratio.toFixed(2),
      aa: ratio >= 4.5,
      aaa: ratio >= 7.0,
    };
  }, [cta]);

  // ── 4. Reimagine-It Content-Derived HTML Generator ──
  const [reimagineSource, setReimagineSource] = useState(
    `# Sovereign Growth & Admissions Operating System\nReplace 9 disconnected SaaS subscriptions with one self-hosted platform.\n- 48 flat editorial SVG diagram grammars (zero Mermaid slop)\n- 52 structured marketing skill playbooks across CRO, SEO, Copy & RevOps\n- 17 free LLM providers with automatic fallback & local Ollama privacy\n- UKVI 28-day CAS maintenance calculator & counselor pipeline\n\nTeams cut monthly martech spend by 82% while keeping 100% tenant data ownership.\n\n[Start Free Workspace](/studio) [Read Architecture Docs](/knowledge-wiki)`,
  );
  const [reimagineDirectionId, setReimagineDirectionId] = useState<'swiss-editorial' | 'executive-dark' | 'conversion-split'>('swiss-editorial');
  const reimagined = useMemo(
    () => reimagineSourceContent(reimagineSource, diagramAccent),
    [reimagineSource, diagramAccent],
  );
  const activeDirection = reimagined.directions.find((d) => d.id === reimagineDirectionId) || reimagined.directions[0];

  // ── 5. Humanizer + LanguageTool Copy Polish Studio ──
  const [copyInput, setCopyInput] = useState(
    `Certainly! In today's fast-paced digital landscape, our cutting-edge platform doesn't just streamline workflows — it's a pivotal testament to seamless synergy, underscoring our holistic approach. Furthermore, studies show that teams could potentially leverage this game-changing solution in order to delve into new realms of growth!!`,
  );
  const [copyTone, setCopyTone] = useState('natural');
  const [humanizeResult, setHumanizeResult] = useState<{
    humanizedText: string;
    aiScoreBefore: number;
    aiScoreAfter: number;
    detectedTells: Array<{ id: string; category: string; rule: string; matches: string[]; severity: string }>;
  } | null>(null);
  const [grammarResult, setGrammarResult] = useState<{
    correctedText: string;
    issues: Array<{ original: string; suggestion: string; reason: string; category: string }>;
    readability: { words: number; sentences: number; avgWordsPerSentence: number; gradeLevel: number };
  } | null>(null);
  const [polishing, setPolishing] = useState(false);

  // ── 6. Saved Studio Library (/api/content) ──
  const { data: contentResp, refetch: refetchLibrary } = useApiQuery<{ content: SavedStudioAsset[] }>('/api/content');
  const studioAssets = useMemo(
    () =>
      (contentResp?.content || []).filter((c) =>
        ['marketing_kit', 'marketing_diagram', 'cta_button', 'reimagined_html'].includes(c.type),
      ),
    [contentResp],
  );

  async function saveAsset(title: string, type: string, payload: unknown) {
    try {
      await apiFetch('/api/content', {
        method: 'POST',
        body: JSON.stringify({
          title,
          type,
          status: 'draft',
          body: typeof payload === 'string' ? payload : JSON.stringify(payload),
        }),
      });
      toast.success(`Saved "${title}" to Content Library`);
      refetchLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save asset');
    }
  }

  function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPng2x() {
    const img = new Image();
    const svgBlob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = diagramType === 'service_blueprint' ? 940 : 860;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${diagramType}-2x.png`;
        a.click();
      }
      URL.revokeObjectURL(url);
      toast.success('Exported 2x Retina PNG (1920px)');
    };
    img.src = url;
  }

  async function handleGenerateDiagramAi() {
    if (!aiDiagramPrompt.trim()) return;
    setGeneratingDiagram(true);
    try {
      const res = await apiFetch<{ data: { mermaid: string; generationMode: string } }>('/api/ai/diagram', {
        method: 'POST',
        body: JSON.stringify({ prompt: aiDiagramPrompt, type: 'flowchart' }),
      });
      const imported = importDiagramSourceToNodes(res.data.mermaid);
      setDiagramNodes(imported.nodes);
      setDiagramTitle(aiDiagramPrompt.slice(0, 64));
      toast.success(`Generated ${imported.nodes.length} diagram nodes (${res.data.generationMode})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Diagram generation failed');
    } finally {
      setGeneratingDiagram(false);
    }
  }

  async function handleHumanizeAndGrammar() {
    if (!copyInput.trim()) return;
    setPolishing(true);
    try {
      const [hRes, gRes] = await Promise.all([
        apiFetch<{ data: NonNullable<typeof humanizeResult> }>('/api/ai/humanize', {
          method: 'POST',
          body: JSON.stringify({ text: copyInput, tone: copyTone }),
        }),
        apiFetch<{ data: NonNullable<typeof grammarResult> }>('/api/ai/grammar-check', {
          method: 'POST',
          body: JSON.stringify({ text: copyInput }),
        }),
      ]);
      setHumanizeResult(hRes.data);
      setGrammarResult(gRes.data);
      toast.success(`AI-tell score reduced from ${hRes.data.aiScoreBefore} → ${hRes.data.aiScoreAfter}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Copy check failed');
    } finally {
      setPolishing(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Marketing & Editorial Design Studio</h1>
            <Badge variant="secondary">48 Diagrams · 60+ Skill Kits · 12 CTAs</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by coreyhaines31/marketingskills, cathrynlavery/diagram-design, tt-a1i/archify, Kayforkind/reimagine-it & blader/humanizer.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="kits" className="gap-1.5"><Layers className="h-4 w-4" /> 52+ Marketing Kits</TabsTrigger>
          <TabsTrigger value="diagrams" className="gap-1.5"><GitBranch className="h-4 w-4" /> 48 Editorial Diagrams</TabsTrigger>
          <TabsTrigger value="buttons" className="gap-1.5"><MousePointerClick className="h-4 w-4" /> 12-Style CTA System</TabsTrigger>
          <TabsTrigger value="reimagine" className="gap-1.5"><FileCode2 className="h-4 w-4" /> Reimagine-It HTML</TabsTrigger>
          <TabsTrigger value="humanizer" className="gap-1.5"><Wand2 className="h-4 w-4" /> Humanizer & Grammar</TabsTrigger>
          <TabsTrigger value="library" className="gap-1.5"><FolderOpen className="h-4 w-4" /> Saved Assets ({studioAssets.length})</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: 52+ MARKETING SKILL KITS ── */}
        <TabsContent value="kits" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Select Marketing Skill Playbook ({filteredKits.length})</CardTitle>
                <CardDescription>Full coreyhaines31/marketingskills catalog across 8 GTM pillars</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={kitSearch}
                    onChange={(e) => setKitSearch(e.target.value)}
                    placeholder="Search CRO, cold email, programmatic SEO, pricing..."
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pillars.map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={kitPillar === p ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setKitPillar(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-md border p-2">
                  {filteredKits.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKitForm((prev) => ({ ...prev, type: k.value }))}
                      className={`w-full text-left rounded-md px-3 py-2 text-xs transition ${
                        kitForm.type === k.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{k.label}</span>
                        <span className="opacity-75 text-[10px]">{k.pillar}</span>
                      </div>
                      <div className="opacity-80 mt-0.5 line-clamp-1">{k.description}</div>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Brand</Label>
                    <Input value={kitForm.brand} onChange={(e) => setKitForm({ ...kitForm, brand: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Product / Offer Subject</Label>
                    <Input value={kitForm.product} onChange={(e) => setKitForm({ ...kitForm, product: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Target Audience / ICP</Label>
                    <Input value={kitForm.audience} onChange={(e) => setKitForm({ ...kitForm, audience: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Problem & Approach</Label>
                    <Textarea rows={2} value={kitForm.description} onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Primary Outcome Goal</Label>
                    <Input value={kitForm.goal} onChange={(e) => setKitForm({ ...kitForm, goal: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Specific CTA / Offer</Label>
                    <Input value={kitForm.offer} onChange={(e) => setKitForm({ ...kitForm, offer: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Verified Evidence / Proof Point</Label>
                    <Input value={kitForm.proof} onChange={(e) => setKitForm({ ...kitForm, proof: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">{kitResult.outputs.heroHeadline}</CardTitle>
                  <CardDescription>{kitResult.outputs.positioning}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const md = `# ${kitResult.outputs.heroHeadline}\n\n${kitResult.outputs.heroSubhead}\n\n## Skill Execution Checklist\n${(kitResult.outputs.skillPlaybook || []).map((s) => `- [ ] ${s}`).join('\n')}\n\n## Email Draft\nSubject: ${kitResult.outputs.emailSubject}\n\n${kitResult.outputs.emailBody}\n\n## LinkedIn\n${kitResult.outputs.linkedinPost}\n\n## Primary KPI\n${kitResult.outputs.primaryKpi}\n\n## Guardrails\n${kitResult.outputs.guardrails.map((g) => `- ${g}`).join('\n')}\n`;
                      downloadFile(`${kitForm.type}-kit.md`, md, 'text/markdown');
                    }}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> .MD
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveAsset(`Kit: ${kitForm.product} (${kitForm.type})`, 'marketing_kit', kitResult)}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" /> Save Kit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 p-3 text-xs">
                  <strong>Claim & Measurement Safeguard:</strong> {kitResult.outputs.reviewNote}
                </div>

                {kitResult.outputs.skillPlaybook && (
                  <div className="rounded-lg border p-3.5 space-y-2">
                    <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Skill Execution Checklist ({kitForm.type})
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      {kitResult.outputs.skillPlaybook.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">HERO & VALUE PROPOSITION</div>
                    <div className="font-semibold">{kitResult.outputs.heroHeadline}</div>
                    <p className="text-xs text-muted-foreground">{kitResult.outputs.heroSubhead}</p>
                    <Badge variant="outline">{kitResult.outputs.primaryCta}</Badge>
                  </div>
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">KPI & GUARDRAILS</div>
                    <div className="text-xs font-medium">{kitResult.outputs.primaryKpi}</div>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
                      {kitResult.outputs.guardrails.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">EMAIL SEQUENCE STARTER</div>
                    <div className="text-xs font-semibold">Subject: {kitResult.outputs.emailSubject}</div>
                    <pre className="whitespace-pre-wrap text-xs font-sans text-muted-foreground">{kitResult.outputs.emailBody}</pre>
                  </div>
                  <div className="rounded-lg border p-3 space-y-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">LINKEDIN & PAID AD COPY</div>
                    <pre className="whitespace-pre-wrap text-xs font-sans text-muted-foreground">{kitResult.outputs.linkedinPost}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: 48 EDITORIAL SVG DIAGRAMS + ARCHIFY ── */}
        <TabsContent value="diagrams" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">48 Editorial Diagram Grammars</CardTitle>
                <CardDescription>Flat editorial HTML+SVG (zero drop-shadow slop) + Mermaid/Draw.io/Excalidraw import</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={diagramSearch}
                  onChange={(e) => setDiagramSearch(e.target.value)}
                  placeholder="Filter 48 types (sankey, wardley, swimlane, er, gantt...)"
                />
                <div className="flex flex-wrap gap-1">
                  {diagramCategories.map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant={diagramCategory === c ? 'default' : 'outline'}
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setDiagramCategory(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 rounded border p-1.5">
                  {filteredPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setDiagramType(p.id);
                        setDiagramTitle(p.title);
                        setDiagramNodes(p.nodes);
                      }}
                      className={`w-full text-left rounded px-2.5 py-1.5 text-xs ${
                        diagramType === p.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      <span className="font-semibold">{p.title}</span>{' '}
                      <span className="opacity-70 text-[10px]">({p.id})</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Brand Accent Hex</Label>
                    <Input value={diagramAccent} onChange={(e) => setDiagramAccent(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Editorial Palette</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() =>
                        setDiagramTheme((t) => (t === 'editorial-light' ? 'monograph-dark' : 'editorial-light'))
                      }
                    >
                      {diagramTheme === 'editorial-light' ? 'Paper Light (#FAFAF7)' : 'Monograph Dark (#0F1115)'}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Diagram Title</Label>
                  <Input value={diagramTitle} onChange={(e) => setDiagramTitle(e.target.value)} />
                </div>

                <div className="rounded-md border p-2.5 space-y-2 bg-muted/30">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Prompt → Diagram Nodes
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={aiDiagramPrompt}
                      onChange={(e) => setAiDiagramPrompt(e.target.value)}
                      placeholder="e.g. UKVI Student CAS 5-step intake pipeline"
                      className="text-xs"
                    />
                    <Button size="sm" onClick={handleGenerateDiagramAi} disabled={generatingDiagram}>
                      {generatingDiagram ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Generate'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border p-2.5 space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Import Mermaid / .drawio XML / .excalidraw JSON
                  </Label>
                  <Textarea
                    rows={2}
                    value={importSource}
                    onChange={(e) => setImportSource(e.target.value)}
                    placeholder="Paste Mermaid flowchart, Draw.io XML, Excalidraw JSON, or 'Step: Detail' lines..."
                    className="text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs"
                    onClick={() => {
                      const imported = importDiagramSourceToNodes(importSource);
                      setDiagramNodes(imported.nodes);
                      toast.success(`Imported ${imported.nodes.length} nodes (${imported.detectedFormat})`);
                    }}
                  >
                    Convert to Editorial SVG
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-8">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Live Editorial Vector Canvas</CardTitle>
                  <CardDescription>Export clean SVG, 2x Retina PNG, or interactive clickable Archify HTML</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => downloadFile(`${diagramType}.svg`, renderedSvg, 'image/svg+xml')}>
                    <Download className="mr-1 h-3.5 w-3.5" /> SVG
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportPng2x}>
                    <Download className="mr-1 h-3.5 w-3.5" /> 2x PNG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const html = exportInteractiveArchifyHtml({
                        type: diagramType,
                        title: diagramTitle,
                        accent: diagramAccent,
                        theme: diagramTheme,
                        nodes: diagramNodes,
                      });
                      downloadFile(`${diagramType}-interactive.html`, html, 'text/html');
                      toast.success('Exported clickable Archify standalone HTML');
                    }}
                  >
                    <Code2 className="mr-1 h-3.5 w-3.5" /> Archify HTML
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      saveAsset(diagramTitle, 'marketing_diagram', {
                        version: 1,
                        type: diagramType,
                        title: diagramTitle,
                        accent: normalizeHexColor(diagramAccent),
                        theme: diagramTheme,
                        nodes: diagramNodes,
                      })
                    }
                  >
                    <Save className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="w-full overflow-x-auto rounded-lg border p-2"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Semantic Nodes ({diagramNodes.length})</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        setDiagramNodes((prev) =>
                          prev.length < 10 ? [...prev, { title: `Stage ${prev.length + 1}`, detail: 'Key outcome or system role' }] : prev,
                        )
                      }
                    >
                      + Add Node
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {diagramNodes.map((n, idx) => (
                      <div key={idx} className="rounded border p-2 flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <Input
                            value={n.title}
                            onChange={(e) => {
                              const copy = [...diagramNodes];
                              copy[idx] = { ...copy[idx], title: e.target.value };
                              setDiagramNodes(copy);
                            }}
                            className="h-7 text-xs font-semibold"
                            placeholder="Node title"
                          />
                          <Input
                            value={n.metric || ''}
                            onChange={(e) => {
                              const copy = [...diagramNodes];
                              copy[idx] = { ...copy[idx], metric: e.target.value };
                              setDiagramNodes(copy);
                            }}
                            className="h-7 w-24 text-xs"
                            placeholder="Metric %"
                          />
                          {diagramNodes.length > 2 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => setDiagramNodes(diagramNodes.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <Input
                          value={n.detail}
                          onChange={(e) => {
                            const copy = [...diagramNodes];
                            copy[idx] = { ...copy[idx], detail: e.target.value };
                            setDiagramNodes(copy);
                          }}
                          className="h-7 text-xs"
                          placeholder="Detail / description"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 3: 12-VARIANT CTA BUTTON SYSTEM ── */}
        <TabsContent value="buttons" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">CTA Button Design System (12 Styles)</CardTitle>
                <CardDescription>WCAG contrast verification + HTML, Outlook VML, Tailwind, React & CSS token export</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5">
                  {CTA_VARIANTS.map((v) => (
                    <Button
                      key={v.id}
                      type="button"
                      size="sm"
                      variant={cta.variant === v.id ? 'default' : 'outline'}
                      className="justify-start text-xs h-8"
                      onClick={() => setCta({ ...cta, variant: v.id })}
                    >
                      {v.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Primary Label</Label>
                    <Input value={cta.label} onChange={(e) => setCta({ ...cta, label: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Safe Destination URL</Label>
                    <Input value={cta.href} onChange={(e) => setCta({ ...cta, href: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Brand Accent Hex</Label>
                    <Input value={cta.accent} onChange={(e) => setCta({ ...cta, accent: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Corner Geometry</Label>
                    <div className="flex gap-1 mt-1">
                      {(['square', 'rounded', 'pill'] as const).map((c) => (
                        <Button
                          key={c}
                          size="sm"
                          variant={cta.corners === c ? 'default' : 'outline'}
                          className="flex-1 text-xs h-8"
                          onClick={() => setCta({ ...cta, corners: c })}
                        >
                          {c}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {cta.variant === 'pill-badge' && (
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Badge Pill Text</Label>
                      <Input value={cta.badgeText || ''} onChange={(e) => setCta({ ...cta, badgeText: e.target.value })} />
                    </div>
                  )}
                  {cta.variant === 'subtext-stack' && (
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Reassurance Subtext</Label>
                      <Input value={cta.subtext || ''} onChange={(e) => setCta({ ...cta, subtext: e.target.value })} />
                    </div>
                  )}
                  {cta.variant === 'dual-pair' && (
                    <>
                      <div>
                        <Label className="text-xs">Secondary CTA Label</Label>
                        <Input value={cta.secondaryLabel || ''} onChange={(e) => setCta({ ...cta, secondaryLabel: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Secondary Href</Label>
                        <Input value={cta.secondaryHref || ''} onChange={(e) => setCta({ ...cta, secondaryHref: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Live Preview & Production Code</CardTitle>
                  <CardDescription>
                    Contrast Ratio: <strong>{wcagInfo.ratio}:1</strong> · WCAG AA {wcagInfo.aa ? '✅ Pass' : '⚠️ Low'} · AAA {wcagInfo.aaa ? '✅ Pass' : '—'}
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => saveAsset(`CTA: ${cta.label}`, 'cta_button', cta)}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Save CTA
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-[#FAFAF7] p-8 flex items-center justify-center">
                    {ctaExports ? (
                      <div dangerouslySetInnerHTML={{ __html: ctaExports.html }} />
                    ) : (
                      <span className="text-xs text-destructive">Unsafe URL blocked (use https://, /, or mailto:)</span>
                    )}
                  </div>
                  <div className="rounded-lg border bg-[#0F1115] p-8 flex items-center justify-center">
                    {ctaExports ? <div dangerouslySetInnerHTML={{ __html: ctaExports.html }} /> : null}
                  </div>
                </div>

                {ctaExports && safeButtonHref(cta.href) && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ['html', 'Clean HTML'],
                          ['emailVml', 'Outlook Email VML'],
                          ['tailwind', 'Tailwind JSX'],
                          ['reactComponent', 'React Component'],
                          ['cssTokens', 'CSS Tokens'],
                        ] as const
                      ).map(([key, label]) => (
                        <Button
                          key={key}
                          size="sm"
                          variant={ctaCodeTab === key ? 'default' : 'outline'}
                          className="h-7 text-xs"
                          onClick={() => setCtaCodeTab(key)}
                        >
                          {label}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs ml-auto"
                        onClick={() => {
                          navigator.clipboard.writeText(ctaExports[ctaCodeTab]);
                          toast.success('Copied CTA code to clipboard');
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                    <pre className="rounded-lg border bg-muted/40 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {ctaExports[ctaCodeTab]}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 4: REIMAGINE-IT CONTENT-DERIVED HTML GENERATOR ── */}
        <TabsContent value="reimagine" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reimagine-It Source Brief</CardTitle>
                <CardDescription>
                  &ldquo;The source file is the design brief.&rdquo; Extracts real headings, metrics & links without invented filler.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={11}
                  value={reimagineSource}
                  onChange={(e) => setReimagineSource(e.target.value)}
                  className="text-xs font-mono"
                />
                <div className="rounded-md border p-3 text-xs space-y-1 bg-muted/20">
                  <div className="font-semibold">Extracted Source Inventory:</div>
                  <div>• Headings: {reimagined.extractedBrief.headings.length}</div>
                  <div>• Verified Bullets / Metrics: {reimagined.extractedBrief.factsAndMetrics.length}</div>
                  <div>• Links Preserved: {reimagined.extractedBrief.links.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {reimagined.directions.map((d) => (
                    <Button
                      key={d.id}
                      size="sm"
                      variant={reimagineDirectionId === d.id ? 'default' : 'outline'}
                      className="text-xs"
                      onClick={() => setReimagineDirectionId(d.id)}
                    >
                      {d.name.split('·')[1]?.trim() || d.name}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(`reimagined-${activeDirection.id}.html`, activeDirection.html, 'text/html')}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> .HTML
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveAsset(`Reimagined: ${reimagined.extractedBrief.title}`, 'reimagined_html', activeDirection.html)}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{activeDirection.rationale}</p>
                <iframe
                  title={activeDirection.name}
                  sandbox=""
                  srcDoc={activeDirection.html}
                  className="w-full h-[420px] rounded-lg border bg-white"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 5: HUMANIZER & LANGUAGETOOL GRAMMAR STUDIO ── */}
        <TabsContent value="humanizer" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">AI-Tell Detector & Humanizer (blader/humanizer + LanguageTool)</CardTitle>
                <CardDescription>Audits 24 structural & lexical AI writing tells while preserving every fact, number & link</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={8}
                  value={copyInput}
                  onChange={(e) => setCopyInput(e.target.value)}
                  placeholder="Paste AI-generated blog, cold email, or landing page copy..."
                />
                <div className="flex flex-wrap items-center gap-2">
                  {(['natural', 'conversational', 'executive', 'concise'] as const).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={copyTone === t ? 'default' : 'outline'}
                      className="text-xs capitalize"
                      onClick={() => setCopyTone(t)}
                    >
                      {t}
                    </Button>
                  ))}
                  <Button size="sm" className="ml-auto" onClick={handleHumanizeAndGrammar} disabled={polishing}>
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    {polishing ? 'Auditing...' : 'Audit & Humanize Copy'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Diagnostic & Rewritten Output</CardTitle>
                <CardDescription>
                  {humanizeResult
                    ? `AI Slop Score: ${humanizeResult.aiScoreBefore}/100 → ${humanizeResult.aiScoreAfter}/100 · Readability Grade ${grammarResult?.readability.gradeLevel ?? '—'}`
                    : 'Run Audit & Humanize to inspect flagged patterns'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {humanizeResult ? (
                  <>
                    <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 p-3 text-sm whitespace-pre-wrap">
                      {humanizeResult.humanizedText}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCopyInput(humanizeResult.humanizedText);
                          toast.success('Replaced editor draft with humanized copy');
                        }}
                      >
                        Apply Rewrite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(humanizeResult.humanizedText);
                          toast.success('Copied humanized text');
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                    {humanizeResult.detectedTells.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-muted-foreground">FLAGGED AI TELLS ({humanizeResult.detectedTells.length})</div>
                        {humanizeResult.detectedTells.map((t) => (
                          <div key={t.id} className="rounded border p-2 text-xs">
                            <div className="font-semibold">{t.category}: {t.rule}</div>
                            <div className="text-muted-foreground">Matched: {t.matches.join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {grammarResult && grammarResult.issues.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-muted-foreground">GRAMMAR & CLARITY ({grammarResult.issues.length})</div>
                        {grammarResult.issues.map((iss, idx) => (
                          <div key={idx} className="rounded border p-2 text-xs">
                            <span className="line-through text-destructive mr-1.5">{iss.original}</span>
                            <span className="font-semibold text-emerald-600">→ {iss.suggestion}</span>
                            <span className="text-muted-foreground ml-2">({iss.reason})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Click &ldquo;Audit &amp; Humanize Copy&rdquo; to detect AI vocabulary, negative parallelisms, puffery, and grammar issues.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 6: SAVED STUDIO LIBRARY ── */}
        <TabsContent value="library">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved Marketing Studio Assets</CardTitle>
              <CardDescription>Click Load to restore any saved kit, editorial diagram, CTA button, or reimagined page</CardDescription>
            </CardHeader>
            <CardContent>
              {studioAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No studio assets saved yet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {studioAssets.map((asset) => (
                    <div key={asset.id} className="rounded-lg border p-3 flex flex-col justify-between gap-2">
                      <div>
                        <Badge variant="outline" className="mb-1 text-[10px]">{asset.type}</Badge>
                        <div className="font-semibold text-sm">{asset.title}</div>
                        <div className="text-xs text-muted-foreground">{new Date(asset.createdAt).toLocaleDateString()}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (!asset.body) return;
                          if (asset.type === 'reimagined_html') {
                            setReimagineSource(asset.body);
                            setActiveTab('reimagine');
                            return;
                          }
                          try {
                            const parsed = JSON.parse(asset.body);
                            if (isMarketingKitData(parsed)) {
                              setKitForm(parsed.form as MarketingKitForm);
                              setActiveTab('kits');
                            } else if (isMarketingDiagramData(parsed)) {
                              setDiagramType(parsed.type as MarketingDiagramType);
                              setDiagramTitle(parsed.title);
                              setDiagramAccent(parsed.accent);
                              setDiagramNodes(parsed.nodes);
                              setActiveTab('diagrams');
                            } else if (isCtaButtonData(parsed)) {
                              setCta(parsed);
                              setActiveTab('buttons');
                            }
                            toast.success(`Loaded "${asset.title}"`);
                          } catch {
                            toast.error('Stored asset format could not be parsed');
                          }
                        }}
                      >
                        Load into Studio
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MarketingStudioView;
