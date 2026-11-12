'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Globe, Search, Target, Users, TrendingUp, ShieldCheck, DollarSign,
  CheckCircle2, AlertCircle, Clock, FileText, BarChart3, Zap, Building2,
  Eye, ThumbsUp, ThumbsDown, Activity, Database, Lock
} from 'lucide-react';

const API_BASE = '/api/v1';

async function apiFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mos_token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function GrowthEngineView() {
  const [activeTab, setActiveTab] = useState('discovery');

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Universal Growth Engine</h2>
          <p className="text-muted-foreground text-sm">
            AI-powered lead discovery, buyer intent analysis, customer acquisition, and organic growth — industry-agnostic, country-agnostic, free-first.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Zap className="h-3 w-3" /> Multi-tenant
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 h-auto">
          <TabsTrigger value="discovery" className="text-xs">Discovery</TabsTrigger>
          <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
          <TabsTrigger value="intent" className="text-xs">Intent</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs">Campaigns</TabsTrigger>
          <TabsTrigger value="approvals" className="text-xs">Approvals</TabsTrigger>
          <TabsTrigger value="cost" className="text-xs">Cost</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
          <TabsTrigger value="website" className="text-xs">Website</TabsTrigger>
          <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
          <TabsTrigger value="providers" className="text-xs">Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="discovery"><DiscoveryTab /></TabsContent>
        <TabsContent value="leads"><LeadsTab /></TabsContent>
        <TabsContent value="intent"><IntentTab /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
        <TabsContent value="approvals"><ApprovalsTab /></TabsContent>
        <TabsContent value="cost"><CostTab /></TabsContent>
        <TabsContent value="compliance"><ComplianceTab /></TabsContent>
        <TabsContent value="website"><WebsiteTab /></TabsContent>
        <TabsContent value="social"><SocialTab /></TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Discovery Tab (Mode A — Universal Discovery) ──────────────────────────
function DiscoveryTab() {
  const [summary, setSummary] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        apiFetch('/discovery/summary'),
        apiFetch('/discovery/opportunities?limit=10'),
      ]);
      setSummary(s);
      setOpportunities(o.opportunities || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Globe className="h-4 w-4" />} label="Active Campaigns" value={summary?.campaigns?.active || 0} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Market Opportunities" value={Object.values(summary?.opportunities || {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Discovered Leads" value={Object.values(summary?.discoveredLeads || {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)} />
        <StatCard icon={<Database className="h-4 w-4" />} label="Data Providers" value={Object.values(summary?.providers || {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Universal Discovery (Mode A)</CardTitle>
              <CardDescription>Market opportunities discovered across configured industries and countries</CardDescription>
            </div>
            <Button size="sm" onClick={async () => {
              try { await apiFetch('/discovery/run', { method: 'POST', body: JSON.stringify({}) }); load(); } catch (e: any) { setError(e.message); }
            }}>
              <Search className="h-4 w-4 mr-1" /> Run Discovery
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> :
           opportunities.length === 0 ? (
             <p className="text-sm text-muted-foreground">No market opportunities yet. Run discovery or record opportunities with evidence.</p>
           ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{opp.title}</h4>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">{opp.opportunityType.replace(/_/g, ' ')}</Badge>
                        <Badge variant={opp.confidenceLevel === 'high' ? 'default' : 'secondary'} className="text-xs">{opp.confidenceLevel}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{opp.description}</p>
                    {opp.evidence && (
                      <div className="text-xs bg-muted p-2 rounded">
                        <span className="font-medium">Evidence: </span>
                        {JSON.parse(opp.evidence).length} source(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Leads Tab (Public Lead Discovery with Provenance) ─────────────────────
function LeadsTab() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/leads/discover?limit=20');
      setLeads(data.discoveredLeads || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discovered Leads — Full Source Provenance</CardTitle>
          <CardDescription>Every lead records source URL, provider, discovery timestamp, confidence, and review status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> :
           leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No discovered leads yet. Use the API to record leads with provenance.</p>
           ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {leads.map((dl) => (
                  <div key={dl.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{dl.businessName}</h4>
                      <Badge variant={dl.reviewStatus === 'approved' ? 'default' : 'secondary'} className="text-xs">{dl.reviewStatus}</Badge>
                    </div>
                    {dl.officialWebsite && <p className="text-xs text-blue-500">{dl.officialWebsite}</p>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      <span className="truncate">Source: {dl.sourceUrl}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">Confidence: {dl.confidenceLevel}</Badge>
                      <Badge variant="outline">Freshness: {dl.dataFreshness}</Badge>
                      {dl.sourceProvider && <Badge variant="outline">{dl.sourceProvider.name}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Intent Tab (Buyer Intent + Explainable Scoring) ───────────────────────
function IntentTab() {
  const [leadId, setLeadId] = useState('');
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchScore = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/leads/${leadId}/score`);
      setBreakdown(data);
      setError('');
    } catch (e: any) {
      setError(e.message);
      setBreakdown(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Buyer Intent & Explainable Lead Scoring</CardTitle>
          <CardDescription>Score breakdown by dimension with supporting evidence. No invented intent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Enter lead ID..." value={leadId} onChange={(e) => setLeadId(e.target.value)} />
            <Button onClick={fetchScore} disabled={loading || !leadId}>
              <Eye className="h-4 w-4 mr-1" /> Get Score
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {breakdown && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{breakdown.totalScore}</div>
                <div className="flex-1">
                  <Progress value={breakdown.totalScore} />
                  <p className="text-xs text-muted-foreground mt-1">Total Score (0-100)</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Score Breakdown by Dimension</h4>
                {breakdown.dimensions?.map((d: any) => (
                  <div key={d.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{d.dimension.replace(/_/g, ' ')}</span>
                      <span>{d.score}/{d.maxScore}</span>
                    </div>
                    <Progress value={(d.score / d.maxScore) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground italic">{d.evidence}</p>
                  </div>
                ))}
              </div>
              {breakdown.intentSignals?.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Buyer Intent Signals ({breakdown.intentSignals.length})</h4>
                    {breakdown.intentSignals.map((s: any) => (
                      <div key={s.id} className="border rounded p-2 space-y-1">
                        <div className="flex justify-between">
                          <Badge variant="outline" className="text-xs">{s.signalType.replace(/_/g, ' ')}</Badge>
                          <span className="text-xs">Strength: {s.signalStrength}/100</span>
                        </div>
                        <p className="text-xs italic">"{s.evidenceText}"</p>
                        {s.evidenceUrl && <p className="text-xs text-blue-500">{s.evidenceUrl}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Campaigns Tab (Mode B — Admin-Controlled Targeting) ───────────────────
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/discovery/campaigns');
      setCampaigns(data.campaigns || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discovery Campaigns (Mode B — Admin-Controlled Targeting)</CardTitle>
          <CardDescription>Configure industry, country, audience, keywords, and source selection per campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> :
           campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet. Create one via the API to target specific industries and countries.</p>
           ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{c.name}</h4>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">{c.mode}</Badge>
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-xs">{c.status}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Budget: {c.budgetPreference}</span>
                    <span>•</span>
                    <span>Autonomy: {c.autonomyLevel}</span>
                  </div>
                </div>
              ))}
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Approvals Tab (Suggest/Approve/Automate) ──────────────────────────────
function ApprovalsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/approvals');
      setRequests(data.approvalRequests || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    try {
      await apiFetch(`/approvals/${id}?action=${action}`, { method: 'POST', body: JSON.stringify({}) });
      load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Queue — Suggest / Approve / Automate</CardTitle>
          <CardDescription>Every paid, publishing, outbound, or credential action requires human approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> :
           requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending approvals. All clear.</p>
           ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{r.requestType.replace(/_/g, ' ')}</Badge>
                    <Badge variant="secondary" className="text-xs">{r.autonomyLevel}</Badge>
                  </div>
                  <p className="text-xs">{JSON.parse(r.payload).action}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => act(r.id, 'approve')}>
                      <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(r.id, 'reject')}>
                      <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Cost Tab (Free-First Cost Intelligence, USD) ──────────────────────────
function CostTab() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/cost/summary?days=30');
      setSummary(data);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Cost (30d)" value={`$${(summary?.totalCostUsd || 0).toFixed(4)}`} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Operations" value={summary?.totalOperations || 0} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Free-Tier Ops" value={summary?.totalFreeTierOps || 0} />
        <StatCard icon={<Zap className="h-4 w-4" />} label="Free-Tier Ratio" value={`${((summary?.freeTierRatio || 0) * 100).toFixed(0)}%`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost Intelligence — Free-First, USD</CardTitle>
          <CardDescription>Tracks all API/provider costs. Warns before quota exhaustion. Requires approval for paid usage.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> :
           summary?.byProvider?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cost events recorded yet.</p>
           ) : (
            <div className="space-y-2">
              {summary?.byProvider?.map((p: any) => (
                <div key={p.provider} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="text-sm font-medium">{p.provider}</p>
                    <p className="text-xs text-muted-foreground">{p.count} ops • {p.freeTierUsed} free-tier</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">${p.totalCostUsd.toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground">avg ${p.avgCostUsd.toFixed(4)}</p>
                  </div>
                </div>
              ))}
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Compliance Tab (Consent, Opt-out, Retention) ──────────────────────────
function ComplianceTab() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/compliance/summary');
      setSummary(data);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="DNC Suppressed" value={summary?.suppressionListCount || 0} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Opted Out" value={summary?.optedOutLeads || 0} />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Retention Policies" value={summary?.retentionPolicies?.length || 0} />
        <StatCard icon={<Lock className="h-4 w-4" />} label="Active Consents" value={Object.values(summary?.activeConsentsByKind || {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy & Compliance</CardTitle>
          <CardDescription>Consent tracking, DNC suppression, opt-out management, data retention enforcement.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> : (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium mb-2">Active Consents by Kind</h4>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(summary?.activeConsentsByKind || {}).map(([kind, count]: any) => (
                    <Badge key={kind} variant="outline" className="text-xs">{kind.replace(/_/g, ' ')}: {count}</Badge>
                  ))}
                  {Object.keys(summary?.activeConsentsByKind || {}).length === 0 && (
                    <p className="text-xs text-muted-foreground">No active consents recorded.</p>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Retention Policies</h4>
                {summary?.retentionPolicies?.length > 0 ? (
                  <div className="space-y-1">
                    {summary.retentionPolicies.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span>{p.dataType}</span>
                        <span className="text-muted-foreground">{p.retentionDays} days → {p.deletionAction}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No retention policies set.</p>
                )}
              </div>
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Website Tab (SEO Audit) ───────────────────────────────────────────────
function WebsiteTab() {
  const [url, setUrl] = useState('');
  const [audits, setAudits] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAudit = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const data = await apiFetch('/seo-audit', { method: 'POST', body: JSON.stringify({ url }) });
      setResult(data);
      setError('');
      loadAudits();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAudits = async () => {
    try {
      const data = await apiFetch('/seo-audit?limit=10');
      setAudits(data.audits || []);
    } catch (e: any) {}
  };

  useEffect(() => { loadAudits(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Website Growth Engine — Real SEO Audit</CardTitle>
          <CardDescription>Technical SEO, content gaps, performance, structured data, conversion optimization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button onClick={runAudit} disabled={loading || !url}>
              <Search className="h-4 w-4 mr-1" /> Audit
            </Button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{result.overallScore}</div>
                <div className="flex-1">
                  <Progress value={result.overallScore} />
                  <p className="text-xs text-muted-foreground mt-1">SEO Score (0-100)</p>
                </div>
              </div>
              {result.issues?.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Issues Found ({result.issues.length})</h4>
                  {result.issues.slice(0, 10).map((issue: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {issue.severity === 'critical' ? <AlertCircle className="h-3 w-3 text-red-500 mt-0.5" /> :
                       issue.severity === 'warning' ? <AlertCircle className="h-3 w-3 text-yellow-500 mt-0.5" /> :
                       <CheckCircle2 className="h-3 w-3 text-blue-500 mt-0.5" />}
                      <div>
                        <span className="font-medium">{issue.title}</span>
                        <p className="text-muted-foreground">{issue.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {audits.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Audits</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {audits.map((a) => (
                <div key={a.id} className="flex justify-between text-xs">
                  <span className="truncate">{a.url}</span>
                  <Badge variant="outline">{a.overallScore}/100</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Social Tab (Audience Metrics + Content Calendar) ──────────────────────
function SocialTab() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([
        apiFetch('/social/audience-metrics?limit=10'),
        apiFetch('/social/content-calendar?limit=10'),
      ]);
      setMetrics(m.metrics || []);
      setCalendar(c.items || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Audience Growth</CardTitle>
          <CardDescription>Authorized social accounts analytics, content calendar, trend analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> : (
            <div className="space-y-3">
              {metrics.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Audience Metrics</h4>
                  {metrics.map((m) => (
                    <div key={m.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <p className="text-sm font-medium capitalize">{m.platform}</p>
                        <p className="text-xs text-muted-foreground">{m.followersCount} followers</p>
                      </div>
                      <div className="flex gap-2">
                        {m.engagementRate && <Badge variant="outline" className="text-xs">{m.engagementRate.toFixed(1)}% eng</Badge>}
                        {m.growthDelta !== 0 && <Badge variant={m.growthDelta > 0 ? 'default' : 'destructive'} className="text-xs">{m.growthDelta > 0 ? '+' : ''}{m.growthDelta}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No audience metrics recorded yet.</p>}
              <Separator />
              {calendar.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Content Calendar</h4>
                  {calendar.map((c) => (
                    <div key={c.id} className="flex justify-between items-center text-xs">
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-muted-foreground">{c.platform} • {new Date(c.scheduledAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline">{c.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No content calendar items yet.</p>}
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Providers Tab (Free-First Data Provider Registry) ─────────────────────
function ProvidersTab() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/data-providers${filter ? `?category=${filter}` : ''}`);
      setProviders(data.providers || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Free-First Data Provider Registry</CardTitle>
          <CardDescription>Verified public, official API, and open-data sources. Never claims a source is free or integrated until verified.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="public_market">Public Market</SelectItem>
                <SelectItem value="social_community">Social/Community</SelectItem>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="open_data">Open Data</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           error ? <p className="text-sm text-red-500">{error}</p> : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {providers.map((p) => (
                  <div key={p.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{p.name}</h4>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">{p.category}</Badge>
                        <Badge variant={p.integrationStatus === 'integrated' ? 'default' : 'secondary'} className="text-xs">{p.integrationStatus}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.officialUrl}</p>
                    <div className="flex gap-2 text-xs flex-wrap">
                      <Badge variant="outline">Free: {p.freeTierLimit}</Badge>
                      <Badge variant="outline">Reliability: {p.sourceReliability}/100</Badge>
                      {p.licensingAndReuse && <Badge variant="outline">License: {p.licensingAndReuse.substring(0, 30)}</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      {p.verificationStatus === 'verified' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Clock className="h-3 w-3 text-yellow-500" />}
                      <span className="text-muted-foreground">Verified: {p.verificationStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
           )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Stat Card helper ──────────────────────────────────────────────────────
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded">{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
