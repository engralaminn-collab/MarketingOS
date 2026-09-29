"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useApiMutation } from "@/hooks/use-api-query";
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
  { id: "square", label: "Square", ratio: "1:1", desc: "1024×1024" },
  { id: "portrait", label: "Portrait", ratio: "2:3", desc: "768×1152" },
  { id: "landscape", label: "Landscape", ratio: "3:2", desc: "1152×768" },
  { id: "wide", label: "Wide", ratio: "16:9", desc: "1344×768" },
] as const;

type ImageSizeId = (typeof IMAGE_SIZES)[number]["id"];

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
  { id: "reels", label: "Instagram Reels", icon: Film, desc: "Create scroll-stopping short-form vertical videos with trending audio, transitions, and on-screen text effects.", status: "coming" as const },
  { id: "shorts", label: "YouTube Shorts", icon: Clapperboard, desc: "Produce engaging vertical videos optimized for YouTube's Shorts algorithm with hooks and retention strategies.", status: "coming" as const },
  { id: "promo", label: "Promo Video", icon: Video, desc: "Generate professional promotional videos with branded intros, product showcases, and compelling CTAs.", status: "coming" as const },
  { id: "avatar", label: "Talking Avatar", icon: UserCircle, desc: "Create AI-powered talking head videos with custom avatars, voice cloning, and multilingual support.", status: "coming" as const },
  { id: "marketing", label: "Marketing Video", icon: Wand2, desc: "Produce complete marketing video campaigns with storyboards, scripts, voiceovers, and editing.", status: "generate" as const },
];

// ─── Audio Studio Cards ─────────────────────────────────────────────────────

const AUDIO_TYPES = [
  { id: "voiceover", label: "Voice Over", icon: Mic, desc: "Generate natural-sounding AI voiceovers in 50+ languages with customizable tone, speed, and emotion for any project.", status: "coming" as const },
  { id: "podcast", label: "AI Podcast", icon: Radio, desc: "Create full podcast episodes with AI hosts, interviews, sound effects, and multi-speaker conversations automatically.", status: "coming" as const },
  { id: "clone", label: "Voice Clone", icon: UserCircle, desc: "Clone your voice or any authorized voice to generate consistent audio content at scale without re-recording.", status: "coming" as const },
];

// ─── Image Studio Sub-Component ─────────────────────────────────────────────

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [selectedSize, setSelectedSize] = useState<ImageSizeId>("square");
  const [images, setImages] = useState<{ url: string; prompt: string }[]>([]);

  const generateMutation = useApiMutation<{ url: string }>({
    method: "POST",
    path: "/api/ai/generate-image",
    onSuccess: (data) => {
      const result = data as unknown as { url?: string; imageUrl?: string; images?: string[] };
      const url = result?.url || result?.imageUrl || (result?.images?.[0]);
      if (url) {
        setImages((prev) => [...prev, { url, prompt }]);
      }
      toast.success("Image generated successfully!");
    },
    onError: (err) => {
      toast.error(err || "Failed to generate image");
    },
  });

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    generateMutation.mutate({ prompt: prompt.trim(), size: selectedSize });
  }, [prompt, selectedSize, generateMutation]);

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Prompt Input */}
      <motion.div variants={fadeUp} className="space-y-3">
        <Label className="text-sm font-medium">Describe your image</Label>
        <div className="flex gap-2">
          <Textarea
            placeholder="A futuristic city at sunset with neon lights reflecting on wet streets..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
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
                      className="h-8 w-8 rounded-lg bg-black/40 backdrop-blur-sm border-0 text-white hover:bg-black/60"
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
  const [copied, setCopied] = useState(false);

  const activeContentType = CONTENT_TYPES.find((c) => c.id === activeType)!;

  const generateMutation = useApiMutation<{ content: string }>({
    method: "POST",
    path: "/api/ai/chat",
    onSuccess: (data) => {
      const res = data as unknown as { content?: string; message?: string; response?: string };
      setResult(res?.content || res?.message || res?.response || JSON.stringify(data));
      setCopied(false);
    },
    onError: (err) => {
      toast.error(err || "Failed to generate content");
    },
  });

  const handleGenerate = useCallback(() => {
    if (!topic.trim()) return;
    setResult(null);
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
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-card/60 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-orange-400 border-orange-500/30"
                >
                  {activeContentType.label}
                </Badge>
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

function VideoStudio() {
  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VIDEO_TYPES.map((vt) => {
          const Icon = vt.icon;
          return (
            <motion.div
              key={vt.id}
              variants={fadeUp}
              whileHover={{ y: -4, scale: 1.01 }}
              className={[
                "group relative rounded-xl border border-border/50 bg-background/40 p-5 transition-all",
                "hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5",
              ].join(" ")}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-sky-500/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-orange-400" />
                </div>
                {vt.status === "coming" ? (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Coming Soon
                  </Badge>
                ) : null}
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{vt.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {vt.desc}
              </p>
              <div className="mt-4">
                {vt.status === "coming" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full text-xs h-9 border-border/50"
                  >
                    Coming Soon
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full text-xs h-9 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-500/10"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Generate
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ─── Audio Studio Sub-Component ─────────────────────────────────────────────

function AudioStudio() {
  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AUDIO_TYPES.map((at) => {
          const Icon = at.icon;
          return (
            <motion.div
              key={at.id}
              variants={fadeUp}
              whileHover={{ y: -4, scale: 1.01 }}
              className={[
                "group relative rounded-xl border border-border/50 bg-background/40 p-5 transition-all",
                "hover:border-sky-500/30 hover:shadow-lg hover:shadow-sky-500/5",
              ].join(" ")}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-sky-400" />
                </div>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Lock className="h-2.5 w-2.5" />
                  Coming Soon
                </Badge>
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{at.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {at.desc}
              </p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="w-full text-xs h-9 border-border/50"
                >
                  Coming Soon
                </Button>
              </div>
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
            Create images, text, video, and audio with AI
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
          <TabsList className="bg-background/60 backdrop-blur-md border border-border/50 h-auto p-1">
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
      </motion.div>
    </div>
  );
}

export default MediaStudioView;
