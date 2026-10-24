'use client';

import React, { useMemo, useState } from 'react';
import { Filter, Radar, Rss, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/hooks/use-api';

const RSSHUB_PRESETS = [
  { label: 'Product Hunt Today', url: 'https://www.producthunt.com/feed' },
  { label: 'Hacker News Frontpage', url: 'https://hnrss.org/frontpage' },
  { label: 'UK Gov Visas & Immigration Updates', url: 'https://www.gov.uk/government/organisations/uk-visas-and-immigration.atom' },
  { label: 'Search Engine Journal SEO', url: 'https://www.searchenginejournal.com/feed/' },
];

export function MarketRadarIcpPanel({
  signals = [],
  onFeedAdded,
}: {
  signals?: Array<{ id: string; title: string; description: string; sourceName: string }>;
  onFeedAdded?: () => void;
}) {
  const [icpKeywords, setIcpKeywords] = useState('funding, expansion, launch, university, partnership, ai, marketing, crm');
  const [excludedTerms, setExcludedTerms] = useState('crypto, meme, celebrity, giveaway, intern');

  const scoredSignals = useMemo(() => {
    const pos = icpKeywords.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    const neg = excludedTerms.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

    const sampleSignals = signals.length
      ? signals
      : [
          {
            id: 'demo-sig-1',
            title: 'B2B SaaS Expansion: European Fintech Opens London Office & Hires VP Marketing',
            description: 'Series B company announces £18M funding and immediate GTM & CRM expansion.',
            sourceName: 'Radar Sample Signal',
          },
          {
            id: 'demo-sig-2',
            title: 'UK University Announces New January Intake Scholarships for South Asian Applicants',
            description: 'Up to £4,000 tuition awards for postgraduate STEM and Business cohorts.',
            sourceName: 'UKVI Education Wire',
          },
        ];

    return sampleSignals.map((sig) => {
      const hay = `${sig.title} ${sig.description}`.toLowerCase();
      const matchedPos = pos.filter((k) => hay.includes(k));
      const matchedNeg = neg.filter((k) => hay.includes(k));
      const score = Math.max(0, Math.min(100, 45 + matchedPos.length * 18 - matchedNeg.length * 40));
      return { ...sig, score, matchedPos, excluded: matchedNeg.length > 0 };
    });
  }, [signals, icpKeywords, excludedTerms]);

  async function addRssPreset(label: string, url: string) {
    try {
      await apiFetch('/api/feeds', {
        method: 'POST',
        body: JSON.stringify({ name: label, url, category: 'market-radar' }),
      });
      toast.success(`Subscribed Radar to ${label}`);
      onFeedAdded?.();
    } catch (err) {
      toast.info(err instanceof Error ? err.message : 'Feed saved or already subscribed');
    }
  }

  async function approveSignalToLead(sig: { title: string; description: string; score: number }) {
    try {
      await apiFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: sig.title.slice(0, 72),
          source: 'Market Intelligence Radar',
          status: 'new',
          score: sig.score,
          notes: sig.description,
        }),
      });
      toast.success('Approved radar signal → created scored Lead in CRM');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not promote signal');
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radar className="h-4 w-4 text-orange-500" /> Market Intelligence Radar — ICP Scoring, Exclusion Rules & RSSHub Presets
        </CardTitle>
        <CardDescription>
          guifav/market-intelligence-radar + DIYgod/RSSHub workflow: score incoming news against division ICP rules and promote qualified buying signals directly into CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Rss className="h-3.5 w-3.5" /> 1-Click RSSHub / Industry Presets:
          </span>
          {RSSHUB_PRESETS.map((p) => (
            <Button key={p.label} size="sm" variant="outline" className="h-7 text-xs" onClick={() => addRssPreset(p.label, p.url)}>
              + {p.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs flex items-center gap-1"><Filter className="h-3 w-3" /> Division ICP Positive Triggers</Label>
            <Input value={icpKeywords} onChange={(e) => setIcpKeywords(e.target.value)} className="text-xs" />
          </div>
          <div>
            <Label className="text-xs">Noise & Sector Exclusion Keywords</Label>
            <Input value={excludedTerms} onChange={(e) => setExcludedTerms(e.target.value)} className="text-xs" />
          </div>
        </div>

        <div className="space-y-2">
          {scoredSignals.slice(0, 6).map((s) => (
            <div key={s.id} className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{s.title}</span>
                  <Badge variant={s.excluded ? 'destructive' : s.score >= 70 ? 'default' : 'secondary'}>
                    ICP {s.score}/100
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5">{s.description}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => approveSignalToLead(s)}>
                <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Approve → CRM
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
