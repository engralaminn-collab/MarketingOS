"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, Copy, Sparkles, RotateCcw, Moon, Sun, Loader2 } from "lucide-react";
import {
  DIAGRAM_TYPES,
  EXAMPLE_SPECS,
  parseSpec,
  renderDiagram,
  type DiagramSpec,
} from "@/lib/diagram-design/render";
import type { ThemeName } from "@/lib/diagram-design/tokens";

type DiagramType = DiagramSpec["type"];

function specText(type: DiagramType): string {
  return JSON.stringify(EXAMPLE_SPECS[type], null, 2);
}

export function DiagramStudioView() {
  const [type, setType] = useState<DiagramType>("flowchart");
  const [text, setText] = useState<string>(() => specText("flowchart"));
  const [theme, setTheme] = useState<ThemeName>("light");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Parse + render on every edit. Errors are shown inline instead of crashing the view.
  const { svg, error } = useMemo(() => {
    try {
      const spec = parseSpec(text);
      return { svg: renderDiagram(spec, theme), error: null as string | null };
    } catch (e) {
      return { svg: "", error: (e as Error).message };
    }
  }, [text, theme]);

  const chooseType = (next: DiagramType) => {
    setType(next);
    setText(specText(next));
  };

  const download = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-${theme}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySvg = async () => {
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(svg);
      toast.success("SVG copied to clipboard");
    } catch {
      toast.error("Could not access the clipboard");
    }
  };

  const generate = async () => {
    const description = prompt.trim();
    if (!description) {
      toast.error("Describe the diagram first");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ type: DiagramType; json: string }>("/api/ai/diagram", {
        description,
        type,
        format: "spec",
      });
      setText(res.json);
      toast.success("Diagram spec generated — review it, then download");
    } catch (e) {
      toast.error((e as Error).message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diagram Studio</h1>
        <p className="text-sm text-muted-foreground">
          Editorial diagrams built on the Diagram Design system: one accent, no shadows, Instrument Serif titles. Edit the JSON spec or describe a diagram and let AI draft the spec.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Diagram type">
        {DIAGRAM_TYPES.map((d) => (
          <Button
            key={d.id}
            size="sm"
            variant={type === d.id ? "default" : "outline"}
            onClick={() => chooseType(d.id)}
            title={d.hint}
            aria-pressed={type === d.id}
          >
            {d.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Describe it with AI</CardTitle>
          <CardDescription>AI writes a {DIAGRAM_TYPES.find((d) => d.id === type)?.label.toLowerCase()} spec from your description. Falls back to the example if AI is unavailable.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Customer onboarding from signup to first campaign sent"
            onKeyDown={(e) => {
              if (e.key === "Enter") generate();
            }}
          />
          <Button onClick={generate} disabled={generating} className="shrink-0">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate spec
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Spec (JSON)</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setText(specText(type))}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset example
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              className="min-h-[420px] font-mono text-xs"
              aria-label="Diagram spec JSON"
            />
            {error ? (
              <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Valid spec.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Preview</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{theme === "light" ? "Light" : "Dark"}</Badge>
              <Button variant="outline" size="sm" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle preview theme">
                {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="sm" onClick={copySvg} disabled={!svg}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy SVG
              </Button>
              <Button size="sm" onClick={download} disabled={!svg}>
                <Download className="mr-2 h-3.5 w-3.5" /> Download SVG
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {svg ? (
              <div
                className="overflow-auto rounded-md border bg-background p-2"
                // SVG is generated by renderDiagram(), which escapes every user string.
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Fix the spec to see a preview.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
