'use client';

import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Brain,
  FileSearch,
  GitFork,
  Minimize2,
  Plus,
  Save,
  Send,
  Trash2,
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

interface WikiNode {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  nodeType: string;
  tags: string[];
  wikiLinks: string[];
  updatedAt: string;
}

interface WikiPayload {
  nodes: WikiNode[];
  edges: Array<{ from: string; to: string; label: string }>;
  sops: Array<{ id: string; sopId: string; title: string; category: string; purpose: string }>;
  memories: Array<{ id: string; agentType: string; category: string; title: string; content: string; createdAt: string }>;
}

export default function KnowledgeWikiView() {
  const { data: resp, refetch } = useApiQuery<any>('/api/knowledge/wiki');
  const wiki: WikiPayload | undefined = resp?.data ?? resp;

  // Wiki page editor
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('Brand Positioning & Zero-Slop Editorial Guide');
  const [category, setCategory] = useState('marketing-playbook');
  const [content, setContent] = useState(
    `# Brand Positioning & Editorial Standards\n\nLink related pages with bi-directional WikiLinks such as [[UKVI Student Intake Playbook]] and [[Outbound Cold Email SOP]].\n\n## Core Principles\n- Ground every headline in concrete buyer outcomes and verified metrics.\n- Route routine agent tasks through $0 free endpoints before escalating.\n- Enforce 28-day financial compliance checks on all UKVI CAS advisories.`,
  );
  const [savingPage, setSavingPage] = useState(false);

  // RAG Q&A
  const [ragQuestion, setRagQuestion] = useState('What are our core brand positioning principles and SOPs?');
  const [ragResult, setRagResult] = useState<{
    answer: string;
    mode: string;
    embeddingProvider: string;
    citations: Array<{ id: string; title: string; source: string; score: number; excerpt: string }>;
  } | null>(null);
  const [askingRag, setAskingRag] = useState(false);

  // Memory bank (/api/ai/memory)
  const [memCategory, setMemCategory] = useState('hindsight_lesson');
  const [memContent, setMemContent] = useState('');

  // Context Compressor (/api/ai/context)
  const [rawContext, setRawContext] = useState(
    `Session log 01: Crawled 18 competitor landing pages across CRM and admissions categories. Note: Generic hero headlines ("Unlock the future of synergy") converted poorly in A/B tests, while concrete time-to-value headlines ("Launch multi-channel CRM + $0 AI agents in 5 minutes") increased demo requests by 38%. Session log 02: Email deliverability remained at 99.2% when daily cold volume per domain stayed below 45 plain-text messages with valid SPF, DKIM, and DMARC policies. Session log 03: UKVI London maintenance requirement stands at £1,334/month for up to 9 months (£12,006 total) plus remaining first-year tuition held for 28 consecutive days.`,
  );
  const [compressedResult, setCompressedResult] = useState<{
    compressed: string;
    originalTokensEst: number;
    compressedTokensEst: number;
    savedPercent: number;
  } | null>(null);

  const graphSvg = useMemo(() => {
    const nodes = (wiki?.nodes || []).slice(0, 14);
    if (!nodes.length) return '';
    const w = 780;
    const h = 340;
    const cx = w / 2;
    const cy = h / 2;
    const r = 120;
    const coords = new Map<string, { x: number; y: number; title: string }>();
    nodes.forEach((n, idx) => {
      const angle = (idx / nodes.length) * Math.PI * 2 - Math.PI / 2;
      coords.set(n.id, {
        x: Math.round(cx + Math.cos(angle) * (r + (idx % 2) * 34)),
        y: Math.round(cy + Math.sin(angle) * r),
        title: n.title,
      });
    });

    const edgeLines = (wiki?.edges || [])
      .map((e) => {
        const a = coords.get(e.from);
        const b = coords.get(e.to);
        if (!a || !b) return '';
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#bf4520" stroke-width="1.4" stroke-opacity="0.65"/>`;
      })
      .join('');

    const nodeCircles = Array.from(coords.entries())
      .map(
        ([id, pt]) => `<g>
          <circle cx="${pt.x}" cy="${pt.y}" r="8" fill="${id === selectedId ? '#bf4520' : '#2563eb'}"/>
          <text x="${pt.x}" y="${pt.y + 20}" text-anchor="middle" font-size="10.5" fill="#334155" font-family="Inter,sans-serif">${pt.title.slice(0, 22).replace(/[<>&]/g, '')}</text>
        </g>`,
      )
      .join('');

    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="background:#fafaf7;border-radius:8px">${edgeLines}${nodeCircles}</svg>`;
  }, [wiki, selectedId]);

  async function handleSaveWikiPage() {
    if (!title.trim() || !content.trim()) return;
    setSavingPage(true);
    try {
      await apiFetch('/api/knowledge/wiki', {
        method: 'POST',
        body: JSON.stringify({
          id: selectedId,
          title,
          category,
          content,
        }),
      });
      toast.success(selectedId ? 'Updated Wiki page & embeddings' : 'Created Wiki page & indexed [[WikiLinks]]');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPage(false);
    }
  }

  async function handleAskRag() {
    if (!ragQuestion.trim()) return;
    setAskingRag(true);
    try {
      const res = await apiFetch<{ data: NonNullable<typeof ragResult> }>('/api/knowledge/wiki', {
        method: 'POST',
        body: JSON.stringify({ action: 'ask', question: ragQuestion }),
      });
      setRagResult(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'RAG search failed');
    } finally {
      setAskingRag(false);
    }
  }

  async function handleStoreMemory() {
    if (!memContent.trim()) return;
    try {
      await apiFetch('/api/ai/memory', {
        method: 'POST',
        body: JSON.stringify({
          agentType: 'workspace',
          category: memCategory,
          content: memContent,
        }),
      });
      setMemContent('');
      refetch();
      toast.success('Stored durable agent memory');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not store memory');
    }
  }

  async function handleCompress() {
    try {
      const res = await apiFetch<{ data: NonNullable<typeof compressedResult> }>('/api/ai/context', {
        method: 'POST',
        body: JSON.stringify({ text: rawContext, maxSentences: 3 }),
      });
      setCompressedResult(res.data);
      toast.success(`Saved ${res.data.savedPercent}% context window tokens`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Compression failed');
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Wiki, Agent Memory & Context Studio</h1>
          <Badge variant="secondary">[[WikiLinks]] · Cited RAG · Hindsight Memory · Context-Mode</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Persistent Markdown knowledge base (llm_wiki / SiYuan), cited vector RAG (docGPT), episodic/procedural memory (OpenViking / Hindsight), and context-window compression.
        </p>
      </div>

      <Tabs defaultValue="wiki" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="wiki" className="gap-1.5"><BookOpen className="h-4 w-4" /> [[Wiki]] Pages ({wiki?.nodes.length || 0})</TabsTrigger>
          <TabsTrigger value="graph" className="gap-1.5"><GitFork className="h-4 w-4" /> Knowledge Graph & SOPs</TabsTrigger>
          <TabsTrigger value="rag" className="gap-1.5"><FileSearch className="h-4 w-4" /> Cited RAG Q&A</TabsTrigger>
          <TabsTrigger value="memory" className="gap-1.5"><Brain className="h-4 w-4" /> Agent Memory ({wiki?.memories.length || 0})</TabsTrigger>
          <TabsTrigger value="context" className="gap-1.5"><Minimize2 className="h-4 w-4" /> Context Compressor</TabsTrigger>
        </TabsList>

        <TabsContent value="wiki">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Workspace Pages</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSelectedId(null);
                    setTitle('');
                    setContent('# New Knowledge Page\n\nReference [[Another Page]] to link nodes.');
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> New
                </Button>
              </CardHeader>
              <CardContent className="max-h-[460px] overflow-y-auto space-y-1.5">
                {(wiki?.nodes || []).map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-md border p-2.5 text-xs cursor-pointer transition ${
                      selectedId === n.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedId(n.id);
                      setTitle(n.title);
                      setCategory(n.category);
                      setContent(n.content);
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold truncate">{n.title}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          apiFetch(`/api/knowledge/wiki?id=${encodeURIComponent(n.id)}`, { method: 'DELETE' })
                            .then(() => {
                              toast.success('Deleted page');
                              refetch();
                            })
                            .catch(() => toast.error('Delete failed'));
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-muted-foreground line-clamp-2 mt-0.5">{n.summary}</div>
                    {n.wikiLinks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {n.wikiLinks.map((lk) => (
                          <Badge key={lk} variant="secondary" className="text-[10px]">[[{lk}]]</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-8">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">{selectedId ? 'Edit Wiki Node' : 'Create Wiki Node'}</CardTitle>
                  <CardDescription>Use `[[Page Title]]` syntax to build automatic knowledge graph links & semantic embeddings</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveWikiPage} disabled={savingPage}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> {savingPage ? 'Indexing...' : 'Save & Embed'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Page Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Markdown Body (with [[WikiLinks]])</Label>
                  <Textarea rows={13} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-xs" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="graph">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Knowledge Graph Topology</CardTitle>
                <CardDescription>{wiki?.nodes.length || 0} nodes · {wiki?.edges.length || 0} [[WikiLink]] edges</CardDescription>
              </CardHeader>
              <CardContent>
                {graphSvg ? (
                  <div className="border rounded-lg overflow-hidden" dangerouslySetInnerHTML={{ __html: graphSvg }} />
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">Create Wiki pages to visualize graph topology.</p>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Standard Operating Procedures ({wiki?.sops.length || 0})</CardTitle>
                <CardDescription>Automatically included in RAG & Workforce retrieval</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {(wiki?.sops || []).map((s) => (
                  <div key={s.id} className="rounded border p-2.5 text-xs">
                    <div className="font-semibold">{s.sopId} · {s.title}</div>
                    <div className="text-muted-foreground mt-0.5">{s.purpose}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rag">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cited Knowledge Wiki & SOP RAG</CardTitle>
              <CardDescription>Hybrid semantic vector + lexical retrieval across all workspace knowledge nodes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  placeholder="Ask any question about your brand rules, SOPs, campaigns, or playbooks..."
                />
                <Button onClick={handleAskRag} disabled={askingRag}>
                  <Send className="mr-1.5 h-4 w-4" /> {askingRag ? 'Searching...' : 'Ask Wiki'}
                </Button>
              </div>
              {ragResult && (
                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7 rounded-lg border p-4 space-y-2">
                    <Badge variant="secondary">{ragResult.mode} · {ragResult.embeddingProvider}</Badge>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{ragResult.answer}</div>
                  </div>
                  <div className="lg:col-span-5 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Supporting Citations</div>
                    {ragResult.citations.map((c) => (
                      <div key={c.id} className="rounded border p-2.5 text-xs">
                        <div className="flex justify-between font-semibold">
                          <span>[[{c.title}]]</span>
                          <Badge variant="outline" className="text-[10px]">sim {c.score}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-3">{c.excerpt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Record Durable Agent Memory</CardTitle>
                <CardDescription>Episodic events, procedural rules, and Hindsight lessons recalled by agents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Memory Layer</Label>
                  <select
                    value={memCategory}
                    onChange={(e) => setMemCategory(e.target.value)}
                    className="w-full h-9 rounded-md border bg-background px-2.5 text-xs"
                  >
                    <option value="hindsight_lesson">Hindsight Lesson (What worked / failed)</option>
                    <option value="brand_rule">Brand & Voice Constraint</option>
                    <option value="procedural">Procedural Workflow Rule</option>
                    <option value="episodic">Episodic Campaign Fact</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Memory Fact</Label>
                  <Textarea
                    rows={4}
                    value={memContent}
                    onChange={(e) => setMemContent(e.target.value)}
                    placeholder="e.g. Plain-text 60-word founder emails achieved 3.1x reply rate vs HTML newsletters for UKVI partner outreach."
                  />
                </div>
                <Button className="w-full" onClick={handleStoreMemory}>Store in Memory Graph</Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Persisted Agent Memories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {(wiki?.memories || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No agent memories recorded yet.</p>
                ) : (
                  wiki!.memories.map((m) => (
                    <div key={m.id} className="rounded border p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{m.category}</Badge>
                        <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm">{m.content}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="context">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Context-Mode Token Window Compressor (mksglu/context-mode)</CardTitle>
              <CardDescription>Extracts highest-signal metric & entity sentences before feeding large tool outputs into free-tier context windows</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Raw Tool Output / Long Transcript</Label>
                <Textarea rows={8} value={rawContext} onChange={(e) => setRawContext(e.target.value)} className="text-xs" />
                <Button onClick={handleCompress}>Compress Context Window</Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Compressed High-Signal Output</Label>
                {compressedResult ? (
                  <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
                    <div className="flex gap-2">
                      <Badge>{compressedResult.savedPercent}% Tokens Saved</Badge>
                      <Badge variant="outline">{compressedResult.originalTokensEst} → {compressedResult.compressedTokensEst} est. tokens</Badge>
                    </div>
                    <p className="text-sm leading-relaxed">{compressedResult.compressed}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border p-8 text-center text-xs text-muted-foreground">
                    Click Compress Context Window to benchmark token reduction.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
