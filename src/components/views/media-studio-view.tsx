"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useApiMutation, useApiQuery } from "@/hooks/use-api-query";
import { VideoCaptionerAndVoicePanel } from "@/components/studio/video-captioner-panel";
import { LiveTalkStudio } from "@/components/studio/live-talk-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image as ImageIcon,
  Type,
  Video,
  Mic,
  Sparkles,
  Send,
  Loader2,
  Download,
  Wand2,
  Film,
  Clapperboard,
  UserCircle,
  Radio,
  Copy,
  Check,
  Maximize2,
  Lock,
  RefreshCw,
  Music2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Animation Variants ─────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

// ─── Image Size Options ─────────────────────────────────────────────────────

const IMAGE_SIZES = [
  { id: "square", label: "Square", ratio: "1:1", desc: "1024×1024", size: "1024x1024" },
  { id: "portrait", label: "Portrait", ratio: "3:4", desc: "864×1152", size: "864x1152" },
  { id: "landscape", label: "Landscape", ratio: "4:3", desc: "1152×864", size: "1152x864" },
  { id: "wide", label: "Wide", ratio: "16:9", desc: "1344×768", size: "1344x768" },
] as const;

type ImageSizeId = (typeof IMAGE_SIZES)[number]["id"];

type LocalGraphicFormat = "square" | "portrait" | "landscape";

const LOCAL_GRAPHIC_FORMATS: Record<LocalGraphicFormat, { label: string; width: number; height: number }> = {
  square: { label: "Square · 1:1", width: 1080, height: 1080 },
  portrait: { label: "Story/Reel · 9:16", width: 1080, height: 1920 },
  landscape: { label: "Wide · 1.91:1", width: 1200, height: 628 },
};

function fillCanvasRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
  context.fill();
}

function wrapCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines && lines.join(" ").length < words.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.replace(/[.\s]*$/, "…");
  }
  return lines;
}

function drawLocalGraphic(
  canvas: HTMLCanvasElement,
  values: { brand: string; headline: string; supportingText: string; cta: string; accent: string; format: LocalGraphicFormat },
) {
  const dimensions = LOCAL_GRAPHIC_FORMATS[values.format];
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) return;

  const { width, height } = canvas;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#111827");
  gradient.addColorStop(0.55, "#172554");
  gradient.addColorStop(1, "#0f172a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.22;
  context.fillStyle = values.accent;
  context.beginPath();
  context.arc(width * 0.88, height * 0.16, Math.min(width, height) * 0.23, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const margin = width * 0.09;
  const isPortrait = values.format === "portrait";
  const brand = values.brand.trim() || "YOUR BRAND";
  context.fillStyle = "rgba(255,255,255,0.78)";
  context.font = `700 ${Math.round(width * 0.027)}px system-ui, sans-serif`;
  context.fillText(brand.toUpperCase().slice(0, 48), margin, height * (isPortrait ? 0.12 : 0.16), width - margin * 2);

  context.fillStyle = values.accent;
  context.fillRect(margin, height * (isPortrait ? 0.18 : 0.25), width * 0.12, Math.max(5, height * 0.009));

  const headline = values.headline.trim() || "A clear message\nfor your audience";
  const titleFont = Math.round(width * (values.format === "landscape" ? 0.073 : 0.082));
  context.font = `800 ${titleFont}px system-ui, sans-serif`;
  context.fillStyle = "#ffffff";
  const titleLines = wrapCanvasText(context, headline.replace(/\n/g, " "), width - margin * 2, 4);
  const lineHeight = titleFont * 1.16;
  let y = height * (isPortrait ? 0.37 : values.format === "landscape" ? 0.43 : 0.42);
  for (const line of titleLines) {
    context.fillText(line, margin, y, width - margin * 2);
    y += lineHeight;
  }

  const subtitle = values.supportingText.trim();
  if (subtitle) {
    const bodyFont = Math.round(width * 0.032);
    context.font = `400 ${bodyFont}px system-ui, sans-serif`;
    context.fillStyle = "rgba(255,255,255,0.78)";
    const bodyLines = wrapCanvasText(context, subtitle, width - margin * 2, isPortrait ? 4 : 3);
    y += bodyFont * 0.8;
    for (const line of bodyLines) {
      context.fillText(line, margin, y, width - margin * 2);
      y += bodyFont * 1.45;
    }
  }

  const buttonText = values.cta.trim() || "Learn more";
  const buttonFont = Math.round(width * 0.03);
  context.font = `700 ${buttonFont}px system-ui, sans-serif`;
  const buttonWidth = Math.min(width - margin * 2, Math.max(width * 0.28, context.measureText(buttonText).width + width * 0.1));
  const buttonHeight = Math.round(height * (isPortrait ? 0.065 : 0.095));
  const buttonY = height * (isPortrait ? 0.82 : 0.78);
  const radius = Math.min(buttonHeight / 2, 28);
  context.fillStyle = values.accent;
  context.beginPath();
  context.moveTo(margin + radius, buttonY);
  context.lineTo(margin + buttonWidth - radius, buttonY);
  context.quadraticCurveTo(margin + buttonWidth, buttonY, margin + buttonWidth, buttonY + radius);
  context.lineTo(margin + buttonWidth, buttonY + buttonHeight - radius);
  context.quadraticCurveTo(margin + buttonWidth, buttonY + buttonHeight, margin + buttonWidth - radius, buttonY + buttonHeight);
  context.lineTo(margin + radius, buttonY + buttonHeight);
  context.quadraticCurveTo(margin, buttonY + buttonHeight, margin, buttonY + buttonHeight - radius);
  context.lineTo(margin, buttonY + radius);
  context.quadraticCurveTo(margin, buttonY, margin + radius, buttonY);
  context.closePath();
  context.fill();
  context.fillStyle = "#111827";
  context.fillText(buttonText.slice(0, 60), margin + width * 0.05, buttonY + buttonHeight * 0.64, buttonWidth - width * 0.1);
}

// ─── Text Content Types ─────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: "blog", label: "Blog Post", icon: Type, prompt: (t: string, tone: string, len: string) => `Write a ${len} ${tone} blog post about: ${t}. Include a compelling title, introduction, key sections with headers, and a conclusion with CTA.` },
  { id: "social", label: "Social Post", icon: Copy, prompt: (t: string, tone: string, len: string, platform: string) => `Write a ${len} ${tone} social media post for ${platform} about: ${t}. Include hooks, hashtags, and emojis.` },
  { id: "email", label: "Email", icon: Send, prompt: (t: string, tone: string, len: string) => `Write a ${len} ${tone} marketing email about: ${t}. Include subject line, preheader, body copy, and CTA button text.` },
  { id: "sms", label: "SMS", icon: Mic, prompt: (t: string, tone: string, len: string) => `Write a ${len} ${tone} SMS marketing message about: ${t}. Keep it under 160 characters, include a clear CTA.` },
  { id: "ad", label: "Ad Copy", icon: Wand2, prompt: (t: string, tone: string, len: string, platform: string) => `Write ${len} ${tone} ad copy variations for ${platform} about: ${t}. Include headlines, descriptions, and CTA.` },
  { id: "seo", label: "SEO Article", icon: Sparkles, prompt: (t: string, tone: string, len: string) => `Write a ${len} ${tone} SEO-optimized article about: ${t}. Include meta title, meta description, H1-H3 structure, keyword placement, and internal linking suggestions.` },
  { id: "landing", label: "Landing Page", icon: Maximize2, prompt: (t: string, tone: string, len: string) => `Write a ${len} ${tone} landing page copy about: ${t}. Include hero headline, subheadline, pain points, benefits, social proof section, features, FAQ, and final CTA.` },
] as const;

type ContentTypeId = (typeof CONTENT_TYPES)[number]["id"];

const TONES = ["Professional", "Casual", "Friendly", "Urgent", "Inspirational", "Humorous", "Authoritative"];
const LENGTHS = ["Short", "Medium", "Long"];
const PLATFORMS = ["Instagram", "Facebook", "Twitter/X", "LinkedIn", "TikTok", "Pinterest", "Google Ads"];

// ─── Video Studio Cards ─────────────────────────────────────────────────────

const VIDEO_TYPES = [
  { id: "reels", label: "Instagram Reels", icon: Film, desc: "Vertical editing, trending audio, and direct Instagram publishing are not configured.", status: "coming" as const },
  { id: "shorts", label: "YouTube Shorts", icon: Clapperboard, desc: "Short-form rendering and direct YouTube publishing are not configured.", status: "coming" as const },
  { id: "promo", label: "Promo Video", icon: Video, desc: "A free local animated text-card WebM template is available below. It is not AI-generated footage.", status: "local" as const },
  { id: "avatar", label: "Talking Avatar", icon: UserCircle, desc: "Live browser preview: your photo plus a script, driven by OS voices. Add local TTS for recorded audio; neural lip-sync needs an operator GPU adapter.", status: "talk" as const },
  { id: "marketing", label: "Marketing Video Plan", icon: Wand2, desc: "Draft a marketing video script and storyboard. Rendered video depends on an available AI video provider.", status: "plan" as const },
];

// ─── Audio Studio Cards ─────────────────────────────────────────────────────

const AUDIO_TYPES = [
  { id: "podcast", label: "AI Podcast", icon: Radio, desc: "Multi-speaker podcast recording, mixing, and export are not configured.", status: "coming" as const },
  { id: "clone", label: "Voice Clone", icon: UserCircle, desc: "Voice cloning is not configured. Use only properly authorized voice data.", status: "coming" as const },
];

// ─── Image Studio Sub-Component ─────────────────────────────────────────────

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [selectedSize, setSelectedSize] = useState<ImageSizeId>("square");
  const [images, setImages] = useState<{ url: string; prompt: string; provider?: string }[]>([]);
  const localGraphicCanvas = useRef<HTMLCanvasElement>(null);
  const [graphicBrand, setGraphicBrand] = useState("");
  const [graphicHeadline, setGraphicHeadline] = useState("");
  const [graphicSupportingText, setGraphicSupportingText] = useState("");
  const [graphicCta, setGraphicCta] = useState("Learn more");
  const [graphicAccent, setGraphicAccent] = useState("#f97316");
  const [graphicFormat, setGraphicFormat] = useState<LocalGraphicFormat>("square");

  const redrawLocalGraphic = useCallback(() => {
    const canvas = localGraphicCanvas.current;
    if (!canvas) return;
    drawLocalGraphic(canvas, {
      brand: graphicBrand,
      headline: graphicHeadline,
      supportingText: graphicSupportingText,
      cta: graphicCta,
      accent: graphicAccent,
      format: graphicFormat,
    });
  }, [graphicBrand, graphicHeadline, graphicSupportingText, graphicCta, graphicAccent, graphicFormat]);

  useEffect(() => {
    redrawLocalGraphic();
  }, [redrawLocalGraphic]);

  const downloadLocalGraphic = useCallback(() => {
    const canvas = localGraphicCanvas.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Your browser could not export this graphic.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `marketing-graphic-${graphicFormat}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Local graphic downloaded. No AI or external API was used.");
    }, "image/png");
  }, [graphicFormat]);

  const generateMutation = useApiMutation<{ prompt: string; size: string }, { success?: boolean; image?: string; size?: string; provider?: string }>({
    method: "POST",
    path: "/api/ai/generate-image",
    onSuccess: (result) => {
      if (result?.image) {
        setImages((prev) => [...prev, { url: result.image!, prompt, provider: result.provider }]);
        toast.success(result.provider?.includes("self-hosted") ? "Image generated locally with ComfyUI." : "Image generated successfully.");
      } else {
        toast.error("The image provider returned no image. Please try again.");
      }
    },
    onError: (err) => {
      toast.error(err || "Failed to generate image");
    },
  });

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    const selected = IMAGE_SIZES.find((size) => size.id === selectedSize);
    if (!selected) return;
    generateMutation.mutate({ prompt: prompt.trim(), size: selected.size });
  }, [prompt, selectedSize, generateMutation]);

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        Model-based image generation can use a self-hosted ComfyUI instance when configured; the app does not download or host model weights. Hosted Z.AI still requires explicit opt-in. Use the local social-graphic builder below for a no-API template graphic (not AI image generation).
      </div>
      {/* Prompt Input */}
      <motion.div variants={fadeUp} className="space-y-3">
        <Label className="text-sm font-medium">Describe your image</Label>
        <div className="flex gap-2">
          <Textarea
            placeholder="A futuristic city at sunset with neon lights reflecting on wet streets..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            maxLength={2000}
            className="resize-none bg-background/50 border-border/50 focus-visible:ring-orange-500/30"
            disabled={generateMutation.isLoading}
          />
        </div>
      </motion.div>

      {/* Size Selector */}
      <motion.div variants={fadeUp} className="space-y-3">
        <Label className="text-sm font-medium">Image Size</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {IMAGE_SIZES.map((size) => (
            <button
              key={size.id}
              onClick={() => setSelectedSize(size.id)}
              disabled={generateMutation.isLoading}
              className={[
                "relative rounded-xl border p-3 text-left transition-all cursor-pointer",
                "hover:border-orange-500/40 hover:shadow-md",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                selectedSize === size.id
                  ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                  : "border-border/50 bg-background/40",
              ].join(" ")}
            >
              <p className="text-sm font-medium">{size.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {size.ratio} &middot; {size.desc}
              </p>
              {selectedSize === size.id && (
                <motion.div
                  layoutId="size-indicator"
                  className="absolute top-1.5 right-1.5"
                >
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Generate Button */}
      <motion.div variants={fadeUp}>
        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generateMutation.isLoading}
          className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 h-11 gap-2"
        >
          {generateMutation.isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Generate Image
            </>
          )}
        </Button>
      </motion.div>

      <motion.section variants={fadeUp} className="space-y-4 rounded-2xl border border-border/50 bg-background/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Free local social graphic</h3>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">Make a branded PNG card in this browser. It uses a reusable design template—not an image-generation model—and sends no prompt or artwork to an external service.</p>
          </div>
          <Badge variant="outline" className="text-[10px]">No API · no model</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="local-graphic-brand">Brand</Label><Input id="local-graphic-brand" value={graphicBrand} maxLength={48} onChange={(event) => setGraphicBrand(event.target.value)} placeholder="Your brand" /></div>
          <div className="space-y-1.5"><Label htmlFor="local-graphic-title">Headline</Label><Input id="local-graphic-title" value={graphicHeadline} maxLength={180} onChange={(event) => setGraphicHeadline(event.target.value)} placeholder="Make your next move count" /></div>
          <div className="space-y-1.5"><Label htmlFor="local-graphic-cta">Call to action</Label><Input id="local-graphic-cta" value={graphicCta} maxLength={60} onChange={(event) => setGraphicCta(event.target.value)} placeholder="Learn more" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="local-graphic-description">Supporting copy</Label><Textarea id="local-graphic-description" value={graphicSupportingText} maxLength={220} onChange={(event) => setGraphicSupportingText(event.target.value)} rows={2} placeholder="A short benefit or offer. Check all factual claims before publishing." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="local-graphic-format">Format</Label><Select value={graphicFormat} onValueChange={(value) => setGraphicFormat(value as LocalGraphicFormat)}><SelectTrigger id="local-graphic-format"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(LOCAL_GRAPHIC_FORMATS).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="local-graphic-color">Accent</Label><Input id="local-graphic-color" type="color" value={graphicAccent} onChange={(event) => setGraphicAccent(event.target.value)} className="h-10 p-1" /></div>
          </div>
        </div>
        <canvas ref={localGraphicCanvas} aria-label="Preview of the local marketing graphic" className="mx-auto block w-full max-w-[460px] rounded-xl border border-border/50 bg-slate-950" style={{ aspectRatio: `${LOCAL_GRAPHIC_FORMATS[graphicFormat].width}/${LOCAL_GRAPHIC_FORMATS[graphicFormat].height}` }} />
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-muted-foreground">PNG export · generated entirely in your browser</p><Button onClick={downloadLocalGraphic}><Download className="mr-2 h-4 w-4" />Download PNG</Button></div>
      </motion.section>

      {/* Loading State */}
      {generateMutation.isLoading && (
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-border/50 bg-background/40 p-8"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-sky-500/20 flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-orange-400" />
              </div>
              <motion.div
                className="absolute -inset-2 rounded-2xl border-2 border-orange-500/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ borderTopColor: "rgb(249 115 22)" }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Creating your image...</p>
              <p className="text-xs text-muted-foreground mt-1">
                This usually takes 10-30 seconds
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Generated Images Gallery */}
      {images.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Generated Images ({images.length})
            </Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {images.map((img, i) => (
                <motion.div
                  key={`${img.url}-${i}`}
                  variants={fadeUp}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="group relative rounded-xl border border-border/50 bg-background/40 overflow-hidden"
                >
                  <div className="aspect-square relative">
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                    />
                    {img.provider && <Badge variant="secondary" className="absolute left-2 top-2 max-w-[90%] truncate bg-black/60 text-white">{img.provider}</Badge>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white line-clamp-2">
                        {img.prompt}
                      </p>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-lg bg-black/40 -sm border-0 text-white hover:bg-black/60"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = img.url;
                        a.download = `ai-image-${i + 1}.png`;
                        a.click();
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {images.length === 0 && !generateMutation.isLoading && (
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-dashed border-border/50 bg-background/20 p-12 flex flex-col items-center justify-center text-center"
        >
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500/10 to-sky-500/10 flex items-center justify-center mb-4">
            <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No images generated yet
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Describe your vision above and click Generate
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Text Studio Sub-Component ──────────────────────────────────────────────

function TextStudio() {
  type TypeId = ContentTypeId;

  const [activeType, setActiveType] = useState<TypeId>("blog");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [length, setLength] = useState("Medium");
  const [platform, setPlatform] = useState("Instagram");
  const [result, setResult] = useState<string | null>(null);
  const [resultProvider, setResultProvider] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeContentType = CONTENT_TYPES.find((c) => c.id === activeType)!;

  const generateMutation = useApiMutation<
    { message: string },
    { response: string; provider: string; model: string | null }
  >({
    method: "POST",
    path: "/api/ai/chat",
    onSuccess: (data) => {
      setResult(data.response);
      setResultProvider(data.provider);
      setCopied(false);
    },
    onError: (err) => {
      toast.error(err || "Failed to generate content");
    },
  });

  const handleGenerate = useCallback(() => {
    if (!topic.trim()) return;
    setResult(null);
    setResultProvider(null);
    const promptStr = activeContentType.prompt(topic, tone, length, platform);
    generateMutation.mutate({ message: promptStr });
  }, [topic, tone, length, platform, activeContentType, generateMutation]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
        Text generation uses the server-configured AI provider. Ollama is the default; requests never silently fall back to a paid API.
      </div>
      {/* Content Type Selector */}
      <motion.div variants={fadeUp}>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map((ct) => {
            const Icon = ct.icon;
            return (
              <button
                key={ct.id}
                onClick={() => {
                  setActiveType(ct.id as TypeId);
                  setResult(null);
                }}
                disabled={generateMutation.isLoading}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  activeType === ct.id
                    ? "border-orange-500 bg-orange-500/10 text-orange-400 shadow-sm"
                    : "border-border/50 bg-background/40 text-muted-foreground hover:border-orange-500/30 hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />
                {ct.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Form */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border/50 bg-background/40 p-4"
      >
        <div className="sm:col-span-2 space-y-2">
          <Label className="text-sm font-medium">Topic</Label>
          <Input
            placeholder="e.g., Benefits of AI in Digital Marketing"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={generateMutation.isLoading}
            className="bg-background/50 border-border/50 focus-visible:ring-orange-500/30"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Tone</Label>
          <Select
            value={tone}
            onValueChange={setTone}
            disabled={generateMutation.isLoading}
          >
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Length</Label>
          <Select
            value={length}
            onValueChange={setLength}
            disabled={generateMutation.isLoading}
          >
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTHS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Platform</Label>
          <Select
            value={platform}
            onValueChange={setPlatform}
            disabled={generateMutation.isLoading}
          >
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            onClick={handleGenerate}
            disabled={!topic.trim() || generateMutation.isLoading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 h-10 gap-2"
          >
            {generateMutation.isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {generateMutation.isLoading && (
          <motion.div
            key="loading"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-xl border border-border/50 bg-background/40 p-6"
          >
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
              <p className="text-sm text-muted-foreground">
                AI is crafting your {activeContentType.label.toLowerCase()}...
              </p>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </motion.div>
        )}

        {result && !generateMutation.isLoading && (
          <motion.div
            key="result"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-xl border border-border/50 bg-background/40 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-card/60 -md">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-orange-400 border-orange-500/30"
                >
                  {activeContentType.label}
                </Badge>
                {resultProvider && <Badge variant="secondary" className="text-[10px]">{resultProvider}</Badge>}
                <span className="text-xs text-muted-foreground">
                  {tone} &middot; {length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 gap-1.5 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="max-h-[400px]">
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_p]:leading-relaxed [&_ul]:my-2 [&_ol]:my-2 [&_li]:text-sm [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-sm [&_code]:text-xs [&_pre]:rounded-lg [&_pre]:bg-muted/50 [&_blockquote]:border-l-2 [&_blockquote]:border-orange-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!result && !generateMutation.isLoading && (
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-dashed border-border/50 bg-background/20 p-12 flex flex-col items-center justify-center text-center"
        >
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500/10 to-sky-500/10 flex items-center justify-center mb-4">
            <Type className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Ready to generate {activeContentType.label.toLowerCase()}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Fill in the details above and click Generate
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Video Studio Sub-Component ─────────────────────────────────────────────

interface VideoScene {
  scene: number;
  duration: string;
  visual: string;
  narration: string;
  mood: string;
}

interface VideoPlanResult {
  contentId: string;
  title: string;
  script: string;
  storyboard: VideoScene[];
  videoTaskId: string | null;
  videoStatus: string;
  duration: number;
  style: string;
  language: string;
  scriptSource: "ai" | "template";
  textProvider: string | null;
  message: string;
}

interface VideoTaskStatus {
  taskId: string;
  status: string;
  videoUrl: string | null;
  isReady: boolean;
  isProcessing: boolean;
  isFailed: boolean;
  error?: string;
}

const LOCAL_VIDEO_DIMENSIONS: Record<LocalGraphicFormat, { width: number; height: number }> = {
  square: { width: 720, height: 720 },
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
};

function drawLocalPromoFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: { brand: string; headline: string; description: string; benefit: string; cta: string; accent: string },
  elapsedSeconds: number,
) {
  const scenes = [
    { eyebrow: values.brand.trim() || "YOUR BRAND", text: values.headline.trim() || "A better way to move forward" },
    { eyebrow: "MADE FOR YOUR AUDIENCE", text: values.description.trim() || "Tell people clearly what you offer and who it helps." },
    { eyebrow: "THE BENEFIT", text: values.benefit.trim() || "A simple benefit, explained in your own words." },
    { eyebrow: "TAKE THE NEXT STEP", text: values.cta.trim() || "Learn more" },
  ];
  const duration = 3;
  const sceneIndex = Math.min(scenes.length - 1, Math.floor(elapsedSeconds / duration));
  const scene = scenes[sceneIndex];
  const sceneTime = (elapsedSeconds - sceneIndex * duration) / duration;
  const fade = Math.min(1, sceneTime * 5, (1 - sceneTime) * 5);
  const zoom = 1 + sceneTime * 0.025;

  context.setTransform(1, 0, 0, 1, 0, 0);
  const gradient = context.createLinearGradient(0, height, width, 0);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.52, "#172554");
  gradient.addColorStop(1, "#111827");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(width / 2, height / 2);
  context.scale(zoom, zoom);
  context.translate(-width / 2, -height / 2);
  context.globalAlpha = 0.18;
  context.fillStyle = values.accent;
  context.beginPath();
  context.arc(width * (0.82 - sceneIndex * 0.07), height * 0.25, Math.min(width, height) * 0.32, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const margin = width * 0.09;
  context.globalAlpha = fade;
  context.fillStyle = values.accent;
  context.font = `700 ${Math.round(width * 0.025)}px system-ui, sans-serif`;
  context.fillText(scene.eyebrow.toUpperCase().slice(0, 56), margin, height * 0.19, width - margin * 2);

  context.fillStyle = "#ffffff";
  context.font = `800 ${Math.round(width * 0.078)}px system-ui, sans-serif`;
  const lines = wrapCanvasText(context, scene.text, width * 0.82, 5);
  const lineHeight = width * 0.092;
  let textY = height * 0.43 - ((lines.length - 1) * lineHeight) / 2;
  for (const line of lines) {
    context.fillText(line, margin, textY, width - margin * 2);
    textY += lineHeight;
  }

  if (sceneIndex === scenes.length - 1) {
    const label = (values.cta.trim() || "Learn more").toUpperCase().slice(0, 48);
    context.font = `700 ${Math.round(width * 0.023)}px system-ui, sans-serif`;
    const buttonWidth = Math.min(width * 0.64, context.measureText(label).width + width * 0.12);
    const buttonHeight = height * 0.085;
    const x = margin;
    const y = height * 0.68;
    context.fillStyle = values.accent;
    fillCanvasRoundedRect(context, x, y, buttonWidth, buttonHeight, buttonHeight / 2);
    context.fillStyle = "#111827";
    context.fillText(label, x + width * 0.06, y + buttonHeight * 0.62, buttonWidth - width * 0.12);
  }

  context.globalAlpha = 0.65;
  context.fillStyle = "rgba(255,255,255,0.28)";
  context.fillRect(margin, height * 0.9, width - margin * 2, Math.max(3, height * 0.004));
  context.fillStyle = values.accent;
  context.fillRect(margin, height * 0.9, (width - margin * 2) * ((sceneIndex + sceneTime) / scenes.length), Math.max(3, height * 0.004));
  context.globalAlpha = 1;
}

function LocalPromoVideoMaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brand, setBrand] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [benefit, setBenefit] = useState("");
  const [cta, setCta] = useState("Learn more");
  const [accent, setAccent] = useState("#f97316");
  const [format, setFormat] = useState<LocalGraphicFormat>("portrait");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const preview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dimensions = LOCAL_VIDEO_DIMENSIONS[format];
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (context) drawLocalPromoFrame(context, canvas.width, canvas.height, { brand, headline, description, benefit, cta, accent }, 10.5);
  }, [brand, headline, description, benefit, cta, accent, format]);

  useEffect(() => {
    preview();
  }, [preview]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const renderVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
      setRenderError("This browser does not support local WebM recording. Try a current desktop version of Chrome or Firefox.");
      return;
    }

    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      setRenderError("This browser does not expose a supported WebM encoder.");
      return;
    }

    setRenderError(null);
    setIsRendering(true);
    let outputStream: MediaStream | null = null;
    try {
      outputStream = canvas.captureStream(24);
      const recorder = new MediaRecorder(outputStream, { mimeType, videoBitsPerSecond: 3_000_000 });
      const chunks: Blob[] = [];
      const videoReady = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error("The browser stopped recording unexpectedly."));
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
      });

      recorder.start(250);
      const startTime = performance.now();
      await new Promise<void>((resolve) => {
        const draw = (now: number) => {
          const elapsed = Math.min(12, (now - startTime) / 1000);
          const context = canvas.getContext("2d");
          if (context) drawLocalPromoFrame(context, canvas.width, canvas.height, { brand, headline, description, benefit, cta, accent }, elapsed);
          if (elapsed >= 12) {
            if (recorder.state !== "inactive") recorder.stop();
            resolve();
          } else {
            requestAnimationFrame(draw);
          }
        };
        requestAnimationFrame(draw);
      });

      const blob = await videoReady;
      if (!blob.size) throw new Error("The browser produced an empty video file.");
      setVideoUrl(URL.createObjectURL(blob));
      toast.success("Local promo video rendered. No AI model or external API was used.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not record video in this browser.";
      setRenderError(message);
      toast.error(message);
    } finally {
      outputStream?.getTracks().forEach((track) => track.stop());
      setIsRendering(false);
      preview();
    }
  }, [brand, headline, description, benefit, cta, accent, preview]);

  return (
    <section id="local-promo-video" className="scroll-mt-6 space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.035] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Free local promo-video maker</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Create a short animated text-card video in your browser and download it as WebM. It is a template-based, silent video—not AI-generated footage—and the text stays on your device.</p>
        </div>
        <Badge variant="outline" className="text-[10px]">No API · no model · WebM</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="local-video-brand">Brand</Label><Input id="local-video-brand" value={brand} maxLength={56} onChange={(event) => setBrand(event.target.value)} placeholder="Your brand" disabled={isRendering} /></div>
        <div className="space-y-1.5"><Label htmlFor="local-video-headline">Opening headline</Label><Input id="local-video-headline" value={headline} maxLength={180} onChange={(event) => setHeadline(event.target.value)} placeholder="A better way to grow" disabled={isRendering} /></div>
        <div className="space-y-1.5"><Label htmlFor="local-video-cta">Call to action</Label><Input id="local-video-cta" value={cta} maxLength={80} onChange={(event) => setCta(event.target.value)} placeholder="Learn more" disabled={isRendering} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="local-video-description">What you offer</Label><Textarea id="local-video-description" value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Explain your product or service in one short sentence." disabled={isRendering} /></div>
        <div className="space-y-1.5"><Label htmlFor="local-video-benefit">Customer benefit</Label><Textarea id="local-video-benefit" value={benefit} maxLength={160} onChange={(event) => setBenefit(event.target.value)} rows={2} placeholder="One benefit you can support with evidence." disabled={isRendering} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="local-video-format">Format</Label><Select value={format} onValueChange={(value) => setFormat(value as LocalGraphicFormat)} disabled={isRendering}><SelectTrigger id="local-video-format"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(LOCAL_GRAPHIC_FORMATS).map(([value, item]) => <SelectItem key={value} value={value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="local-video-color">Accent</Label><Input id="local-video-color" type="color" value={accent} onChange={(event) => setAccent(event.target.value)} className="h-10 p-1" disabled={isRendering} /></div>
        </div>
      </div>
      <canvas ref={canvasRef} aria-label="Preview of the local marketing video scene" className="mx-auto block w-full max-w-[360px] rounded-xl border border-border/50 bg-slate-950" style={{ aspectRatio: `${LOCAL_VIDEO_DIMENSIONS[format].width}/${LOCAL_VIDEO_DIMENSIONS[format].height}` }} />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void renderVideo()} disabled={isRendering}>
          {isRendering ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rendering locally…</> : <><Film className="mr-2 h-4 w-4" />Render 12-second WebM</>}
        </Button>
        {videoUrl && <Button asChild variant="outline"><a href={videoUrl} download="marketing-promo.webm"><Download className="mr-2 h-4 w-4" />Download WebM</a></Button>}
        <span className="text-[11px] text-muted-foreground">Silent · 4 scenes · rendered on this device</span>
      </div>
      {renderError && <p role="alert" className="text-xs text-destructive">{renderError}</p>}
      {videoUrl && <video controls playsInline src={videoUrl} className="w-full max-w-[560px] rounded-xl bg-black" />}
    </section>
  );
}

interface AiVideoClipResult {
  contentId: string | null;
  taskId: string | null;
  videoUrl: string | null;
  status: string;
  prompt: string;
  duration?: number;
  provider?: string;
  persisted?: boolean;
}

function AiVideoClipGenerator() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [result, setResult] = useState<AiVideoClipResult | null>(null);
  const statusPath = result?.taskId ? `/api/ai/video-status?taskId=${encodeURIComponent(result.taskId)}` : null;
  const { data: taskStatus, error: taskError, refetch } = useApiQuery<VideoTaskStatus>(
    statusPath,
    { enabled: Boolean(statusPath) },
  );
  const mutation = useApiMutation<
    { prompt: string; duration: number; saveToContent: boolean },
    AiVideoClipResult
  >({
    method: "POST",
    path: "/api/ai/generate-video",
    onSuccess: (data) => {
      setResult(data);
      toast.success(data.taskId ? "Video task accepted; check status for the rendered clip." : "Self-hosted AI video clip generated.");
    },
    onError: (error) => toast.error(error || "Could not generate the AI video clip"),
  });

  useEffect(() => {
    if (!taskStatus?.isProcessing || !result?.taskId) return;
    const interval = window.setInterval(() => refetch(), 8_000);
    return () => window.clearInterval(interval);
  }, [taskStatus?.isProcessing, result?.taskId, refetch]);

  const submit = useCallback(() => {
    const seconds = Number(duration);
    if (!prompt.trim() || prompt.trim().length > 2_000) {
      toast.error("Enter a video prompt of up to 2,000 characters.");
      return;
    }
    if (!Number.isInteger(seconds) || seconds < 3 || seconds > 10) {
      toast.error("Clip duration must be a whole number from 3 to 10 seconds.");
      return;
    }
    setResult(null);
    mutation.mutate({ prompt: prompt.trim(), duration: seconds, saveToContent: true });
  }, [duration, prompt, mutation]);

  const videoUrl = taskStatus?.isReady && taskStatus.videoUrl ? taskStatus.videoUrl : result?.videoUrl;

  return (
    <section className="space-y-4 rounded-xl border border-sky-500/25 bg-sky-500/[0.035] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15"><Film className="h-5 w-5 text-sky-400" /></div>
        <div>
          <h3 className="text-sm font-semibold">AI video clip generator</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">When configured, renders a model-generated 3–10 second clip through an operator-supplied ComfyUI workflow. Install and license the model, nodes, and weights yourself. Local output is returned for this session and is not stored in the database; download it before leaving. Without a local workflow, generation requires the separately opt-in hosted provider.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <div className="space-y-1.5"><Label htmlFor="ai-video-clip-prompt">Clip prompt</Label><Textarea id="ai-video-clip-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 2000))} maxLength={2000} rows={3} placeholder="Describe the subject, setting, camera movement, visual style, and action. Avoid text that should appear inside the footage." disabled={mutation.isLoading} /></div>
        <div className="space-y-1.5"><Label htmlFor="ai-video-clip-duration">Duration (seconds)</Label><Input id="ai-video-clip-duration" type="number" min={3} max={10} step={1} value={duration} onChange={(event) => setDuration(event.target.value)} disabled={mutation.isLoading} /><p className="text-[10px] text-muted-foreground">Short clips are compute-intensive.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={submit} disabled={!prompt.trim() || mutation.isLoading}>
          {mutation.isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate AI clip</>}
        </Button>
        {result?.contentId && <span className="text-xs text-muted-foreground">Prompt draft saved: {result.contentId}</span>}
        {result?.taskId && <Badge variant="outline">Hosted task: {taskStatus?.status || result.status}</Badge>}
      </div>
      {mutation.isLoading && <p role="status" className="text-xs text-muted-foreground">Local ComfyUI jobs may take several minutes and require substantial GPU memory. Do not close this page until the response is received; hosted requests may return an asynchronous task.</p>}
      {result && (
        <div className="space-y-2 rounded-lg border border-border/50 p-3">
          <p className="text-xs text-muted-foreground">Provider: {result.provider || (result.taskId ? "hosted Z.AI" : "self-hosted ComfyUI")} · status: {taskStatus?.status || result.status}{result.persisted === false ? " · output not persisted" : ""}</p>
          {taskError && <p role="status" className="text-xs text-amber-600">Could not refresh hosted render status: {taskError}</p>}
          {videoUrl && <video controls playsInline preload="metadata" className="w-full max-h-[480px] rounded-lg bg-black" src={videoUrl} />}
          {videoUrl && <a href={videoUrl} download="marketingos-ai-video" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-primary underline"><Download className="mr-1.5 h-3.5 w-3.5" />Download / open generated video</a>}
          {result.taskId && !videoUrl && <p role="status" className="text-xs text-muted-foreground">Waiting for hosted rendering to finish…</p>}
        </div>
      )}
    </section>
  );
}

function VideoStudio() {
  const [showComposer, setShowComposer] = useState(false);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("30");
  const [style, setStyle] = useState("cinematic");
  const [language, setLanguage] = useState("English");
  const [result, setResult] = useState<VideoPlanResult | null>(null);
  const { data: taskStatus, refetch: refreshTaskStatus, error: taskStatusError } = useApiQuery<VideoTaskStatus>(
    result?.videoTaskId ? `/api/ai/video-status?taskId=${encodeURIComponent(result.videoTaskId)}` : null,
    { enabled: Boolean(result?.videoTaskId) },
  );

  const generateMutation = useApiMutation<
    { topic: string; duration: number; style: string; language: string },
    VideoPlanResult
  >({
    method: "POST",
    path: "/api/ai/cinematic-video",
    onSuccess: (data) => {
      setResult(data);
      toast.success(data.videoTaskId ? "Video plan saved; rendering was requested." : "Script and storyboard saved as a draft.");
    },
    onError: (error) => toast.error(error || "Could not create the video plan"),
  });

  const handleGenerate = useCallback(() => {
    const seconds = Number(duration);
    if (!topic.trim()) return;
    if (!Number.isInteger(seconds) || seconds < 15 || seconds > 120) {
      toast.error("Duration must be a whole number from 15 to 120 seconds.");
      return;
    }
    setResult(null);
    generateMutation.mutate({
      topic: topic.trim(),
      duration: seconds,
      style,
      language: language.trim() || "English",
    });
  }, [duration, topic, style, language, generateMutation]);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
        <p className="text-sm font-medium">AI video is optional and model-dependent; browser templates are not AI footage.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Video plans use the configured text model (Ollama by default). The short AI clip adapter accepts an operator-provided ComfyUI API workflow; no video model, weights, or GPU service are bundled or live-tested, and local render failures never fall back to a hosted provider. The separate browser promo maker renders a silent text-card WebM template.
        </p>
      </div>

      <AiVideoClipGenerator />

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VIDEO_TYPES.map((videoType) => {
          const Icon = videoType.icon;
          const canPlan = videoType.status === "plan";
          const canRenderLocalTemplate = videoType.status === "local";
          const canTalk = videoType.status === "talk";
          const isEnabled = canPlan || canRenderLocalTemplate || canTalk;
          return (
            <motion.div
              key={videoType.id}
              variants={fadeUp}
              whileHover={canPlan ? { y: -4, scale: 1.01 } : undefined}
              className="group relative rounded-xl border border-border/50 bg-background/40 p-5 transition-all hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-sky-500/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-orange-400" />
                </div>
                <Badge variant={isEnabled ? "outline" : "secondary"} className="text-[10px] gap-1">
                  {canPlan ? <Sparkles className="h-2.5 w-2.5" /> : canRenderLocalTemplate ? <Film className="h-2.5 w-2.5" /> : canTalk ? <UserCircle className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                  {canPlan ? "Plan available" : canRenderLocalTemplate ? "Local template" : canTalk ? "Live in browser" : "Not configured"}
                </Badge>
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{videoType.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{videoType.desc}</p>
              <div className="mt-4">
                <Button
                  variant={canPlan ? "default" : "outline"}
                  size="sm"
                  disabled={!isEnabled || generateMutation.isLoading}
                  onClick={() => {
                    if (canPlan) setShowComposer(true);
                    else if (canTalk) document.getElementById("live-talk-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    else document.getElementById("local-promo-video")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="w-full text-xs h-9"
                >
                  {canPlan ? <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Create script & storyboard</> : canRenderLocalTemplate ? <><Film className="h-3.5 w-3.5 mr-1.5" />Open local maker</> : canTalk ? <><UserCircle className="h-3.5 w-3.5 mr-1.5" />Open live talk studio</> : "Not configured"}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <LiveTalkStudio />

      <LocalPromoVideoMaker />

      {showComposer && (
        <motion.section variants={fadeUp} className="rounded-xl border border-border/50 bg-background/40 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Marketing video brief</h3>
            <p className="text-xs text-muted-foreground mt-1">This generates a script/storyboard draft and requests video rendering if provider access is available.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-topic">Topic or campaign idea</Label>
            <Textarea
              id="video-topic"
              placeholder="A short product launch video introducing our new analytics dashboard"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength={1000}
              rows={3}
              disabled={generateMutation.isLoading}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="video-duration">Duration (seconds)</Label>
              <Input id="video-duration" type="number" min={15} max={120} step={1} value={duration} onChange={(event) => setDuration(event.target.value)} disabled={generateMutation.isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-style">Style</Label>
              <Select value={style} onValueChange={setStyle} disabled={generateMutation.isLoading}>
                <SelectTrigger id="video-style"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cinematic">Cinematic</SelectItem>
                  <SelectItem value="documentary">Documentary</SelectItem>
                  <SelectItem value="product-demo">Product demo</SelectItem>
                  <SelectItem value="social-ad">Social ad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-language">Language</Label>
              <Input id="video-language" value={language} maxLength={40} onChange={(event) => setLanguage(event.target.value)} disabled={generateMutation.isLoading} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={!topic.trim() || generateMutation.isLoading}>
              {generateMutation.isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating plan...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate video plan</>}
            </Button>
            <Button variant="outline" onClick={() => setShowComposer(false)} disabled={generateMutation.isLoading}>Close</Button>
          </div>
        </motion.section>
      )}

      {generateMutation.isLoading && (
        <div className="rounded-xl border border-border/50 bg-background/40 p-6 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-400" />
          <p className="mt-2 text-sm">Preparing the script and storyboard...</p>
          <p className="text-xs text-muted-foreground mt-1">Video rendering may take longer if a provider task is accepted.</p>
        </div>
      )}

      {result && !generateMutation.isLoading && (
        <section className="rounded-xl border border-border/50 bg-background/40 overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-card/60 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">{result.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">Draft saved · {result.duration}s · {result.style} · script source: {result.scriptSource}{result.textProvider ? ` · ${result.textProvider}` : ""}</p>
            </div>
            <Badge variant="outline">Video status: {taskStatus?.status || result.videoStatus}</Badge>
          </header>
          <div className="space-y-5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Content draft ID: {result.contentId}</p>
              {result.videoTaskId && (
                <Button variant="outline" size="sm" onClick={() => refreshTaskStatus()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Check render status
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{result.message}</p>
            {taskStatusError && <p role="status" className="text-xs text-amber-600">Could not refresh provider status: {taskStatusError}</p>}
            {taskStatus?.error && <p role="status" className="text-xs text-amber-600">{taskStatus.error}</p>}
            {taskStatus?.isReady && taskStatus.videoUrl && (
              <div className="space-y-2">
                <video controls className="w-full max-h-[480px] rounded-lg bg-black" src={taskStatus.videoUrl} />
                <a href={taskStatus.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open rendered video</a>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Script</h4>
                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result.script); toast.success("Script copied"); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copy script
                </Button>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs leading-relaxed font-sans">{result.script}</pre>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Storyboard ({result.storyboard.length} scenes)</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {result.storyboard.map((scene, index) => (
                  <article key={`${scene.scene}-${index}`} className="rounded-lg border border-border/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-semibold">Scene {scene.scene}</h5>
                      <Badge variant="secondary" className="text-[10px]">{scene.duration}</Badge>
                    </div>
                    <p className="mt-2 text-xs"><span className="font-medium">Visual:</span> {scene.visual}</p>
                    <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Narration:</span> {scene.narration}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Mood: {scene.mood}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </motion.div>
  );
}

// ─── Audio Studio Sub-Component ─────────────────────────────────────────────

interface VoiceoverResult {
  contentId: string;
  audioUrl: string;
  contentType: string | null;
  text: string;
  voice: string;
  provider: string;
  audioStored: boolean;
}

interface MusicTaskStart {
  contentId: string;
  taskId: string;
  status: string;
  model: string;
  prompt: string;
}

interface MusicChoice {
  title: string;
  audioUrl: string | null;
}

interface MusicTaskStatus {
  taskId: string;
  status: string;
  model: string | null;
  isReady: boolean;
  isProcessing: boolean;
  isFailed: boolean;
  error: string | null;
  audioUrl: string | null;
  choices: MusicChoice[];
}

const MUREKA_MODELS = [
  { id: "auto", label: "Auto (latest)" },
  { id: "mureka-7.6", label: "Mureka 7.6" },
  { id: "mureka-8", label: "Mureka 8" },
  { id: "mureka-9", label: "Mureka 9" },
  { id: "mureka-9.5", label: "Mureka 9.5" },
];

function AudioStudio() {
  const [voiceText, setVoiceText] = useState("");
  const [voiceId, setVoiceId] = useState("default");
  const [voiceover, setVoiceover] = useState<VoiceoverResult | null>(null);
  const voiceMutation = useApiMutation<{ text: string; voice: string }, VoiceoverResult>({
    method: "POST",
    path: "/api/ai/voice",
    onSuccess: (result) => {
      setVoiceover(result);
      toast.success(result.audioStored ? "Voiceover generated and saved as an audio draft." : "Self-hosted voiceover generated. Download it now; the audio is not persisted.");
    },
    onError: (error) => toast.error(error || "Could not generate voiceover"),
  });
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("auto");
  const [approveCharges, setApproveCharges] = useState(false);
  const [task, setTask] = useState<MusicTaskStart | null>(null);
  const statusPath = task?.taskId ? `/api/ai/music-status?taskId=${encodeURIComponent(task.taskId)}` : null;
  const { data: status, isLoading: isChecking, error: statusError, refetch } = useApiQuery<MusicTaskStatus>(
    statusPath,
    { enabled: Boolean(statusPath) },
  );

  const generateMutation = useApiMutation<
    { prompt: string; model: string; approveCharges: boolean },
    MusicTaskStart
  >({
    method: "POST",
    path: "/api/ai/generate-music",
    onSuccess: (result) => {
      setTask(result);
      toast.success("Instrumental generation started; the audio draft is saved.");
    },
    onError: (error) => toast.error(error || "Could not start instrumental generation"),
  });

  useEffect(() => {
    if (!status?.isProcessing || !task?.taskId) return;
    const interval = window.setInterval(() => refetch(), 8_000);
    return () => window.clearInterval(interval);
  }, [status?.isProcessing, task?.taskId, refetch]);

  const handleGenerate = useCallback(() => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || cleanPrompt.length > 1024) {
      toast.error("Enter a soundtrack prompt of up to 1,024 characters.");
      return;
    }
    if (!approveCharges) {
      toast.error("A manager must approve potential charges for this request.");
      return;
    }
    setTask(null);
    setApproveCharges(false);
    generateMutation.mutate({ prompt: cleanPrompt, model, approveCharges: true });
  }, [prompt, model, approveCharges, generateMutation]);

  const handleVoiceover = useCallback(() => {
    const cleanText = voiceText.trim();
    const cleanVoice = voiceId.trim() || "default";
    if (!cleanText || cleanText.length > 5000) {
      toast.error("Enter a voiceover script of up to 5,000 characters.");
      return;
    }
    if (cleanVoice.length > 80 || !/^[A-Za-z0-9_-]+$/.test(cleanVoice)) {
      toast.error("Use a voice ID containing only letters, numbers, underscores, or hyphens.");
      return;
    }
    setVoiceover(null);
    voiceMutation.mutate({ text: cleanText, voice: cleanVoice });
  }, [voiceText, voiceId, voiceMutation]);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <motion.section variants={fadeUp} className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Mic className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Voiceover</h3>
            <p className="mt-1 text-xs text-muted-foreground">Uses an operator-configured OpenAI-compatible self-hosted TTS service first, when available. A failed local request never falls back to a hosted provider. Otherwise speech requires the explicitly enabled hosted Z.AI adapter. Audio output is session-only for the local service; voice cloning is not included.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="voiceover-script">Script</Label>
          <Textarea
            id="voiceover-script"
            value={voiceText}
            onChange={(event) => setVoiceText(event.target.value.slice(0, 5000))}
            placeholder="Welcome to our new collection. Thoughtfully designed for your everyday routine."
            maxLength={5000}
            rows={3}
            disabled={voiceMutation.isLoading}
          />
          <p className="text-right text-[10px] text-muted-foreground">{voiceText.length}/5,000</p>
        </div>
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="voiceover-voice-id">Voice ID</Label>
          <Input id="voiceover-voice-id" value={voiceId} onChange={(event) => setVoiceId(event.target.value.slice(0, 80))} maxLength={80} placeholder="default" disabled={voiceMutation.isLoading} />
          <p className="text-[10px] text-muted-foreground">Use a voice ID supported by your TTS service. “default” uses `LOCAL_TTS_VOICE` when configured.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleVoiceover} disabled={!voiceText.trim() || voiceMutation.isLoading}>
            {voiceMutation.isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Mic className="mr-2 h-4 w-4" />Generate voiceover</>}
          </Button>
          {voiceover && <span className="text-xs text-muted-foreground">Script draft: {voiceover.contentId} · {voiceover.provider}{voiceover.audioStored ? " · audio URL saved" : " · audio not persisted"}</span>}
        </div>
        {voiceover && (
          <div className="space-y-2 rounded-lg border border-border/50 p-3">
            <audio controls preload="none" className="w-full" src={voiceover.audioUrl} />
            <a href={voiceover.audioUrl} download={`marketingos-voiceover.${voiceover.contentType === "audio/wav" || voiceover.contentType === "audio/x-wav" ? "wav" : voiceover.contentType === "audio/ogg" ? "ogg" : voiceover.contentType === "audio/flac" ? "flac" : "mp3"}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Download / open generated voiceover</a>
          </div>
        )}
      </motion.section>

      <motion.section variants={fadeUp} className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
            <Music2 className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Instrumental soundtrack</h3>
              <Badge variant="outline" className="text-[10px]">Mureka · API key required</Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Create original background music for a campaign, video, or podcast. Connect Mureka in Integrations first. Each request asks for one output to avoid the provider’s two-track default; provider charges may apply.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mureka-prompt">Soundtrack brief</Label>
          <Textarea
            id="mureka-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 1024))}
            placeholder="Warm, uplifting electronic instrumental for a 30-second product reveal; bright synths, gentle pulse, clean ending, no vocals."
            maxLength={1024}
            rows={3}
            disabled={generateMutation.isLoading}
          />
          <p className="text-right text-[10px] text-muted-foreground">{prompt.length}/1,024</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs space-y-2">
            <Label htmlFor="mureka-model">Mureka model</Label>
            <Select value={model} onValueChange={setModel} disabled={generateMutation.isLoading}>
              <SelectTrigger id="mureka-model"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MUREKA_MODELS.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={approveCharges} onChange={(event) => setApproveCharges(event.target.checked)} disabled={generateMutation.isLoading} /> I approve potential provider charges for this request.</label>
          <Button onClick={handleGenerate} disabled={!prompt.trim() || !approveCharges || generateMutation.isLoading}>
            {generateMutation.isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting...</> : <><Sparkles className="mr-2 h-4 w-4" />Generate instrumental</>}
          </Button>
        </div>
      </motion.section>

      {task && (
        <section className="rounded-xl border border-border/50 bg-background/40 p-4 space-y-4" aria-live="polite">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Soundtrack generation</h3>
              <p className="mt-1 text-xs text-muted-foreground">Saved audio draft: {task.contentId} · task {task.taskId}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status?.isFailed ? "destructive" : "outline"}>{status?.status || task.status}</Badge>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isChecking}>
                {isChecking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </header>
          <p className="text-xs text-muted-foreground">{task.prompt}</p>
          {statusError && <p role="status" className="text-xs text-amber-600">Could not refresh generation status: {statusError}</p>}
          {status?.error && <p role="status" className="text-xs text-amber-600">{status.error}</p>}
          {status?.isProcessing && <p className="text-xs text-muted-foreground">Mureka is generating your instrumental. This panel refreshes automatically while the task is processing.</p>}
          {status?.audioUrl && (
            <div className="space-y-2 rounded-lg border border-border/50 p-3">
              <audio controls preload="none" className="w-full" src={status.audioUrl} />
              <a href={status.audioUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open generated audio</a>
            </div>
          )}
          {status?.choices && status.choices.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Generated outputs</h4>
              {status.choices.map((choice, index) => choice.audioUrl ? (
                <div key={`${choice.title}-${index}`} className="rounded-lg border border-border/50 p-3 space-y-2">
                  <p className="text-xs font-medium">{choice.title}</p>
                  <audio controls preload="none" className="w-full" src={choice.audioUrl} />
                </div>
              ) : null)}
            </div>
          )}
        </section>
      )}

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AUDIO_TYPES.map((at) => {
          const Icon = at.icon;
          return (
            <motion.div key={at.id} variants={fadeUp} className="rounded-xl border border-border/50 bg-background/40 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-sky-400" />
                </div>
                <Badge variant="secondary" className="text-[10px] gap-1"><Lock className="h-2.5 w-2.5" />Not configured</Badge>
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{at.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{at.desc}</p>
              <Button variant="outline" size="sm" disabled className="mt-4 w-full text-xs h-9 border-border/50">Not configured</Button>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MediaStudioView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-sky-500 shadow-lg shadow-orange-500/20">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Media Studio</h1>
          <p className="text-muted-foreground text-sm">
            Text AI defaults to self-hosted Ollama; image/video/speech rendering and Mureka audio require optional providers
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Tabs defaultValue="image" className="w-full">
          <TabsList className="bg-background/60 -md border border-border/50 h-auto p-1">
            <TabsTrigger
              value="image"
              className="gap-1.5 px-4 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Image</span>
            </TabsTrigger>
            <TabsTrigger
              value="text"
              className="gap-1.5 px-4 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
            >
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Text</span>
            </TabsTrigger>
            <TabsTrigger
              value="video"
              className="gap-1.5 px-4 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
            >
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Video</span>
            </TabsTrigger>
            <TabsTrigger
              value="audio"
              className="gap-1.5 px-4 py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white"
            >
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Audio</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="mt-6">
            <ImageStudio />
          </TabsContent>

          <TabsContent value="text" className="mt-6">
            <TextStudio />
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            <VideoStudio />
          </TabsContent>

          <TabsContent value="audio" className="mt-6">
            <AudioStudio />
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <VideoCaptionerAndVoicePanel />
        </div>
      </motion.div>
    </div>
  );
}

export default MediaStudioView;
