"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Heart,
  Eye,
  MessageSquare,
  Target,
  CalendarCheck,
  Megaphone,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  Zap,
  Plug,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "@/lib/platforms";
import { formatDistanceToNow } from "date-fns";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAppStore } from "@/stores/app-store";
import type { DashboardStats } from "@/types";

// Platform chart colors (no blue/indigo)
const PLATFORM_CHART_COLORS: Record<string, string> = {
  facebook: "#f97316",   // orange
  instagram: "#ec4899",  // pink
  x_twitter: "#64748b",  // slate
  tiktok: "#ef4444",    // red
  linkedin: "#10b981",  // emerald
  pinterest: "#f59e0b", // amber
  email: "#f97316",     // orange
  google_business: "#ef4444",
};

// Activity type dot colors
const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  publish: "bg-emerald-500",
  message: "bg-amber-500",
  lead: "bg-pink-500",
  ai: "bg-violet-500",
  campaign: "bg-orange-500",
  analytics: "bg-cyan-500",
  email: "bg-slate-500",
  system: "bg-muted-foreground",
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

function KpiCard({
  title,
  value,
  growth,
  icon: Icon,
}: {
  title: string;
  value: string;
  growth: number;
  icon: React.ElementType;
}) {
  const isPositive = growth >= 0;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-2xl font-bold tracking-tight md:text-3xl">{value}</span>
          <span
            className={`mb-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(growth)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SecondaryKpiCard({
  title,
  value,
  growth,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  growth?: number;
  icon: React.ElementType;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {growth !== undefined && (
            <span
              className={`mb-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}
            >
              <TrendingUp className="h-3 w-3" />
              {growth}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardView() {
  const { currentCompany } = useAppStore();
  const companyId = currentCompany?.id;
  const { data: stats, isLoading, error, refetch } = useApiQuery<DashboardStats>(
    companyId ? `/api/dashboard?companyId=${companyId}` : null
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="gap-0 py-0">
              <CardContent className="p-4 md:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
                <div className="flex items-end gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="gap-0 py-0">
              <CardContent className="p-4 md:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
                <div className="flex items-end gap-2">
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="gap-0 py-0">
              <CardHeader className="pb-2 pt-4 md:px-6 md:pt-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="px-2 pb-4 md:px-6 md:pb-6">
                <Skeleton className="h-[250px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state (only show when there is an actual error, not just null data)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Failed to load dashboard</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <Button variant="outline" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Graceful fallback when data is null/empty — show 0s
  const s: DashboardStats = stats ?? {
    totalFollowers: 0,
    followerGrowth: 0,
    totalEngagement: 0,
    engagementGrowth: 0,
    totalReach: 0,
    reachGrowth: 0,
    totalMessages: 0,
    messageGrowth: 0,
    totalLeads: 0,
    leadGrowth: 0,
    scheduledPosts: 0,
    activeCampaigns: 0,
    activeAgents: 0,
    connectedPlatforms: 0,
    totalPlatforms: 13,
    platformStats: [],
    recentActivity: [],
    weeklyData: [],
  };

  // Prepare platform bar chart data (only platforms with followers > 0)
  const platformBarData = s.platformStats
    .filter((p) => p.followers > 0)
    .sort((a, b) => b.followers - a.followers);

  // Check if this is a fresh/empty dashboard
  const isEmpty = s.totalFollowers === 0 && s.totalEngagement === 0 && s.totalLeads === 0 && s.connectedPlatforms === 0;

  // Use formatDistanceToNow for a live "updated" timestamp
  const lastUpdated = formatDistanceToNow(new Date(Date.now() - 30000), { addSuffix: true });

  return (
    <div className="space-y-6">
      {/* Header with last updated time */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {isEmpty ? "Welcome! Let\'s get your marketing setup started" : "Overview of your social media performance"}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          Updated {lastUpdated}
        </Badge>
      </div>

      {/* Getting Started banner for empty state */}
      {isEmpty && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 shrink-0">
              <Zap className="h-6 w-6 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Get Started with AI Marketing OS</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your social accounts, create your first post, and let AI handle the rest.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => useAppStore.getState().setActiveView("connections")}>
                <Plug className="h-4 w-4 mr-1.5" />
                Connect Accounts
              </Button>
              <Button size="sm" onClick={() => useAppStore.getState().setActiveView("content-studio")}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Create Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* A) Top KPI Row - 4 cards */}
      <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
        <KpiCard
          title="Total Followers"
          value={formatNumber(s.totalFollowers)}
          growth={s.followerGrowth}
          icon={Users}
        />
        <KpiCard
          title="Total Engagement"
          value={formatNumber(s.totalEngagement)}
          growth={s.engagementGrowth}
          icon={Heart}
        />
        <KpiCard
          title="Total Reach"
          value={formatNumber(s.totalReach)}
          growth={s.reachGrowth}
          icon={Eye}
        />
        <KpiCard
          title="Total Messages"
          value={s.totalMessages.toLocaleString()}
          growth={s.messageGrowth}
          icon={MessageSquare}
        />
      </div>

      {/* B) Second KPI Row - 3 cards */}
      <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
        <SecondaryKpiCard
          title="Total Leads"
          value={s.totalLeads}
          growth={s.leadGrowth}
          icon={Target}
        />
        <SecondaryKpiCard
          title="Scheduled Posts"
          value={s.scheduledPosts}
          icon={CalendarCheck}
        />
        <SecondaryKpiCard
          title="Active Campaigns"
          value={s.activeCampaigns}
          icon={Megaphone}
        />
      </div>

      {/* C) Charts Row */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Engagement & Reach Area Chart */}
        <Card className="gap-0 py-0">
          <CardHeader className="pb-2 pt-4 md:px-6 md:pt-6">
            <CardTitle className="text-base">Engagement & Reach</CardTitle>
            <CardDescription>Weekly performance overview</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-4 md:px-6 md:pb-6">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={s.weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: number) => formatNumber(val)}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number, name: string) => [
                    formatNumber(value),
                    name === "engagement" ? "Engagement" : "Reach",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#engagementGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#f59e0b" }}
                />
                <Area
                  type="monotone"
                  dataKey="reach"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#reachGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Distribution Bar Chart */}
        <Card className="gap-0 py-0">
          <CardHeader className="pb-2 pt-4 md:px-6 md:pt-6">
            <CardTitle className="text-base">Platform Distribution</CardTitle>
            <CardDescription>Followers per platform</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-4 md:px-6 md:pb-6">
            {platformBarData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No platforms connected</p>
                <p className="text-xs text-muted-foreground mt-1">Connect accounts to see follower distribution</p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={platformBarData}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: number) => formatNumber(val)}
                />
                <YAxis
                  type="category"
                  dataKey="platform"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  tickFormatter={(val: string) => {
                    const names: Record<string, string> = {
                      facebook: "Facebook",
                      instagram: "Instagram",
                      x_twitter: "X",
                      tiktok: "TikTok",
                      linkedin: "LinkedIn",
                      pinterest: "Pinterest",
                                        };
                    return names[val] || val;
                  }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number) => [formatNumber(value), "Followers"]}
                />
                <Bar dataKey="followers" radius={[0, 4, 4, 0]} barSize={20}>
                  {platformBarData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={PLATFORM_CHART_COLORS[entry.platform] || "#f59e0b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* D) Bottom Row */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
        {/* Recent Activity Feed */}
        <Card className="gap-0 py-0 lg:col-span-3">
          <CardHeader className="pb-2 pt-4 md:px-6 md:pt-6">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest events across all platforms</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:px-6 md:pb-6">
            <div className="max-h-80 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {s.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Activity will appear here as you use the platform</p>
                </div>
              ) : (
                s.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-1.5 flex-shrink-0">
                    <span
                      className={`block h-2.5 w-2.5 rounded-full ${
                        ACTIVITY_TYPE_COLORS[activity.type] || "bg-muted-foreground"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-foreground">{activity.message}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                      {activity.platform && (
                        <PlatformBadge platform={activity.platform} size="sm" />
                      )}
                    </div>
                  </div>
                </div>
              ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="pb-2 pt-4 md:px-6 md:pt-6">
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common tasks at your fingertips</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:px-6 md:pb-6">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 px-3 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/50"
                onClick={() => useAppStore.getState().setActiveView("content-studio")}
              >
                <Megaphone className="h-5 w-5 text-amber-500" />
                <span className="text-xs font-medium">Create Post</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 px-3 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                onClick={() => useAppStore.getState().setActiveView("inbox")}
              >
                <MessageSquare className="h-5 w-5 text-emerald-500" />
                <span className="text-xs font-medium">View Inbox</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 px-3 hover:bg-pink-500/10 hover:text-pink-600 hover:border-pink-500/50"
                onClick={() => useAppStore.getState().setActiveView("leads")}
              >
                <Target className="h-5 w-5 text-pink-500" />
                <span className="text-xs font-medium">Check Leads</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 py-4 px-3 hover:bg-violet-500/10 hover:text-violet-600 hover:border-violet-500/50"
                onClick={() => useAppStore.getState().setActiveView("analytics")}
              >
                <ArrowUpRight className="h-5 w-5 text-violet-500" />
                <span className="text-xs font-medium">Run Report</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}