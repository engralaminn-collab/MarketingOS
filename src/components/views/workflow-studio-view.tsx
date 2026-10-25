'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  GitBranch,
  Play,
  Plus,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, useApiQuery } from '@/hooks/use-api';

interface WorkflowRecord {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  steps: string;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
}

const WORKFLOW_BLUEPRINTS = [
  {
    name: 'GTM Waterfall Lead Enrichment & Routing',
    description: 'Enrich new inbound leads (DNS/MX + domain metadata), score ICP fit, and create high-priority follow-up task.',
    trigger: 'lead.created',
    steps: [
      { type: 'enrich_lead', label: 'Domain & MX Waterfall Enrichment' },
      { type: 'score_icp', label: 'Compute 0-100 Firmographic Score' },
      { type: 'create_notification', label: 'Notify Assigned AE in Unified Inbox' },
    ],
  },
  {
    name: 'UKVI Student Intake → CAS & IELTS Verification',
    description: 'ukvi-ai-markting_n8n template: Validate IELTS >= 6.0 & 28-day maintenance funds, tag lead, and draft counselor welcome.',
    trigger: 'student.inquiry',
    steps: [
      { type: 'ukvi_cas_check', label: 'Calculate 9-Month Maintenance + Remaining Tuition' },
      { type: 'tag_lead', label: 'Tag UKVI-Ready / Pre-Sessional Required' },
      { type: 'draft_email', label: 'Create Counselor Document Checklist Draft' },
    ],
  },
  {
    name: 'Market Intelligence Radar → Competitor Battlecard',
    description: 'Monitor RSS/News feeds, filter noise via ICP exclusion rules, and draft sales battlecard update.',
    trigger: 'feed.high_signal',
    steps: [
      { type: 'filter_icp', label: 'Apply Sector & Keyword Exclusion Rules' },
      { type: 'extract_entities', label: 'Extract Company, Deal & Pricing Signals' },
      { type: 'save_wiki', label: 'Append Citation to [[Competitor Battlecard]]' },
    ],
  },
  {
    name: 'Zero-Slop Editorial Content Pipeline',
    description: 'Generate draft via Free AI Router, run 24-rule blader/humanizer pass, and queue in Content Approval.',
    trigger: 'schedule.weekly',
    steps: [
      { type: 'free_llm_draft', label: 'Draft via Groq / OpenRouter :free / Ollama' },
      { type: 'humanizer_qa', label: 'Enforce AI-Slop Score < 15' },
      { type: 'save_draft', label: 'Stage in Content Calendar for Review' },
    ],
  },
];

export default function WorkflowStudioView() {
  const { data: wfResp, refetch } = useApiQuery<any>('/api/workflows');
  const workflows: WorkflowRecord[] = Array.isArray(wfResp) ? wfResp : wfResp?.workflows || wfResp?.data || [];

  const [customName, setCustomName] = useState('');
  const [customTrigger, setCustomTrigger] = useState('lead.created');
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<Record<string, unknown> | null>(null);

  async function installBlueprint(bp: (typeof WORKFLOW_BLUEPRINTS)[number]) {
    try {
      await apiFetch('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: bp.name,
          description: bp.description,
          trigger: bp.trigger,
          steps: bp.steps,
          isActive: true,
        }),
      });
      toast.success(`Installed workflow "${bp.name}"`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to install blueprint');
    }
  }

  async function createCustomWorkflow() {
    if (!customName.trim()) return;
    try {
      await apiFetch('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: customName,
          description: 'Custom visual automation pipeline',
          trigger: customTrigger,
          steps: [
            { type: 'log_activity', label: 'Record Audit Trail Event' },
            { type: 'create_notification', label: 'Send Workspace Alert' },
          ],
          isActive: true,
        }),
      });
      setCustomName('');
      toast.success('Created workflow');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create workflow');
    }
  }

  async function runWorkflow(workflowId: string) {
    setExecutingId(workflowId);
    try {
      const res = await apiFetch<{ data?: Record<string, unknown>; run?: Record<string, unknown> }>('/api/workflows/execute', {
        method: 'POST',
        body: JSON.stringify({ workflowId, payload: { source: 'studio-manual-trigger', timestamp: new Date().toISOString() } }),
      });
      setLastExecution((res.data || res.run || res) as Record<string, unknown>);
      refetch();
      toast.success('Workflow executed successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Workflow execution failed');
    } finally {
      setExecutingId(null);
    }
  }

  function exportN8nJson(wf: WorkflowRecord) {
    let parsedSteps: Array<{ type?: string; label?: string }> = [];
    try {
      parsedSteps = JSON.parse(wf.steps || '[]');
    } catch {
      parsedSteps = [];
    }
    const n8n = {
      name: wf.name,
      nodes: [
        { id: 'trigger_1', name: `Trigger: ${wf.trigger}`, type: 'n8n-nodes-base.webhook', position: [220, 300] },
        ...parsedSteps.map((s, idx) => ({
          id: `step_${idx + 1}`,
          name: s.label || s.type || `Step ${idx + 1}`,
          type: 'n8n-nodes-base.httpRequest',
          position: [460 + idx * 240, 300],
        })),
      ],
    };
    const blob = new Blob([JSON.stringify(n8n, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wf.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-n8n.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Visual Workflow & n8n Automation Studio</h1>
          <Badge variant="secondary">Live Execution · GTM & UKVI Blueprints · n8n JSON Export</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Build, execute, and export event-driven marketing & UKVI admissions automations backed by `Workflow` & `WorkflowRun` tables.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {WORKFLOW_BLUEPRINTS.map((bp) => (
          <Card key={bp.name}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">{bp.name}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{bp.description}</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{bp.trigger}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {bp.steps.map((s, idx) => (
                  <React.Fragment key={s.type}>
                    <span className="rounded bg-muted px-2 py-1 text-[11px] font-medium">{idx + 1}. {s.label}</span>
                    {idx < bp.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                  </React.Fragment>
                ))}
              </div>
              <Button size="sm" variant="secondary" onClick={() => installBlueprint(bp)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Install Blueprint to Workspace
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick-Create Custom Trigger Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Workflow Name</Label>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. High-Score Lead Slack & CRM Alert" />
          </div>
          <div>
            <Label className="text-xs">Event Trigger</Label>
            <select value={customTrigger} onChange={(e) => setCustomTrigger(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-xs block">
              <option value="lead.created">lead.created</option>
              <option value="deal.won">deal.won</option>
              <option value="student.inquiry">student.inquiry</option>
              <option value="content.published">content.published</option>
            </select>
          </div>
          <Button onClick={createCustomWorkflow}><Zap className="mr-1.5 h-4 w-4" /> Create Workflow</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Active Workspace Workflows ({workflows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Install any blueprint above to activate your first workflow.</p>
          ) : (
            workflows.map((wf) => (
              <div key={wf.id} className="rounded-lg border p-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{wf.name}</span>
                    <Badge variant={wf.isActive ? 'default' : 'outline'}>{wf.isActive ? 'Active' : 'Paused'}</Badge>
                    <Badge variant="secondary" className="font-mono text-[10px]">{wf.trigger}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Runs: {wf.runCount} {wf.lastRunAt ? `· Last run ${new Date(wf.lastRunAt).toLocaleString()}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportN8nJson(wf)}>
                    <Download className="mr-1 h-3.5 w-3.5" /> n8n JSON
                  </Button>
                  <Button size="sm" onClick={() => runWorkflow(wf.id)} disabled={executingId === wf.id}>
                    <Play className="mr-1 h-3.5 w-3.5" /> {executingId === wf.id ? 'Running...' : 'Execute Now'}
                  </Button>
                </div>
              </div>
            ))
          )}

          {lastExecution && (
            <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 p-3 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Latest WorkflowRun Result
              </div>
              <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(lastExecution, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
