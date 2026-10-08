"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Play, Loader2, Copy, BookOpen } from "lucide-react";

interface SkillSummary {
  slug: string;
  name: string;
  description: string;
  version: string;
  referenceCount: number;
}

interface SkillIndex {
  source: string;
  license: string;
  upstreamVersion: string;
  skills: SkillSummary[];
}

interface SkillFull extends SkillSummary {
  body: string;
  references: { path: string; content: string }[];
}

export function MarketingKitView() {
  const [index, setIndex] = useState<SkillIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [skill, setSkill] = useState<SkillFull | null>(null);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [tab, setTab] = useState<"guide" | "run">("guide");

  useEffect(() => {
    api
      .get<SkillIndex>("/api/marketing-kit")
      .then((data) => {
        setIndex(data);
        setSelected((prev) => prev ?? data.skills[0]?.slug ?? null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api
      .get<SkillFull>(`/api/marketing-kit?slug=${encodeURIComponent(selected)}`)
      .then(setSkill)
      .catch((e: Error) => toast.error(e.message));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = index?.skills ?? [];
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.slug.includes(q));
  }, [index, query]);

  const run = async () => {
    if (!skill) return;
    const text = input.trim();
    if (!text) {
      toast.error("Describe what you want the skill to work on");
      return;
    }
    setRunning(true);
    setOutput("");
    try {
      const res = await api.post<{ output: string }>("/api/marketing-kit", { slug: skill.slug, input: text });
      setOutput(res.output);
    } catch (e) {
      toast.error((e as Error).message || "The skill failed to run");
    } finally {
      setRunning(false);
    }
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied");
    } catch {
      toast.error("Could not access the clipboard");
    }
  };

  if (loadError) {
    return <div className="p-6 text-sm text-destructive">Could not load the Marketing Kit: {loadError}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Marketing Kit</h1>
        <p className="text-sm text-muted-foreground">
          {index ? `${index.skills.length} marketing skills` : "Loading skills…"} you can read and run on your own brief.
          {index && (
            <>
              {" "}Source:{" "}
              <a className="underline" href={index.source} target="_blank" rel="noopener noreferrer">marketingskills</a>{" "}
              ({index.license}, v{index.upstreamVersion}).
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" className="pl-8" aria-label="Search skills" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
              <ul className="divide-y">
                {filtered.map((s) => (
                  <li key={s.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        if (s.slug === selected) return;
                        setSkill(null);
                        setOutput("");
                        setSelected(s.slug);
                        setTab("guide");
                      }}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/60 ${selected === s.slug ? "bg-muted" : ""}`}
                      aria-current={selected === s.slug ? "true" : undefined}
                    >
                      <div className="font-medium">{s.name}</div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{s.description}</div>
                    </button>
                  </li>
                ))}
                {index && filtered.length === 0 && <li className="p-4 text-sm text-muted-foreground">No skills match “{query}”.</li>}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          {!skill ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading skill…
            </div>
          ) : (
            <>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{skill.name}</CardTitle>
                  {skill.version && <Badge variant="outline">v{skill.version}</Badge>}
                  <Badge variant="secondary">{skill.referenceCount} references</Badge>
                </div>
                <CardDescription>{skill.description}</CardDescription>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant={tab === "guide" ? "default" : "outline"} onClick={() => setTab("guide")}>
                    <BookOpen className="mr-2 h-3.5 w-3.5" /> Guide
                  </Button>
                  <Button size="sm" variant={tab === "run" ? "default" : "outline"} onClick={() => setTab("run")}>
                    <Play className="mr-2 h-3.5 w-3.5" /> Run on my brief
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tab === "guide" ? (
                  <ScrollArea className="h-[560px] pr-4">
                    <article className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{skill.body}</ReactMarkdown>
                    </article>
                  </ScrollArea>
                ) : (
                  <div className="space-y-4">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`Paste your product, page, audience, or the material to work on. The ${skill.name} skill will follow its own guide.`}
                      className="min-h-[140px]"
                    />
                    <div className="flex items-center gap-2">
                      <Button onClick={run} disabled={running}>
                        {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        Run skill
                      </Button>
                      {output && (
                        <Button variant="outline" onClick={copyOutput}>
                          <Copy className="mr-2 h-4 w-4" /> Copy output
                        </Button>
                      )}
                    </div>
                    {output && (
                      <ScrollArea className="h-[420px] rounded-md border p-4">
                        <article className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{output}</ReactMarkdown>
                        </article>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
