'use client';

import { useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/use-api';
import { UtmAndFunnelAttributionPanel } from '@/components/studio/utm-attribution-panel';

type Period = '7d' | '30d' | '90d' | '1y';
interface AnalyticsData {
  period: { from: string; to: string };
  overview: { leadsCount: number; ticketsCount: number; contactsCount: number; wonDealValue: number; wonDealCount: number; pipelineValue: number; pipelineDealCount: number };
}

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>('30d');
  const { data, isLoading, error, refetch } = useApiQuery<AnalyticsData>(`/api/analytics?period=${period}`);
  const overview = data?.overview;
  const internal = overview ? [
    { label: 'New leads in period', value: overview.leadsCount.toLocaleString() },
    { label: 'New tickets in period', value: overview.ticketsCount.toLocaleString() },
    { label: 'Contacts (all time)', value: overview.contactsCount.toLocaleString() },
    { label: 'Won deal value (all time)', value: overview.wonDealValue.toLocaleString(), detail: `${overview.wonDealCount} CRM deals · currency unspecified` },
    { label: 'Open pipeline value (all time)', value: overview.pipelineValue.toLocaleString(), detail: `${overview.pipelineDealCount} CRM deals · currency unspecified` },
  ] : [];
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Analytics</h1><p className="text-sm text-muted-foreground">Workspace records and unavailable provider metrics are kept separate.</p></div>
      <div className="flex gap-2">{(['7d', '30d', '90d', '1y'] as const).map((item) => <Button key={item} variant={period === item ? 'default' : 'outline'} size="sm" onClick={() => setPeriod(item)}>{item}</Button>)}<Button size="icon" variant="outline" aria-label="Refresh analytics" onClick={refetch}><RefreshCw className="h-4 w-4" /></Button></div>
    </header>
    {isLoading && <p className="text-sm text-muted-foreground">Loading workspace data…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {overview && <>
      <Card><CardHeader><CardTitle className="text-base">Internal CRM records</CardTitle><CardDescription>Leads and tickets use the selected time window; contacts and deal values are all-time. Won deal value is not confirmed revenue or campaign attribution.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{internal.map((item) => <div key={item.label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-xl font-semibold">{item.value}</p>{item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}</div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Marketing performance <Badge variant="outline">Unavailable</Badge></CardTitle><CardDescription>Reach, impressions, engagement, conversions, spend, revenue, cost per lead and ROI require verified provider data and attribution. A campaign budget is not actual spend.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['Reach', 'Engagement', 'Conversion rate', 'Actual spend', 'Attributed revenue', 'Cost per lead', 'ROI'].map((label) => <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">—</p></div>)}</CardContent></Card>
    </>}
    <UtmAndFunnelAttributionPanel />
  </div>;
}
