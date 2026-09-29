"use client";

import { useState, useCallback } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Target, TrendingUp, Plus, Trash2, RefreshCw, Loader2,
  AlertTriangle, Globe, Activity, ExternalLink, Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Competitor {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  strengths: string[];
  weaknesses: string[];
  pricing: string | null;
  marketShare: string | null;
  threatLevel: "low" | "medium" | "high";
  updatedAt: string;
}

interface Keyword {
  id: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  trend: "up" | "down" | "stable";
  lastPosition: number | null;
  updatedAt: string;
}

interface MarketIntelData {
  summary: {
    totalCompetitors: number;
    highThreatCompetitors: number;
    mediumThreatCompetitors: number;
    lowThreatCompetitors: number;
    totalKeywords: number;
    totalSearchVolume: number;
    avgDifficulty: number;
  };
  competitors: Competitor[];
  keywords: Keyword[];
  opportunities: any[];
  recentEvents: any[];
}

const THREAT_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

const TREND_ICONS: Record<string, string> = {
  up: "↗",
  down: "↘",
  stable: "→",
};

export default function MarketIntelligenceView() {
  const { data, isLoading, refetch } = useApiQuery<MarketIntelData>("/api/market-intelligence");
  const [addCompetitorOpen, setAddCompetitorOpen] = useState(false);
  const [addKeywordOpen, setAddKeywordOpen] = useState(false);

  const [competitorForm, setCompetitorForm] = useState({
    name: "", website: "", description: "", threatLevel: "medium",
    strengths: "", weaknesses: "", pricing: "", marketShare: "",
  });
  const [keywordForm, setKeywordForm] = useState({
    keyword: "", searchVolume: "1000", difficulty: "30", trend: "stable",
  });

  const addCompetitorMut = useApiMutation({
    method: "POST",
    path: "/api/competitors",
    onSuccess: () => { toast.success("Competitor added"); setAddCompetitorOpen(false); refetch(); },
    onError: (e) => toast.error(e),
  });

  const addKeywordMut = useApiMutation({
    method: "POST",
    path: "/api/keywords",
    onSuccess: () => { toast.success("Keyword tracked"); setAddKeywordOpen(false); refetch(); },
    onError: (e) => toast.error(e),
  });

  const handleDeleteCompetitor = useCallback(async (id: string) => {
    const token = localStorage.getItem("mos_token");
    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Competitor deleted");
      refetch();
    } catch {
      toast.error("Failed to delete competitor");
    }
  }, [refetch]);

  const handleDeleteKeyword = useCallback(async (id: string) => {
    const token = localStorage.getItem("mos_token");
    try {
      const res = await fetch(`/api/keywords/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Keyword removed");
      refetch();
    } catch {
      toast.error("Failed to delete keyword");
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const intel = (data as unknown as { data?: MarketIntelData })?.data ?? data;
  const summary = intel?.summary || {
    totalCompetitors: 0, highThreatCompetitors: 0, mediumThreatCompetitors: 0, lowThreatCompetitors: 0,
    totalKeywords: 0, totalSearchVolume: 0, avgDifficulty: 0,
  };
  const competitors = intel?.competitors || [];
  const keywords = intel?.keywords || [];
  const opportunities = intel?.opportunities || [];
  const recentEvents = intel?.recentEvents || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-purple-600 bg-clip-text text-transparent">
            Market Intelligence Radar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track competitors, monitor keywords, and spot opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddKeywordOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Track Keyword
          </Button>
          <Button size="sm" onClick={() => setAddCompetitorOpen(true)} className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Competitor
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Competitors tracked</p>
                <p className="text-2xl font-bold">{summary.totalCompetitors}</p>
              </div>
              <Shield className="h-8 w-8 text-orange-500/40" />
            </div>
            <div className="mt-2 flex gap-1.5 text-[10px]">
              <Badge variant="outline" className={THREAT_STYLES.high}>{summary.highThreatCompetitors} high</Badge>
              <Badge variant="outline" className={THREAT_STYLES.medium}>{summary.mediumThreatCompetitors} med</Badge>
              <Badge variant="outline" className={THREAT_STYLES.low}>{summary.lowThreatCompetitors} low</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Keywords tracked</p>
                <p className="text-2xl font-bold">{summary.totalKeywords}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500/40" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Total volume: {summary.totalSearchVolume.toLocaleString()}/mo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg keyword difficulty</p>
                <p className="text-2xl font-bold">{summary.avgDifficulty}/100</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500/40" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {summary.avgDifficulty < 30 ? "Easy to rank" : summary.avgDifficulty < 60 ? "Moderate competition" : "Hard to rank"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Recent alerts</p>
                <p className="text-2xl font-bold">{recentEvents.length}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500/40" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Last 10 radar events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Competitors List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" />
              Competitors ({competitors.length})
            </CardTitle>
            <CardDescription>Track what your competitors are doing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {competitors.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No competitors yet. Click "Add Competitor" to start tracking.
              </p>
            ) : competitors.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-border/60 p-3 group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      {c.name}
                      <Badge variant="outline" className={`text-[10px] ${THREAT_STYLES[c.threatLevel]}`}>
                        {c.threatLevel}
                      </Badge>
                    </h4>
                    {c.website && (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5 mt-0.5"
                      >
                        <Globe className="h-3 w-3" />
                        {c.website.replace(/^https?:\/\//, "").slice(0, 40)}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteCompetitor(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {c.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.description}</p>
                )}
                {(c.strengths.length > 0 || c.weaknesses.length > 0) && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                    {c.strengths.length > 0 && (
                      <div>
                        <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">Strengths</p>
                        <ul className="space-y-0.5">
                          {c.strengths.slice(0, 3).map((s, i) => (
                            <li key={i} className="text-muted-foreground">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.weaknesses.length > 0 && (
                      <div>
                        <p className="text-red-600 dark:text-red-400 font-medium mb-0.5">Weaknesses</p>
                        <ul className="space-y-0.5">
                          {c.weaknesses.slice(0, 3).map((w, i) => (
                            <li key={i} className="text-muted-foreground">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {(c.pricing || c.marketShare) && (
                  <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                    {c.pricing && <span>Pricing: <span className="font-medium text-foreground">{c.pricing}</span></span>}
                    {c.marketShare && <span>Share: <span className="font-medium text-foreground">{c.marketShare}</span></span>}
                  </div>
                )}
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Keywords List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Tracked Keywords ({keywords.length})
            </CardTitle>
            <CardDescription>Monitor search volume + difficulty trends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {keywords.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No keywords tracked yet. Click "Track Keyword" to start.
              </p>
            ) : keywords.map((k) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-border/60 p-3 group flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{k.keyword}</p>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span>Vol: <span className="font-medium text-foreground">{k.searchVolume.toLocaleString()}</span>/mo</span>
                    <span>Diff: <span className="font-medium text-foreground">{k.difficulty}/100</span></span>
                    {k.lastPosition !== null && (
                      <span>Pos: <span className="font-medium text-foreground">#{k.lastPosition}</span></span>
                    )}
                    <span className={k.trend === "up" ? "text-emerald-500" : k.trend === "down" ? "text-red-500" : ""}>
                      {TREND_ICONS[k.trend]} {k.trend}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteKeyword(k.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </motion.div>
            ))}
            {opportunities.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/60">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-emerald-500" />
                  Top Opportunities (high volume / low difficulty)
                </p>
                <div className="space-y-1">
                  {opportunities.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{o.keyword}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Score: {o.opportunityScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              Recent Radar Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEvents.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 text-xs">
                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  <span className="flex-1 truncate">{e.description}</span>
                  <span className="text-muted-foreground/60">
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Competitor Dialog */}
      <Dialog open={addCompetitorOpen} onOpenChange={setAddCompetitorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>Track a competitor on your market intelligence radar</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="comp-name">Name *</Label>
              <Input id="comp-name" value={competitorForm.name} onChange={(e) => setCompetitorForm({ ...competitorForm, name: e.target.value })} placeholder="Acme Inc" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comp-website">Website</Label>
                <Input id="comp-website" value={competitorForm.website} onChange={(e) => setCompetitorForm({ ...competitorForm, website: e.target.value })} placeholder="https://acme.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comp-threat">Threat level</Label>
                <Select value={competitorForm.threatLevel} onValueChange={(v) => setCompetitorForm({ ...competitorForm, threatLevel: v })}>
                  <SelectTrigger id="comp-threat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-desc">Description</Label>
              <Textarea id="comp-desc" value={competitorForm.description} onChange={(e) => setCompetitorForm({ ...competitorForm, description: e.target.value })} placeholder="What does this competitor do?" className="min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comp-strengths">Strengths (comma-sep)</Label>
                <Input id="comp-strengths" value={competitorForm.strengths} onChange={(e) => setCompetitorForm({ ...competitorForm, strengths: e.target.value })} placeholder="Brand, pricing, distribution" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comp-weaknesses">Weaknesses (comma-sep)</Label>
                <Input id="comp-weaknesses" value={competitorForm.weaknesses} onChange={(e) => setCompetitorForm({ ...competitorForm, weaknesses: e.target.value })} placeholder="Slow support, limited features" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="comp-pricing">Pricing</Label>
                <Input id="comp-pricing" value={competitorForm.pricing} onChange={(e) => setCompetitorForm({ ...competitorForm, pricing: e.target.value })} placeholder="$99/mo" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comp-share">Market share</Label>
                <Input id="comp-share" value={competitorForm.marketShare} onChange={(e) => setCompetitorForm({ ...competitorForm, marketShare: e.target.value })} placeholder="~15%" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCompetitorOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const token = localStorage.getItem("mos_token");
                addCompetitorMut.mutate({
                  name: competitorForm.name,
                  website: competitorForm.website || undefined,
                  description: competitorForm.description || undefined,
                  threatLevel: competitorForm.threatLevel,
                  strengths: competitorForm.strengths ? competitorForm.strengths.split(",").map((s) => s.trim()).filter(Boolean) : [],
                  weaknesses: competitorForm.weaknesses ? competitorForm.weaknesses.split(",").map((s) => s.trim()).filter(Boolean) : [],
                  pricing: competitorForm.pricing || undefined,
                  marketShare: competitorForm.marketShare || undefined,
                });
              }}
              disabled={!competitorForm.name.trim() || addCompetitorMut.isLoading}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
            >
              {addCompetitorMut.isLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Add Competitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Keyword Dialog */}
      <Dialog open={addKeywordOpen} onOpenChange={setAddKeywordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Track Keyword</DialogTitle>
            <DialogDescription>Monitor a keyword&apos;s search volume and difficulty</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-keyword">Keyword *</Label>
              <Input id="kw-keyword" value={keywordForm.keyword} onChange={(e) => setKeywordForm({ ...keywordForm, keyword: e.target.value })} placeholder="ai marketing automation" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kw-vol">Monthly search volume</Label>
                <Input id="kw-vol" type="number" min="0" value={keywordForm.searchVolume} onChange={(e) => setKeywordForm({ ...keywordForm, searchVolume: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kw-diff">Difficulty (0-100)</Label>
                <Input id="kw-diff" type="number" min="0" max="100" value={keywordForm.difficulty} onChange={(e) => setKeywordForm({ ...keywordForm, difficulty: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-trend">Trend</Label>
              <Select value={keywordForm.trend} onValueChange={(v) => setKeywordForm({ ...keywordForm, trend: v })}>
                <SelectTrigger id="kw-trend"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">↗ Up</SelectItem>
                  <SelectItem value="stable">→ Stable</SelectItem>
                  <SelectItem value="down">↘ Down</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddKeywordOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                addKeywordMut.mutate({
                  keyword: keywordForm.keyword,
                  searchVolume: parseInt(keywordForm.searchVolume) || 0,
                  difficulty: parseInt(keywordForm.difficulty) || 0,
                  trend: keywordForm.trend,
                });
              }}
              disabled={!keywordForm.keyword.trim() || addKeywordMut.isLoading}
            >
              {addKeywordMut.isLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Track Keyword
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
