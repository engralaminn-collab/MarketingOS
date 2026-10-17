"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Mail,
  Megaphone,
  MousePointerClick,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  bestButtonTextColor,
  buildMarketingKit,
  buttonHtml,
  contrastRatio,
  DEFAULT_KIT_FORM,
  DIAGRAM_PRESETS,
  isCtaButtonData,
  isMarketingDiagramData as isMarketingDiagramAsset,
  isMarketingKitData,
  KIT_TYPES,
  normalizeHexColor,
  safeButtonHref,
  softButtonBackground,
  type CtaButtonData,
  type MarketingAssetType,
  type MarketingDiagramData,
  type MarketingDiagramNode,
  type MarketingKitData,
  type MarketingKitForm,
  type MarketingDiagramType,
} from "@/lib/marketing-studio";

interface SavedAsset {
  id: string;
  type: MarketingAssetType;
  title: string;
  payload: Record<string, unknown>;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_DIAGRAM: MarketingDiagramData = {
  version: 1,
  type: DIAGRAM_PRESETS[0].id,
  title: DIAGRAM_PRESETS[0].title,
  accent: "#bf4520",
  paper: "#f5f5f5",
  ink: "#2d3142",
  muted: "#687182",
  nodes: DIAGRAM_PRESETS[0].nodes.map((node) => ({ ...node })),
};

const DEFAULT_BUTTON: CtaButtonData = {
  version: 1,
  label: "Explore the offer",
  href: "https://example.com/offer",
  accent: "#bf4520",
  variant: "solid",
  size: "standard",
  corners: "rounded",
};

const ASSET_LABELS: Record<MarketingAssetType, string> = {
  marketing_kit: "Campaign kit",
  marketing_diagram: "Diagram",
  cta_button: "CTA button",
};

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "marketing-asset";
}

function toMarkdown(kit: MarketingKitData): string {
  const { outputs } = kit;
  return [
    `# ${outputs.heroHeadline}`,
    "",
    outputs.heroSubhead,
    "",
    `**Brand:** ${kit.form.brand || "[brand]"}  `,
    `**Audience:** ${kit.form.audience || "[audience]"}  `,
    `**Offer / next step:** ${kit.form.offer || "[offer]"}`,
    "",
    `## Positioning\n${outputs.positioning}`,
    "",
    "## Message points",
    ...outputs.benefitBullets.map((point) => `- ${point}`),
    "",
    "## Email",
    `**Subject:** ${outputs.emailSubject}`,
    `**Preheader:** ${outputs.emailPreheader}`,
    "",
    outputs.emailBody,
    "",
    `**Primary CTA:** ${outputs.primaryCta}`,
    "",
    "## Social",
    "### LinkedIn",
    outputs.linkedinPost,
    "",
    "### Instagram",
    outputs.instagramPost,
    "",
    "## Paid ad",
    `**Headline:** ${outputs.adHeadline}`,
    outputs.adDescription,
    "",
    `## Channels\n${outputs.channelPlan.map((channel) => `- ${channel}`).join("\n")}`,
    "",
    `## Measurement\nPrimary KPI: ${outputs.primaryKpi}\nGuardrails: ${outputs.guardrails.join("; ")}`,
    "",
    `> ${outputs.reviewNote}`,
  ].join("\n");
}

function SavedAssetsPanel({
  title,
  assets,
  loading,
  activeId,
  onOpen,
  onDelete,
}: {
  title: string;
  assets: SavedAsset[];
  loading: boolean;
  activeId: string | null;
  onOpen: (asset: SavedAsset) => void;
  onDelete: (asset: SavedAsset) => void;
}) {
  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">Private to your company workspace</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading saved work…</div>
        ) : assets.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">Nothing saved yet. Save a draft to keep it here.</p>
        ) : (
          <ScrollArea className="max-h-[360px] pr-3">
            <div className="space-y-2">
              {assets.map((asset) => (
                <div key={asset.id} className={`flex items-center gap-2 rounded-lg border p-2.5 ${activeId === asset.id ? "border-primary/50 bg-primary/5" : "border-border/60"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{asset.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Updated {new Date(asset.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpen(asset)} aria-label={`Open ${asset.title}`}>Open</Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(asset)} aria-label={`Delete ${asset.title}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div>
    </div>
  );
}

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium">{label}</Label>{children}{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>;
}

function MarketingKitBuilder({
  form,
  setForm,
  kit,
  setKit,
  title,
  setTitle,
  assetId,
  onSave,
  saving,
  assets,
  loadingAssets,
  onOpenAsset,
  onDeleteAsset,
}: {
  form: MarketingKitForm;
  setForm: (value: MarketingKitForm) => void;
  kit: MarketingKitData | null;
  setKit: (value: MarketingKitData | null) => void;
  title: string;
  setTitle: (value: string) => void;
  assetId: string | null;
  onSave: () => Promise<void>;
  saving: boolean;
  assets: SavedAsset[];
  loadingAssets: boolean;
  onOpenAsset: (asset: SavedAsset) => void;
  onDeleteAsset: (asset: SavedAsset) => void;
}) {
  const updateForm = (key: keyof MarketingKitForm, value: string) => setForm({ ...form, [key]: value });
  const updateOutput = (key: keyof MarketingKitData["outputs"], value: string) => {
    if (!kit) return;
    const current = kit.outputs[key];
    setKit({
      ...kit,
      outputs: {
        ...kit.outputs,
        [key]: Array.isArray(current) ? value.split("\n").filter(Boolean) : value,
      },
    });
  };

  const generate = () => {
    const next = buildMarketingKit(form);
    setKit(next);
    const product = form.product.trim() || "campaign";
    setTitle(`${KIT_TYPES.find((item) => item.value === form.type)?.label || "Campaign"} kit: ${product}`.slice(0, 160));
  };

  const copyKit = async () => {
    if (!kit) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(kit));
      toast.success("Kit copied as Markdown");
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  };

  const downloadKit = () => {
    if (!kit) return;
    const blob = new Blob([toMarkdown(kit)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(form.product || title || "marketing-kit")}.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    toast.success("Campaign kit downloaded as Markdown");
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="space-y-5">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <SectionHeader icon={BookOpen} title="Campaign kit builder" description="Turn a concise brief into editable, channel-ready starter copy and a review checklist." />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Kit type">
                <Select value={form.type} onValueChange={(value) => updateForm("type", value as MarketingKitForm["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KIT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Brand or organization"><Input value={form.brand} onChange={(event) => updateForm("brand", event.target.value)} placeholder="e.g. North Star Studio" maxLength={140} /></FormField>
              <FormField label="Product, service or event"><Input value={form.product} onChange={(event) => updateForm("product", event.target.value)} placeholder="What are you promoting?" maxLength={160} /></FormField>
              <FormField label="Target audience"><Input value={form.audience} onChange={(event) => updateForm("audience", event.target.value)} placeholder="Who is this for?" maxLength={180} /></FormField>
              <FormField label="Customer outcome"><Input value={form.goal} onChange={(event) => updateForm("goal", event.target.value)} placeholder="What should they be able to do?" maxLength={180} /></FormField>
              <FormField label="Offer or next step"><Input value={form.offer} onChange={(event) => updateForm("offer", event.target.value)} placeholder="Demo, guide, consultation, registration…" maxLength={180} /></FormField>
            </div>
            <FormField label="What it does / why it matters"><Textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Describe the problem and your approach. Avoid unsupported results or claims." rows={3} maxLength={800} /></FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Verified proof point" hint="Use a real testimonial, credential or measured result—or leave blank to keep a review placeholder."><Input value={form.proof} onChange={(event) => updateForm("proof", event.target.value)} placeholder="Optional; use only verifiable evidence" maxLength={300} /></FormField>
              <FormField label="Tone and channel mix" hint="Separate channels with commas."><div className="space-y-2"><Input value={form.tone} onChange={(event) => updateForm("tone", event.target.value)} placeholder="Clear and helpful" maxLength={80} /><Input value={form.channels} onChange={(event) => updateForm("channels", event.target.value)} placeholder="Website, email, LinkedIn" maxLength={240} /></div></FormField>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
              <Button onClick={generate}><Sparkles className="mr-2 h-4 w-4" />Build starter kit</Button>
              <Button variant="outline" onClick={() => { setForm({ ...DEFAULT_KIT_FORM, brand: form.brand }); setKit(null); setTitle(""); }}><RefreshCw className="mr-2 h-4 w-4" />Reset</Button>
              <Badge variant="outline" className="ml-auto">Template-based · not AI-generated</Badge>
            </div>
          </CardContent>
        </Card>

        {kit ? (
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle className="text-base">Editable campaign assets</CardTitle><CardDescription className="mt-1">Review and revise every line before you publish or send it.</CardDescription></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={copyKit}><Clipboard className="mr-2 h-3.5 w-3.5" />Copy Markdown</Button><Button variant="outline" size="sm" onClick={downloadKit}><Download className="mr-2 h-3.5 w-3.5" />Download .md</Button><Button size="sm" onClick={() => void onSave()} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />{saving ? "Saving…" : assetId ? "Update kit" : "Save kit"}</Button></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Saved kit name"><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></FormField>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label="Positioning"><Textarea value={kit.outputs.positioning} onChange={(event) => updateOutput("positioning", event.target.value)} rows={3} /></FormField>
                <FormField label="Landing page headline"><Textarea value={kit.outputs.heroHeadline} onChange={(event) => updateOutput("heroHeadline", event.target.value)} rows={2} /></FormField>
                <FormField label="Landing page subhead"><Textarea value={kit.outputs.heroSubhead} onChange={(event) => updateOutput("heroSubhead", event.target.value)} rows={3} /></FormField>
                <FormField label="Message points" hint="One line per point."><Textarea value={kit.outputs.benefitBullets.join("\n")} onChange={(event) => updateOutput("benefitBullets", event.target.value)} rows={3} /></FormField>
                <FormField label="Email subject and preheader"><div className="space-y-2"><Input value={kit.outputs.emailSubject} onChange={(event) => updateOutput("emailSubject", event.target.value)} aria-label="Email subject" /><Input value={kit.outputs.emailPreheader} onChange={(event) => updateOutput("emailPreheader", event.target.value)} aria-label="Email preheader" /></div></FormField>
                <FormField label="Email body"><Textarea value={kit.outputs.emailBody} onChange={(event) => updateOutput("emailBody", event.target.value)} rows={5} /></FormField>
                <FormField label="LinkedIn post"><Textarea value={kit.outputs.linkedinPost} onChange={(event) => updateOutput("linkedinPost", event.target.value)} rows={5} /></FormField>
                <FormField label="Instagram post"><Textarea value={kit.outputs.instagramPost} onChange={(event) => updateOutput("instagramPost", event.target.value)} rows={5} /></FormField>
                <FormField label="Ad headline"><Input value={kit.outputs.adHeadline} onChange={(event) => updateOutput("adHeadline", event.target.value)} /></FormField>
                <FormField label="Ad description"><Textarea value={kit.outputs.adDescription} onChange={(event) => updateOutput("adDescription", event.target.value)} rows={2} /></FormField>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><p className="text-xs font-semibold">Channel plan</p><div className="flex flex-wrap gap-1.5">{kit.outputs.channelPlan.map((channel) => <Badge variant="secondary" key={channel}>{channel}</Badge>)}</div></div>
                <div className="space-y-2"><p className="text-xs font-semibold">Measurement guardrails</p><p className="text-xs text-muted-foreground">{kit.outputs.primaryKpi}</p><ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{kit.outputs.guardrails.map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Review before use. </span>{kit.outputs.reviewNote}</div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-border/80 bg-transparent"><CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center"><Megaphone className="h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">Your campaign kit will appear here</p><p className="max-w-md text-xs text-muted-foreground">The builder uses your brief to prepare editable copy, consistent CTAs, channel suggestions and measurement checks. It does not invent performance data.</p></CardContent></Card>
        )}
      </div>
      <div className="space-y-4"><div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" />Marketing foundations</div><ul className="space-y-2 text-xs leading-relaxed text-muted-foreground"><li>• Start with audience, need, positioning and proof.</li><li>• Keep one primary conversion action across landing page, email and social.</li><li>• Use placeholders where evidence is missing; do not fabricate customer results.</li><li>• Define one primary KPI plus opt-out and complaint guardrails.</li><li>• Adapt each channel asset instead of cross-posting identical copy.</li></ul></div><SavedAssetsPanel title="Saved campaign kits" assets={assets} loading={loadingAssets} activeId={assetId} onOpen={onOpenAsset} onDelete={onDeleteAsset} /></div>
    </div>
  );
}

function wrapSvgText(value: string, maxChars: number, maxLines = 2): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  }
  return lines;
}

function svgThemeColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function MarketingDiagramPreview({ data, svgRef }: { data: MarketingDiagramData; svgRef: React.RefObject<SVGSVGElement | null> }) {
  const width = 1120;
  const height = 430;
  const nodes = data.nodes.slice(0, 6);
  const accent = svgThemeColor(data.accent, "#bf4520");
  const paper = svgThemeColor(data.paper, "#f5f5f5");
  const ink = svgThemeColor(data.ink, "#2d3142");
  const muted = svgThemeColor(data.muted, "#687182");
  const panel = "#ffffff";
  const rule = "#cbd1d9";

  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-labelledby="marketing-diagram-title marketing-diagram-description" style={{ display: "block", maxWidth: "100%", height: "auto", background: paper, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <title id="marketing-diagram-title">{data.title || "Marketing diagram"}</title>
      <desc id="marketing-diagram-description">An editable, branded {data.type.replaceAll("_", " ")} diagram with {nodes.length} steps.</desc>
      <rect x="0" y="0" width={width} height={height} rx="8" fill={paper} />
      <text x="44" y="48" fill={ink} fontSize="24" fontWeight="700" fontFamily="Georgia, 'Times New Roman', serif">{data.title || "Marketing diagram"}</text>
      <text x="44" y="73" fill={muted} fontSize="12">MarketingOS · editable SVG · review labels and handoffs before sharing</text>

      {data.type === "funnel" ? (
        <g>
          {nodes.map((node, index) => {
            const maxWidth = 770;
            const currentWidth = maxWidth - index * Math.min(82, 330 / Math.max(nodes.length - 1, 1));
            const nextWidth = maxWidth - (index + 1) * Math.min(82, 330 / Math.max(nodes.length - 1, 1));
            const y = 102 + index * 57;
            const x1 = (width - currentWidth) / 2;
            const x2 = (width + currentWidth) / 2;
            const lowerX1 = (width - nextWidth) / 2;
            const lowerX2 = (width + nextWidth) / 2;
            return (
              <g key={`${node.title}-${index}`}>
                <polygon points={`${x1},${y} ${x2},${y} ${lowerX2},${y + 50} ${lowerX1},${y + 50}`} fill={panel} stroke={index === 0 ? accent : rule} strokeWidth={index === 0 ? "2" : "1.2"} />
                <text x={width / 2} y={y + 20} fill={ink} textAnchor="middle" fontSize="13" fontWeight="700">{wrapSvgText(node.title || `Stage ${index + 1}`, 46, 1)[0]}</text>
                {wrapSvgText(node.detail || "Add a useful outcome or handoff", 72, 2).map((line, lineIndex) => <text key={lineIndex} x={width / 2} y={y + 35 + lineIndex * 12} fill={muted} textAnchor="middle" fontSize="10">{line}</text>)}
              </g>
            );
          })}
        </g>
      ) : data.type === "timeline" ? (
        <g>
          <line x1="70" y1="190" x2="1050" y2="190" stroke={rule} strokeWidth="2" />
          {nodes.map((node, index) => {
            const x = 82 + index * (956 / Math.max(nodes.length - 1, 1));
            const cardX = Math.min(Math.max(18, x - 86), width - 190);
            return (
              <g key={`${node.title}-${index}`}>
                <circle cx={x} cy="190" r="8" fill={index === 0 ? accent : paper} stroke={index === 0 ? accent : muted} strokeWidth="2" />
                <line x1={x} y1="199" x2={x} y2="220" stroke={rule} strokeWidth="1.5" />
                <rect x={cardX} y="220" width="172" height="112" rx="6" fill={panel} stroke={index === 0 ? accent : rule} strokeWidth="1.2" />
                <text x={cardX + 13} y="246" fill={accent} fontSize="10" fontWeight="700">{`STEP ${index + 1}`}</text>
                <text x={cardX + 13} y="270" fill={ink} fontSize="12" fontWeight="700">{wrapSvgText(node.title || `Milestone ${index + 1}`, 20, 1)[0]}</text>
                {wrapSvgText(node.detail || "Add owner, channel or evidence", 24, 2).map((line, lineIndex) => <text key={lineIndex} x={cardX + 13} y={288 + lineIndex * 14} fill={muted} fontSize="10">{line}</text>)}
              </g>
            );
          })}
        </g>
      ) : data.type === "quadrant" ? (
        <g>
          <text x="560" y="390" fill={muted} textAnchor="middle" fontSize="11" fontWeight="700">EFFORT  →</text>
          <text x="52" y="238" fill={muted} textAnchor="middle" fontSize="11" fontWeight="700" transform="rotate(-90 52 238)">IMPACT  →</text>
          {nodes.slice(0, 4).map((node, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const x = 190 + column * 374;
            const y = 108 + row * 132;
            return (
              <g key={`${node.title}-${index}`}>
                <rect x={x} y={y} width="354" height="116" rx="6" fill={panel} stroke={index === 0 ? accent : rule} strokeWidth={index === 0 ? "2" : "1.2"} />
                <rect x={x} y={y} width="5" height="116" rx="2" fill={index === 0 ? accent : rule} />
                <text x={x + 19} y={y + 34} fill={ink} fontSize="15" fontWeight="700">{wrapSvgText(node.title || `Priority ${index + 1}`, 38, 1)[0]}</text>
                {wrapSvgText(node.detail || "Add a decision or next action", 48, 2).map((line, lineIndex) => <text key={lineIndex} x={x + 19} y={y + 60 + lineIndex * 16} fill={muted} fontSize="11">{line}</text>)}
              </g>
            );
          })}
        </g>
      ) : data.type === "flywheel" ? (
        <g>
          {nodes.map((_, index) => {
            const count = Math.max(nodes.length, 1);
            const step = (Math.PI * 2) / count;
            const startAngle = -Math.PI / 2 + index * step + step * 0.22;
            const endAngle = -Math.PI / 2 + (index + 1) * step - step * 0.22;
            const radius = 184;
            const sx = 560 + Math.cos(startAngle) * radius;
            const sy = 238 + Math.sin(startAngle) * radius;
            const ex = 560 + Math.cos(endAngle) * radius;
            const ey = 238 + Math.sin(endAngle) * radius;
            return <path key={`loop-${index}`} d={`M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}`} fill="none" stroke={muted} strokeWidth="1.6" markerEnd="url(#marketing-arrow-muted)" />;
          })}
          {nodes.map((node, index) => {
            const angle = -Math.PI / 2 + index * ((Math.PI * 2) / Math.max(nodes.length, 1));
            const cx = 560 + Math.cos(angle) * 122;
            const cy = 238 + Math.sin(angle) * 122;
            const x = cx - 78;
            const y = cy - 35;
            return (
              <g key={`${node.title}-${index}`}>
                <rect x={x} y={y} width="156" height="70" rx="6" fill={panel} stroke={index === 0 ? accent : rule} strokeWidth={index === 0 ? "2" : "1.2"} />
                <text x={cx} y={y + 27} fill={ink} textAnchor="middle" fontSize="12" fontWeight="700">{wrapSvgText(node.title || `Stage ${index + 1}`, 20, 1)[0]}</text>
                {wrapSvgText(node.detail || "Add a useful value exchange", 24, 2).map((line, lineIndex) => <text key={lineIndex} x={cx} y={y + 45 + lineIndex * 12} fill={muted} textAnchor="middle" fontSize="9">{line}</text>)}
              </g>
            );
          })}
          <circle cx="560" cy="238" r="44" fill={paper} stroke={rule} strokeWidth="1.2" />
          <text x="560" y="234" fill={accent} textAnchor="middle" fontSize="10" fontWeight="700">LEARN</text>
          <text x="560" y="251" fill={ink} textAnchor="middle" fontSize="10">& repeat</text>
        </g>
      ) : data.type === "service_blueprint" ? (
        <g>
          <text x="48" y="125" fill={muted} fontSize="9" fontWeight="700">CUSTOMER</text>
          <text x="48" y="144" fill={muted} fontSize="9">JOURNEY</text>
          <text x="48" y="198" fill={muted} fontSize="9" fontWeight="700">VISIBLE</text>
          <text x="48" y="217" fill={muted} fontSize="9">TOUCHPOINT</text>
          <text x="48" y="268" fill={muted} fontSize="9" fontWeight="700">BACKSTAGE</text>
          <text x="48" y="287" fill={muted} fontSize="9">HANDOFF</text>
          {nodes.map((node, index) => {
            const gap = 8;
            const colWidth = (918 - gap * (nodes.length - 1)) / Math.max(nodes.length, 1);
            const x = 176 + index * (colWidth + gap);
            const cells = [
              { y: 105, text: node.title || `Stage ${index + 1}` },
              { y: 177, text: node.frontstage || node.detail || "Add the customer-facing touchpoint" },
              { y: 249, text: node.backstage || "Add an owner, system or evidence check" },
            ];
            return (
              <g key={`${node.title}-${index}`}>
                {cells.map((cell, cellIndex) => (
                  <g key={cellIndex}>
                    <rect x={x} y={cell.y} width={colWidth} height="60" rx="5" fill={panel} stroke={cellIndex === 0 && index === 0 ? accent : rule} strokeWidth={cellIndex === 0 && index === 0 ? "2" : "1"} />
                    {wrapSvgText(cell.text, Math.max(14, Math.floor((colWidth - 16) / 6)), 3).map((line, lineIndex) => <text key={lineIndex} x={x + 8} y={cell.y + 21 + lineIndex * 12} fill={cellIndex === 0 ? ink : muted} fontSize={cellIndex === 0 ? "10" : "9"} fontWeight={cellIndex === 0 ? "700" : "400"}>{line}</text>)}
                  </g>
                ))}
              </g>
            );
          })}
          <line x1="170" y1="243" x2="1096" y2="243" stroke={accent} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x="1090" y="238" fill={accent} textAnchor="end" fontSize="8" fontWeight="700">LINE OF VISIBILITY</text>
        </g>
      ) : (
        <g>
          {nodes.map((node, index, list) => {
            const gap = 24;
            const boxWidth = (1024 - gap * (list.length - 1)) / list.length;
            const x = 48 + index * (boxWidth + gap);
            const centerY = 218;
            return (
              <g key={`${node.title}-${index}`}>
                {index < list.length - 1 && <line x1={x + boxWidth + 2} y1={centerY} x2={x + boxWidth + gap - 2} y2={centerY} stroke={muted} strokeWidth="1.6" markerEnd="url(#marketing-arrow-muted)" />}
                <rect x={x} y="155" width={boxWidth} height="126" rx="6" fill={panel} stroke={index === 0 ? accent : rule} strokeWidth={index === 0 ? "2" : "1.2"} />
                <rect x={x} y="155" width={boxWidth} height="5" rx="2" fill={index === 0 ? accent : rule} />
                <text x={x + 16} y="185" fill={muted} fontSize="9" fontWeight="700">{`STEP ${String(index + 1).padStart(2, "0")}`}</text>
                <text x={x + 16} y="211" fill={ink} fontSize="13" fontWeight="700">{wrapSvgText(node.title || `Stage ${index + 1}`, Math.max(12, Math.floor((boxWidth - 32) / 7)), 1)[0]}</text>
                {wrapSvgText(node.detail || "Add an outcome or handoff", Math.max(18, Math.floor((boxWidth - 32) / 5)), 2).map((line, lineIndex) => <text key={lineIndex} x={x + 16} y={235 + lineIndex * 14} fill={muted} fontSize="10">{line}</text>)}
              </g>
            );
          })}
        </g>
      )}
      <defs><marker id="marketing-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={muted} /></marker></defs>
      <text x="44" y="412" fill={muted} fontSize="9">MarketingOS · original branded SVG export · 1–2 focal accents · no external assets</text>
    </svg>
  );
}
function DiagramBuilder({
  data,
  setData,
  assetId,
  onSave,
  saving,
  assets,
  loadingAssets,
  onOpenAsset,
  onDeleteAsset,
}: {
  data: MarketingDiagramData;
  setData: (value: MarketingDiagramData) => void;
  assetId: string | null;
  onSave: () => Promise<void>;
  saving: boolean;
  assets: SavedAsset[];
  loadingAssets: boolean;
  onOpenAsset: (asset: SavedAsset) => void;
  onDeleteAsset: (asset: SavedAsset) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const updateNode = (index: number, key: keyof MarketingDiagramNode, value: string) => setData({
    ...data,
    nodes: data.nodes.map((node, current) => current === index ? { ...node, [key]: value } : node),
  });

  const selectTemplate = (type: MarketingDiagramType) => {
    const template = DIAGRAM_PRESETS.find((item) => item.id === type) || DIAGRAM_PRESETS[0];
    setData({ ...data, type, title: template.title, nodes: template.nodes.map((node) => ({ ...node })) });
  };

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(data.title)}.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    toast.success("SVG diagram downloaded");
  };

  const downloadPng = async () => {
    if (!svgRef.current) return;
    const serialized = new XMLSerializer().serializeToString(svgRef.current);
    const svgUrl = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not render the SVG preview"));
        image.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 2240;
      canvas.height = 860;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable in this browser");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("Could not encode a PNG image");
      const pngUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `${slugify(data.title)}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1_000);
      toast.success("2× PNG diagram downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export PNG");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const copySvg = async () => {
    if (!svgRef.current) return;
    try {
      const serialized = new XMLSerializer().serializeToString(svgRef.current);
      await navigator.clipboard.writeText(serialized);
      toast.success("SVG markup copied");
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="space-y-5">
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><SectionHeader icon={Workflow} title="Marketing diagram studio" description="Create branded journeys, funnels, quadrant maps, flywheels and service blueprints as portable SVG/PNG." /><div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="sm" onClick={copySvg}><Clipboard className="mr-2 h-3.5 w-3.5" />Copy SVG</Button><Button variant="outline" size="sm" onClick={downloadPng}><Download className="mr-2 h-3.5 w-3.5" />Export PNG</Button><Button size="sm" onClick={downloadSvg}><Download className="mr-2 h-3.5 w-3.5" />Export SVG</Button></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2"><FormField label="Diagram type"><Select value={data.type} onValueChange={(value) => selectTemplate(value as MarketingDiagramType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="journey">Customer journey</SelectItem><SelectItem value="flow">Campaign workflow</SelectItem><SelectItem value="funnel">Demand funnel</SelectItem><SelectItem value="timeline">Launch timeline</SelectItem><SelectItem value="quadrant">Impact / effort quadrant</SelectItem><SelectItem value="flywheel">Growth flywheel</SelectItem><SelectItem value="service_blueprint">Service blueprint</SelectItem></SelectContent></Select></FormField></div>
              <div className="lg:col-span-2"><FormField label="Diagram title"><Input value={data.title} onChange={(event) => setData({ ...data, title: event.target.value.slice(0, 140) })} maxLength={140} /></FormField></div>
              <FormField label="Accent"><Input type="color" value={svgThemeColor(data.accent, "#bf4520")} onChange={(event) => setData({ ...data, accent: event.target.value })} className="h-9 w-16 p-1" aria-label="Diagram accent color" /></FormField>
              <FormField label="Paper"><Input type="color" value={svgThemeColor(data.paper, "#f5f5f5")} onChange={(event) => setData({ ...data, paper: event.target.value })} className="h-9 w-16 p-1" aria-label="Diagram paper color" /></FormField>
              <FormField label="Ink"><Input type="color" value={svgThemeColor(data.ink, "#2d3142")} onChange={(event) => setData({ ...data, ink: event.target.value })} className="h-9 w-16 p-1" aria-label="Diagram text color" /></FormField>
              <FormField label="Muted"><Input type="color" value={svgThemeColor(data.muted, "#687182")} onChange={(event) => setData({ ...data, muted: event.target.value })} className="h-9 w-16 p-1" aria-label="Diagram secondary text color" /></FormField>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/60 bg-slate-50 p-2"><div className="min-w-[760px]"><MarketingDiagramPreview data={data} svgRef={svgRef} /></div></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4"><p className="text-xs text-muted-foreground">Up to 6 steps · editable light editorial palette · standalone SVG or 2× PNG · no external assets</p><Button onClick={() => void onSave()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : assetId ? "Update diagram" : "Save diagram"}</Button></div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/60">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Edit diagram content</CardTitle><CardDescription className="text-xs">Keep each idea distinct. Label the handoff or customer-facing promise; only add evidence you can support.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {data.nodes.map((node, index) => (
                <div key={`${index}-${node.title}`} className="space-y-2 rounded-lg border border-border/60 p-3">
                  <div className="mb-1 flex items-center justify-between"><Badge variant="outline">Step {index + 1}</Badge><Button size="icon" variant="ghost" className="h-7 w-7" disabled={data.type === "quadrant" ? data.nodes.length <= 4 : data.nodes.length <= 2} onClick={() => setData({ ...data, nodes: data.nodes.filter((_, current) => current !== index) })} aria-label={`Remove step ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                  <Input value={node.title} onChange={(event) => updateNode(index, "title", event.target.value.slice(0, 70))} placeholder="Stage name" maxLength={70} aria-label={`Step ${index + 1} title`} />
                  <Textarea value={node.detail} onChange={(event) => updateNode(index, "detail", event.target.value.slice(0, 160))} placeholder="Outcome or handoff" rows={2} maxLength={160} aria-label={`Step ${index + 1} detail`} />
                  {data.type === "service_blueprint" && <>
                    <div><Label className="text-[11px]" htmlFor={`blueprint-frontstage-${index}`}>Visible customer touchpoint</Label><Textarea id={`blueprint-frontstage-${index}`} value={node.frontstage || ""} onChange={(event) => updateNode(index, "frontstage", event.target.value.slice(0, 120))} placeholder="What the customer sees or hears" rows={2} maxLength={120} /></div>
                    <div><Label className="text-[11px]" htmlFor={`blueprint-backstage-${index}`}>Internal handoff / evidence</Label><Textarea id={`blueprint-backstage-${index}`} value={node.backstage || ""} onChange={(event) => updateNode(index, "backstage", event.target.value.slice(0, 120))} placeholder="Owner, system, SLA or review" rows={2} maxLength={120} /></div>
                  </>}
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-3" disabled={data.type === "quadrant" || data.nodes.length >= 6} onClick={() => setData({ ...data, nodes: [...data.nodes, { title: `Stage ${data.nodes.length + 1}`, detail: "Add an outcome or handoff" }] })}><Plus className="mr-2 h-4 w-4" />Add step</Button>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4"><div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" />Design checks</div><ul className="space-y-2 text-xs leading-relaxed text-muted-foreground"><li>• Prefer a semantic diagram over decorative shapes.</li><li>• Keep labels short; use a table for long descriptions.</li><li>• Keep contrast and reading order clear in both light and dark contexts.</li><li>• Exported artwork is an SVG with inline styles and no external image dependencies.</li></ul></div><SavedAssetsPanel title="Saved diagrams" assets={assets} loading={loadingAssets} activeId={assetId} onOpen={onOpenAsset} onDelete={onDeleteAsset} /></div>
    </div>
  );
}

function ButtonBuilder({
  data,
  setData,
  title,
  setTitle,
  assetId,
  onSave,
  saving,
  assets,
  loadingAssets,
  onOpenAsset,
  onDeleteAsset,
}: {
  data: CtaButtonData;
  setData: (value: CtaButtonData) => void;
  title: string;
  setTitle: (value: string) => void;
  assetId: string | null;
  onSave: () => Promise<void>;
  saving: boolean;
  assets: SavedAsset[];
  loadingAssets: boolean;
  onOpenAsset: (asset: SavedAsset) => void;
  onDeleteAsset: (asset: SavedAsset) => void;
}) {
  const accent = normalizeHexColor(data.accent);
  const textColor = bestButtonTextColor(accent);
  const contrastSurface = data.variant === "solid" ? accent : data.variant === "soft" ? softButtonBackground(accent) : "#ffffff";
  const textRatio = contrastRatio(data.variant === "solid" ? textColor : accent, contrastSurface);
  const validHref = safeButtonHref(data.href);
  const buttonCss: React.CSSProperties = {
    padding: data.size === "compact" ? "9px 16px" : data.size === "large" ? "15px 26px" : "12px 20px",
    backgroundColor: data.variant === "solid" ? accent : data.variant === "soft" ? `${accent}1A` : "transparent",
    color: data.variant === "solid" ? textColor : accent,
    border: data.variant === "outline" ? `2px solid ${accent}` : "2px solid transparent",
    borderRadius: data.corners === "pill" ? "999px" : data.corners === "square" ? "4px" : "10px",
    fontWeight: 700,
    lineHeight: 1.2,
    outlineColor: accent,
  };

  const copyMarkup = async () => {
    try {
      await navigator.clipboard.writeText(buttonHtml(data));
      toast.success("Accessible CTA markup copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to copy button markup");
    }
  };

  const downloadMarkup = () => {
    try {
      const blob = new Blob([buttonHtml(data)], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(title || "campaign-cta")}.html`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success("CTA HTML downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate button markup");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="space-y-5">
        <Card className="border-border/70 bg-card/60">
          <CardHeader><SectionHeader icon={MousePointerClick} title="CTA button builder" description="Preview a reusable call-to-action, check text contrast and copy email-safe HTML." /></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Button label"><Input value={data.label} onChange={(event) => setData({ ...data, label: event.target.value.slice(0, 80) })} maxLength={80} placeholder="Get started" /></FormField>
              <FormField label="Destination URL" hint={validHref ? "HTTPS, HTTP, mailto, tel, relative paths and fragments are supported." : "Unsafe or invalid link. Use HTTPS, HTTP, mailto, tel, a relative path or a fragment."}><Input value={data.href} onChange={(event) => setData({ ...data, href: event.target.value.slice(0, 500) })} maxLength={500} aria-invalid={!validHref} placeholder="https://example.com/offer" /></FormField>
              <FormField label="Visual style"><Select value={data.variant} onValueChange={(value) => setData({ ...data, variant: value as CtaButtonData["variant"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">Solid</SelectItem><SelectItem value="outline">Outline</SelectItem><SelectItem value="soft">Soft fill</SelectItem></SelectContent></Select></FormField>
              <FormField label="Size"><Select value={data.size} onValueChange={(value) => setData({ ...data, size: value as CtaButtonData["size"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent></Select></FormField>
              <FormField label="Corners"><Select value={data.corners} onValueChange={(value) => setData({ ...data, corners: value as CtaButtonData["corners"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="square">Square</SelectItem><SelectItem value="rounded">Rounded</SelectItem><SelectItem value="pill">Pill</SelectItem></SelectContent></Select></FormField>
              <FormField label="Brand color"><Input type="color" value={data.accent} onChange={(event) => setData({ ...data, accent: event.target.value })} className="h-9 w-16 p-1" aria-label="Button brand color" /></FormField>
            </div>
            <div className="rounded-xl border border-border/60 bg-slate-50 p-5 dark:bg-slate-900/50"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Landing page preview</p><Badge variant="outline" className="bg-white/70">No navigation on preview</Badge></div><div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-950"><button type="button" style={buttonCss} className="transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" onClick={(event) => event.preventDefault()}>{data.label || "Learn more"}</button></div></div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant={textRatio !== null && textRatio >= (data.variant === "solid" ? 4.5 : 4.5) ? "success" : "warning"}>{textRatio ? `${textRatio.toFixed(2)}:1 text contrast` : "Contrast unavailable"}</Badge><span className="text-xs text-muted-foreground">Target: 4.5:1 for normal-size button text</span></div>
            {textRatio !== null && textRatio < 4.5 && <p className="text-xs text-amber-600 dark:text-amber-400">This color combination does not meet WCAG AA contrast for normal-size text. Choose a darker brand color.</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4"><FormField label="Saved button name"><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></FormField><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copyMarkup()} disabled={!validHref}><Clipboard className="mr-2 h-4 w-4" />Copy HTML</Button><Button variant="outline" onClick={downloadMarkup} disabled={!validHref}><Download className="mr-2 h-4 w-4" />Download HTML</Button><Button onClick={() => void onSave()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : assetId ? "Update button" : "Save button"}</Button></div></div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/60"><CardHeader className="pb-2"><CardTitle className="text-sm">Email-ready markup</CardTitle><CardDescription className="text-xs">Copy HTML and test it in each target email client before sending.</CardDescription></CardHeader><CardContent><pre className="max-h-40 overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed">{validHref ? buttonHtml(data) : "Fix the destination URL to generate markup."}</pre></CardContent></Card>
      </div>
      <div className="space-y-4"><div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Check className="h-4 w-4 text-primary" />CTA checklist</div><ul className="space-y-2 text-xs leading-relaxed text-muted-foreground"><li>• Use a specific action, not a vague label.</li><li>• Keep one primary CTA per message or screen.</li><li>• Check contrast, destination, tracking and keyboard focus.</li><li>• Email clients vary; test the copied HTML in your real template.</li></ul></div><SavedAssetsPanel title="Saved CTA buttons" assets={assets} loading={loadingAssets} activeId={assetId} onOpen={onOpenAsset} onDelete={onDeleteAsset} /></div>
    </div>
  );
}

export function MarketingStudioView() {
  const { user } = useAppStore();
  const authToken = user?.token ?? null;
  const [activeTab, setActiveTab] = useState("kits");
  const [assets, setAssets] = useState<SavedAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [savingType, setSavingType] = useState<MarketingAssetType | null>(null);
  const [kitForm, setKitForm] = useState<MarketingKitForm>({ ...DEFAULT_KIT_FORM, brand: user?.companyName || "" });
  const [kit, setKit] = useState<MarketingKitData | null>(null);
  const [kitTitle, setKitTitle] = useState("");
  const [kitAssetId, setKitAssetId] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<MarketingDiagramData>(DEFAULT_DIAGRAM);
  const [diagramAssetId, setDiagramAssetId] = useState<string | null>(null);
  const [button, setButton] = useState<CtaButtonData>(DEFAULT_BUTTON);
  const [buttonTitle, setButtonTitle] = useState("Primary campaign CTA");
  const [buttonAssetId, setButtonAssetId] = useState<string | null>(null);

  const loadAssets = useCallback(async (signal: AbortSignal) => {
    if (!authToken) return;
    try {
      const response = await fetch("/api/marketing-assets?type=all", { headers: { Authorization: `Bearer ${authToken}` }, signal });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not load saved assets");
      if (!signal.aborted) setAssets(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      if (!signal.aborted) toast.error(error instanceof Error ? error.message : "Could not load saved assets");
    } finally {
      if (!signal.aborted) setLoadingAssets(false);
    }
  }, [authToken]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await loadAssets(controller.signal);
    })();
    return () => controller.abort();
  }, [loadAssets]);

  const filteredAssets = useMemo(() => (type: MarketingAssetType) => assets.filter((asset) => asset.type === type), [assets]);

  const saveAsset = useCallback(async (type: MarketingAssetType, title: string, payload: Record<string, unknown>, id: string | null) => {
    if (!authToken) {
      toast.error("Please sign in again");
      return null;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Enter a name before saving");
      return null;
    }
    setSavingType(type);
    try {
      const response = await fetch(id ? `/api/marketing-assets/${id}` : "/api/marketing-assets", {
        method: id ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: cleanTitle, payload }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not save asset");
      const saved = json.data as SavedAsset;
      setAssets((previous) => [saved, ...previous.filter((asset) => asset.id !== saved.id)]);
      toast.success(`${ASSET_LABELS[type]} saved`);
      return saved;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save asset");
      return null;
    } finally {
      setSavingType(null);
    }
  }, [authToken]);

  const deleteAsset = useCallback(async (asset: SavedAsset) => {
    if (!authToken || !window.confirm(`Delete “${asset.title}”? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/marketing-assets/${asset.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Could not delete asset");
      setAssets((previous) => previous.filter((item) => item.id !== asset.id));
      if (kitAssetId === asset.id) setKitAssetId(null);
      if (diagramAssetId === asset.id) setDiagramAssetId(null);
      if (buttonAssetId === asset.id) setButtonAssetId(null);
      toast.success("Asset deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete asset");
    }
  }, [authToken, buttonAssetId, diagramAssetId, kitAssetId]);

  const openAsset = useCallback((asset: SavedAsset) => {
    if (asset.type === "marketing_kit" && isMarketingKitData(asset.payload)) {
      setKit(asset.payload);
      setKitForm(asset.payload.form);
      setKitTitle(asset.title);
      setKitAssetId(asset.id);
      setActiveTab("kits");
    } else if (asset.type === "marketing_diagram" && isMarketingDiagramAsset(asset.payload)) {
      setDiagram(asset.payload);
      setDiagramAssetId(asset.id);
      setActiveTab("diagrams");
    } else if (asset.type === "cta_button") {
      if (!isCtaButtonData(asset.payload)) {
        toast.error("Saved button data is invalid");
        return;
      }
      setButton(asset.payload);
      setButtonTitle(asset.title);
      setButtonAssetId(asset.id);
      setActiveTab("buttons");
    } else {
      toast.error("Saved asset data is invalid");
      return;
    }
    toast.success(`${ASSET_LABELS[asset.type]} opened`);
  }, []);

  const saveKit = async () => {
    if (!kit) return;
    const saved = await saveAsset("marketing_kit", kitTitle, kit as unknown as Record<string, unknown>, kitAssetId);
    if (saved) setKitAssetId(saved.id);
  };
  const saveDiagram = async () => {
    const saved = await saveAsset("marketing_diagram", diagram.title, diagram as unknown as Record<string, unknown>, diagramAssetId);
    if (saved) setDiagramAssetId(saved.id);
  };
  const saveButton = async () => {
    const saved = await saveAsset("cta_button", buttonTitle, button as unknown as Record<string, unknown>, buttonAssetId);
    if (saved) setButtonAssetId(saved.id);
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2"><Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary"><Sparkles className="mr-1 h-3 w-3" />Marketing systems</Badge><Badge variant="secondary">Draft workspace</Badge></div><h1 className="text-2xl font-bold tracking-tight">Marketing Studio</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Build reusable campaign kits, clean diagrams and accessible calls to action. Save drafts to your company workspace; nothing is sent or published automatically.</p></div>
        <div className="hidden items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground md:flex"><ArrowDownToLine className="h-4 w-4 text-primary" />All exports are local files or copied drafts</div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full grid-cols-3 sm:w-[550px]">
          <TabsTrigger value="kits" className="gap-2 py-2"><Megaphone className="h-4 w-4" /><span>Campaign kits</span></TabsTrigger>
          <TabsTrigger value="diagrams" className="gap-2 py-2"><Workflow className="h-4 w-4" /><span>Diagrams</span></TabsTrigger>
          <TabsTrigger value="buttons" className="gap-2 py-2"><MousePointerClick className="h-4 w-4" /><span>CTA buttons</span></TabsTrigger>
        </TabsList>
        <TabsContent value="kits" forceMount className="mt-5 data-[state=inactive]:hidden">
          <MarketingKitBuilder form={kitForm} setForm={setKitForm} kit={kit} setKit={setKit} title={kitTitle} setTitle={setKitTitle} assetId={kitAssetId} onSave={saveKit} saving={savingType === "marketing_kit"} assets={filteredAssets("marketing_kit")} loadingAssets={loadingAssets} onOpenAsset={openAsset} onDeleteAsset={deleteAsset} />
        </TabsContent>
        <TabsContent value="diagrams" forceMount className="mt-5 data-[state=inactive]:hidden">
          <DiagramBuilder data={diagram} setData={setDiagram} assetId={diagramAssetId} onSave={saveDiagram} saving={savingType === "marketing_diagram"} assets={filteredAssets("marketing_diagram")} loadingAssets={loadingAssets} onOpenAsset={openAsset} onDeleteAsset={deleteAsset} />
        </TabsContent>
        <TabsContent value="buttons" forceMount className="mt-5 data-[state=inactive]:hidden">
          <ButtonBuilder data={button} setData={setButton} title={buttonTitle} setTitle={setButtonTitle} assetId={buttonAssetId} onSave={saveButton} saving={savingType === "cta_button"} assets={filteredAssets("cta_button")} loadingAssets={loadingAssets} onOpenAsset={openAsset} onDeleteAsset={deleteAsset} />
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground"><FileText className="h-3.5 w-3.5" /><span>Campaign content is deterministic starter copy, not AI-generated. Verify claims and legal requirements; test links and rendering before sending.</span><a href="https://github.com/cathrynlavery/diagram-design" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-foreground">Diagram references<ExternalLink className="h-3 w-3" /></a></div>
    </div>
  );
}
