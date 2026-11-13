'use client';

import React, { useMemo, useState } from 'react';
import { Copy, Link2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function UtmAndFunnelAttributionPanel() {
  const [baseUrl, setBaseUrl] = useState('https://demo-agency.com/ukvi-consultation');
  const [source, setSource] = useState('linkedin');
  const [medium, setMedium] = useState('paid_social');
  const [campaign, setCampaign] = useState('2026_q4_intake');
  const [content, setContent] = useState('carousel_hook_a');

  const [visitors, setVisitors] = useState('10000');
  const [optInPct, setOptInPct] = useState('4.2');
  const [sqlPct, setSqlPct] = useState('28');
  const [winPct, setWinPct] = useState('22');
  const [dealValue, setDealValue] = useState('2400');

  const utmUrl = useMemo(() => {
    try {
      const u = new URL(baseUrl);
      if (source) u.searchParams.set('utm_source', source.trim().toLowerCase().replace(/\s+/g, '_'));
      if (medium) u.searchParams.set('utm_medium', medium.trim().toLowerCase().replace(/\s+/g, '_'));
      if (campaign) u.searchParams.set('utm_campaign', campaign.trim().toLowerCase().replace(/\s+/g, '_'));
      if (content) u.searchParams.set('utm_content', content.trim().toLowerCase().replace(/\s+/g, '_'));
      return u.toString();
    } catch {
      return 'Enter a valid https:// destination URL';
    }
  }, [baseUrl, source, medium, campaign, content]);

  const funnel = useMemo(() => {
    const v = Math.max(0, parseFloat(visitors) || 0);
    const leads = Math.round(v * ((parseFloat(optInPct) || 0) / 100));
    const sqls = Math.round(leads * ((parseFloat(sqlPct) || 0) / 100));
    const customers = Math.round(sqls * ((parseFloat(winPct) || 0) / 100));
    const revenue = customers * (parseFloat(dealValue) || 0);
    return { leads, sqls, customers, revenue };
  }, [visitors, optInPct, sqlPct, winPct, dealValue]);

  return (
    <div className="grid gap-6 lg:grid-cols-2 mt-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-orange-500" /> Umami-Style UTM Governance & Campaign Link Builder
          </CardTitle>
          <CardDescription>Standardized lowercase snake_case UTM tags for clean multi-touch attribution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Destination URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">utm_source</Label><Input value={source} onChange={(e) => setSource(e.target.value)} /></div>
            <div><Label className="text-xs">utm_medium</Label><Input value={medium} onChange={(e) => setMedium(e.target.value)} /></div>
            <div><Label className="text-xs">utm_campaign</Label><Input value={campaign} onChange={(e) => setCampaign(e.target.value)} /></div>
            <div><Label className="text-xs">utm_content</Label><Input value={content} onChange={(e) => setContent(e.target.value)} /></div>
          </div>
          <div className="rounded border bg-muted/40 p-2.5 text-xs font-mono break-all flex items-center justify-between gap-2">
            <span>{utmUrl}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(utmUrl);
                toast.success('Copied UTM attribution link');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-orange-500" /> Full-Funnel Pipeline & Revenue Simulator
          </CardTitle>
          <CardDescription>Model Visitor → Lead → SQL → Closed-Won revenue impact before launching spend</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            <div><Label className="text-[11px]">Visitors</Label><Input value={visitors} onChange={(e) => setVisitors(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-[11px]">Signup %</Label><Input value={optInPct} onChange={(e) => setOptInPct(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-[11px]">SQL %</Label><Input value={sqlPct} onChange={(e) => setSqlPct(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-[11px]">Win %</Label><Input value={winPct} onChange={(e) => setWinPct(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-[11px]">ACV ($)</Label><Input value={dealValue} onChange={(e) => setDealValue(e.target.value)} className="h-8 text-xs" /></div>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            <div className="rounded border p-2.5">
              <div className="text-[11px] text-muted-foreground">Leads</div>
              <div className="font-bold text-base">{funnel.leads.toLocaleString()}</div>
            </div>
            <div className="rounded border p-2.5">
              <div className="text-[11px] text-muted-foreground">SQLs</div>
              <div className="font-bold text-base">{funnel.sqls.toLocaleString()}</div>
            </div>
            <div className="rounded border p-2.5">
              <div className="text-[11px] text-muted-foreground">Deals Won</div>
              <div className="font-bold text-base">{funnel.customers.toLocaleString()}</div>
            </div>
            <div className="rounded border border-primary bg-primary/5 p-2.5">
              <div className="text-[11px] text-primary font-semibold">Est. Revenue</div>
              <div className="font-bold text-base">${funnel.revenue.toLocaleString()}</div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Planning projection — validate conversion assumptions with A/B cohorts
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
