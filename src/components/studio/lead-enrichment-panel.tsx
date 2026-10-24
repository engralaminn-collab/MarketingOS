'use client';

import React, { useState } from 'react';
import { CheckCircle2, DatabaseZap, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/hooks/use-api';

interface EnrichLeadItem {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
  score: number;
}

export function LeadEnrichmentPanel({ leads, onReload }: { leads: EnrichLeadItem[]; onReload: () => void }) {
  const [lookupInput, setLookupInput] = useState('sarah@github.com');
  const [enrichingLookup, setEnrichingLookup] = useState(false);
  const [lookupResult, setLookupResult] = useState<Record<string, unknown> | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  async function handleInstantEnrich() {
    const val = lookupInput.trim();
    if (!val) return;
    setEnrichingLookup(true);
    try {
      const qs = val.includes('@')
        ? `email=${encodeURIComponent(val)}`
        : `domain=${encodeURIComponent(val)}`;
      const res = await apiFetch<{ data: Record<string, unknown> }>(`/api/leads/enrich?${qs}`);
      setLookupResult(res.data);
      toast.success('Waterfall domain & MX enrichment complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setEnrichingLookup(false);
    }
  }

  async function handleEnrichTopLeads() {
    const candidates = leads.filter((l) => l.email).slice(0, 5);
    if (!candidates.length) {
      toast.info('Add leads with email addresses first');
      return;
    }
    setBatchRunning(true);
    let ok = 0;
    for (const l of candidates) {
      try {
        await apiFetch(`/api/leads/${encodeURIComponent(l.id)}/enrich`, { method: 'POST' });
        ok += 1;
      } catch {
        // continue waterfall batch
      }
    }
    setBatchRunning(false);
    onReload();
    toast.success(`Waterfall-enriched ${ok}/${candidates.length} CRM leads`);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <DatabaseZap className="h-4 w-4 text-orange-500" /> OpenProspector / Bricks Waterfall B2B Lead Enrichment
            </CardTitle>
            <CardDescription>
              DNS MX verification, corporate vs free-mail classification, domain metadata & cached firmographic scoring (`/api/leads/enrich`).
            </CardDescription>
          </div>
          <Button size="sm" variant="secondary" onClick={handleEnrichTopLeads} disabled={batchRunning}>
            {batchRunning ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Waterfall-Enrich Top 5 Leads
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value)}
            placeholder="Enter work email (alice@acme.com) or company domain (acme.com)..."
          />
          <Button onClick={handleInstantEnrich} disabled={enrichingLookup}>
            {enrichingLookup ? 'Enriching...' : 'Inspect Domain / Email'}
          </Button>
        </div>

        {lookupResult && (
          <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Live Waterfall Enrichment Record
              <Badge variant="outline">EnrichmentCache</Badge>
            </div>
            <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(lookupResult, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
