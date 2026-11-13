'use client';

import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowUpRight, CheckCircle2, CircleAlert, Cloud, Copy, GitBranch, Loader2, RefreshCw, Rocket, Server, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/hooks/use-api";
import { toast } from "sonner";

type Run = { id: number; name: string; status: string; conclusion: string | null; html_url: string; created_at: string };
type Status = { configured: boolean; provider: string; repository: string | null; workflow: string; branch: string; runs: Run[]; providerError?: string };

const projectBrief = `Project: [Project Name]\nDeploy Target: alo-server-lap (103.231.239.79)\nDomain: xxx.alolabs.net\nAllocated Port: [operator-assigned]\nStack: Node.js 24.22.1 · Next.js 16 App Router · npm 11\nDatabase: PostgreSQL 14 (shared) or SQLite (standalone) · Redis 6 optional\nProcess: PM2 + Nginx · TLS: Let's Encrypt · Cloudflare proxy\nDeliverables: package.json start script honoring PORT, .env.example, npm run build, repository access\nLogs: /home/alamin/.pm2/logs/[app-name]-*.log`;

export default function DeploymentsView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [imageTag, setImageTag] = useState("latest");
  const [projectName, setProjectName] = useState("");
  const [domain, setDomain] = useState("");
  const [port, setPort] = useState("3062");
  const [briefCopied, setBriefCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStatus(await apiFetch<Status>("/api/deployments")); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load deployment status"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const dispatch = async () => {
    if (!window.confirm(`Queue a production deployment of image “${imageTag}”? The server pipeline will run its configured safety checks.`)) return;
    setDeploying(true);
    try {
      const result = await apiFetch<{ message: string }>("/api/deployments", { method: "POST", body: JSON.stringify({ imageTag }) });
      toast.success(result.message);
      window.setTimeout(() => void load(), 2500);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Deployment request failed"); }
    finally { setDeploying(false); }
  };

  const copyBrief = async () => {
    const brief = `${projectBrief.replace("[Project Name]", projectName || "[Project Name]").replace("xxx.alolabs.net", domain || "xxx.alolabs.net").replace("[operator-assigned]", port || "[operator-assigned]")}\n`;
    try { await navigator.clipboard.writeText(brief); setBriefCopied(true); window.setTimeout(() => setBriefCopied(false), 1800); toast.success("Project brief copied"); }
    catch { toast.error("Clipboard access is unavailable"); }
  };

  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2"><Badge variant="secondary">Operations</Badge><Badge variant="outline">Human approval required</Badge></div><h1 className="text-3xl font-bold tracking-tight">Deployments & Hosting</h1><p className="mt-2 max-w-2xl text-muted-foreground">Coordinate production releases from the dashboard. GitHub Actions remains the privileged deployment runner; no SSH key or shell command is exposed to the browser.</p></div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh status</Button>
    </div>
    <div className="flex gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0"/><div><strong>Compatibility check before rollout</strong><p className="mt-1">The current MarketingOS repository targets Node 22.23.2 with Bun and Prisma SQLite, and its production workflow deploys a container. Your supplied server brief specifies Node 24/npm/PM2 and PostgreSQL. These are not interchangeable configurations; reconcile the runtime, database and deploy method before connecting or dispatching a release. The provided server IP/domain are treated as operator-supplied details, not as verified live infrastructure.</p></div></div>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader className="pb-2"><CardDescription>Target host (operator-provided)</CardDescription><CardTitle className="flex items-center gap-2 text-lg"><Server className="h-5 w-5 text-primary" />alo-server-lap</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">103.231.239.79 · Ubuntu 22.04 LTS<br/>PM2 · Nginx · Cloudflare</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardDescription>Release controller</CardDescription><CardTitle className="flex items-center gap-2 text-lg"><GitBranch className="h-5 w-5 text-primary" />{status?.provider || "GitHub Actions"}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{status?.repository || "Repository not configured"}<br/>Workflow: {status?.workflow || "deploy.yml"} · branch: {status?.branch || "main"}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardDescription>Deployment security</CardDescription><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-600" />Guarded release</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">CI gate · verified backup · safe schema sync · health check · rollback</CardContent></Card>
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" />Release control</CardTitle><CardDescription>Queues the configured GitHub Actions workflow. It does not execute shell commands from the browser.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {!status?.configured ? <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0"/><div><strong>Release provider needs setup</strong><p className="mt-1">Configure <code>DEPLOY_GITHUB_REPOSITORY</code> and <code>DEPLOY_GITHUB_TOKEN</code> in the server environment. Grant the token Actions read/write access and limit it to the intended repository. Never paste deployment credentials into this dashboard.</p></div></div> : <div className="flex gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/><div><strong>GitHub Actions connected</strong><p className="mt-1">Dispatch is limited to the server-configured repository, workflow and branch.</p></div></div>}
          {status?.providerError && <p className="text-sm text-destructive">{status.providerError}</p>}
          <div className="space-y-2"><Label htmlFor="image-tag">Image tag</Label><Input id="image-tag" value={imageTag} onChange={e => setImageTag(e.target.value)} placeholder="latest or commit SHA" /><p className="text-xs text-muted-foreground">Allowed: <code>latest</code> or a 7–40 character commit SHA.</p></div>
          <Button onClick={() => void dispatch()} disabled={!status?.configured || deploying || !/^(latest|[a-f0-9]{7,40})$/i.test(imageTag.trim())}>{deploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Rocket className="mr-2 h-4 w-4"/>}Queue production deploy</Button>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><strong className="text-foreground">AI agent policy:</strong> agents can prepare release notes and recommend a commit, but dispatch remains gated by a human confirmation here. Autonomous production deployment should only be enabled after you explicitly authorize a separate policy and audit control.</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5"/>Recent workflow runs</CardTitle><CardDescription>Live read-only status from the configured Actions workflow.</CardDescription></CardHeader>
        <CardContent className="space-y-3">{loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading pipeline status…</div> : status?.runs.length ? status.runs.map(run => <div key={run.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{run.name}</p><p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()} · {run.status}{run.conclusion ? ` · ${run.conclusion}` : ""}</p></div><a className="shrink-0 text-primary hover:underline" href={run.html_url} target="_blank" rel="noreferrer" aria-label="Open workflow run"><ArrowUpRight className="h-4 w-4"/></a></div>) : <p className="text-sm text-muted-foreground">{status?.configured ? "No runs were returned for this workflow." : "Connect GitHub Actions to see recent release runs."}</p>}</CardContent>
      </Card>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5"/>Shareable project brief</CardTitle><CardDescription>Prepare a project handoff using the hosting standards you supplied. Port allocation, DNS, TLS and server provisioning still require operator approval.</CardDescription></CardHeader>
      <CardContent><div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label htmlFor="project-name">Project</Label><Input id="project-name" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name"/></div><div className="space-y-2"><Label htmlFor="domain">Domain</Label><Input id="domain" value={domain} onChange={e => setDomain(e.target.value)} placeholder="app.alolabs.net"/></div><div className="space-y-2"><Label htmlFor="port">Allocated port</Label><Input id="port" value={port} onChange={e => setPort(e.target.value)} inputMode="numeric" placeholder="3062"/></div></div><Button className="mt-4" variant="outline" onClick={() => void copyBrief()}><Copy className="mr-2 h-4 w-4"/>{briefCopied ? "Copied" : "Copy project brief"}</Button></CardContent>
    </Card>
    <p className="text-xs text-muted-foreground">Additional deployment providers can be added behind the same provider adapter interface. This dashboard does not claim the supplied VPS is reachable, nor does it modify its PM2, Nginx, DNS or TLS configuration.</p>
  </div>;
}
