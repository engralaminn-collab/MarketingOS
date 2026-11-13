'use client';

import React, { useState } from 'react';
import { GitBranch, Play, Plus, Pause, History } from 'lucide-react';
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
  trigger: string;
  steps: Array<{ type: string; label?: string }>;
  validationError: string | null;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
}
interface RunRecord { id: string; status: string; startedAt: string; error: string | null }

export default function WorkflowStudioView() {
  const { data: response, refetch } = useApiQuery<WorkflowRecord[]>('/api/workflows');
  const workflows = Array.isArray(response) ? response : [];
  const [name, setName] = useState('');
  const [includeDraft, setIncludeDraft] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [historyName, setHistoryName] = useState('');
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);

  async function createWorkflow() {
    if (!name.trim()) return;
    try {
      const steps = [
        { type: 'log_activity', label: 'Record a workspace activity' },
        { type: 'create_notification', label: 'Notify the person running it' },
        ...(includeDraft ? [{ type: 'email', label: 'Create an email draft' }] : []),
      ];
      await apiFetch('/api/workflows', { method: 'POST', body: JSON.stringify({ name, trigger: 'manual', steps, isActive: true }) });
      setName('');
      toast.success('Manual workflow created');
      refetch();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create workflow'); }
  }

  async function run(wf: WorkflowRecord) {
    setExecuting(wf.id);
    setLastResult(null);
    try {
      const result = await apiFetch<{ data: Record<string, unknown> }>('/api/workflows/execute', {
        method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ workflowId: wf.id }),
      });
      setLastResult(result.data);
      if (result.data.status === 'completed') toast.success('Local workflow steps completed');
      else toast.info('Run is still in progress; check history before starting another.');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Run failed. Check history before retrying.');
      refetch();
    } finally { setExecuting(null); }
  }

  async function toggle(wf: WorkflowRecord) {
    try {
      await apiFetch(`/api/workflows/${encodeURIComponent(wf.id)}`, { method: 'PATCH', body: JSON.stringify({ isActive: !wf.isActive }) });
      toast.success(wf.isActive ? 'Workflow paused' : 'Workflow enabled for manual runs');
      refetch();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not change workflow'); }
  }

  async function showHistory(wf: WorkflowRecord) {
    try {
      const result = await apiFetch<{ data: RunRecord[] }>(`/api/workflows/${encodeURIComponent(wf.id)}/runs`);
      setHistoryName(wf.name);
      setRuns(result.data);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load history'); }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">Workflow Studio</h1><Badge variant="outline">Manual runs only</Badge></div>
        <p className="text-sm text-muted-foreground">Run bounded local steps: activity, workspace notification, and email draft. No email or SMS is sent. Event triggers, schedules, n8n export and automatic retries are not implemented.</p>
      </header>
      <Card>
        <CardHeader><CardTitle className="text-base">Create a manual workflow</CardTitle><CardDescription>Each run records an activity and notifies its operator. You can add an email draft.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-2"><Label htmlFor="workflow-name">Name</Label><Input id="workflow-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} placeholder="e.g. Review campaign" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeDraft} onChange={(event) => setIncludeDraft(event.target.checked)} /> Add email draft</label>
          <Button onClick={createWorkflow} disabled={!name.trim()}><Plus className="mr-1 h-4 w-4" /> Create</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GitBranch className="h-4 w-4" /> Workspace workflows</CardTitle><CardDescription>Legacy workflows with unsupported steps are retained but cannot run until repaired.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {workflows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No workflows yet.</p>}
          {workflows.map((wf) => <div key={wf.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{wf.name}</span><Badge variant={wf.isActive ? 'default' : 'outline'}>{wf.isActive ? 'Enabled' : 'Paused'}</Badge><Badge variant="secondary">{wf.trigger === 'manual' ? 'Manual' : `Legacy: ${wf.trigger} (manual only)`}</Badge></div><p className="text-xs text-muted-foreground">{wf.steps.map((step) => step.label || step.type).join(' → ')} · {wf.runCount} recorded runs</p>{wf.validationError && <p className="text-xs text-destructive">{wf.validationError}</p>}</div>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => showHistory(wf)}><History className="mr-1 h-3.5 w-3.5" /> History</Button><Button size="sm" variant="outline" onClick={() => toggle(wf)}><Pause className="mr-1 h-3.5 w-3.5" /> {wf.isActive ? 'Pause' : 'Enable'}</Button><Button size="sm" onClick={() => run(wf)} disabled={!wf.isActive || !!wf.validationError || executing !== null}><Play className="mr-1 h-3.5 w-3.5" /> {executing === wf.id ? 'Running…' : 'Run now'}</Button></div>
          </div>)}
          {lastResult && <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Last run result</p><pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(lastResult, null, 2)}</pre></div>}
          {runs && <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Run history: {historyName}</p>{runs.length ? runs.map((entry) => <p key={entry.id} className="mt-1">{new Date(entry.startedAt).toLocaleString()} · {entry.status} · {entry.id}{entry.error ? ` · ${entry.error}` : ''}</p>) : <p className="mt-1 text-muted-foreground">No runs recorded.</p>}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
