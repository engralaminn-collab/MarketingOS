"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, type Variants } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/stores/app-store";
import {
  Link2,
  Users,
  UserPlus,
  FileText,
  Send,
  Rocket,
  DollarSign,
  Bot,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Globe,
  Eye,
  Lightbulb,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface KPIMetric {
  connectedSocialAccounts: number;
  totalLeads: number;
  newLeads30d: number;
  contentCreated: number;
  publishedContent: number;
  activeCampaigns: number;
  revenue: number;
  aiAgentsActive: number;
  seoProgress: number;
}

interface RevenuePoint {
  month: string;
  revenue: number;
  target?: number;
}

interface LeadFunnelStage {
  stage: string;
  count: number;
  conversionRate?: number;
}

interface PlatformDistribution {
  name: string;
  value: number;
  color: string;
}

interface DealPipelineStage {
  stage: string;
  value: number;
  deals: number;
  color: string;
}

interface RecentContent {
  id: string;
  title: string;
  type: string;
  platform: string;
  status: string;
  publishedAt: string;
  engagement: number;
}

interface RecentLead {
  id: string;
  name: string;
  email: string;
  source: string;
  score: number;
  status: string;
  createdAt: string;
}

interface ActiveCampaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  reach: number;
  engagement: number;
  conversions: number;
  startDate: string;
}

interface AIInsight {
  id: string;
  type: "opportunity" | "warning" | "optimization" | "trend";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  action?: string;
  createdAt: string;
}

interface DashboardData {
  kpi: KPIMetric;
  revenueTrend: RevenuePoint[];
  leadFunnel: LeadFunnelStage[];
  platformDistribution: PlatformDistribution[];
  dealPipeline: DealPipelineStage[];
  recentContent: RecentContent[];
  recentLeads: RecentLead[];
  activeCampaigns: ActiveCampaign[];
  aiInsights: AIInsight[];
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

// ─── Gradient Configs ─────────────────────────────────────────────────────────

const kpiConfigs = [
  {
    key: "connectedSocialAccounts" as const,
    label: "Connected Social Accounts",
    icon: Link2,
    gradient: "from-orange-500 to-amber-500",
    shadowColor: "shadow-orange-500/25",
    bgGlow: "bg-orange-500/10",
    iconBg: "bg-orange-500/20",
  },
  {
    key: "totalLeads" as const,
    label: "Total Leads",
    icon: Users,
    gradient: "from-blue-500 to-cyan-500",
    shadowColor: "shadow-blue-500/25",
    bgGlow: "bg-blue-500/10",
    iconBg: "bg-blue-500/20",
  },
  {
    key: "newLeads30d" as const,
    label: "New Leads (30d)",
    icon: UserPlus,
    gradient: "from-emerald-500 to-teal-500",
    shadowColor: "shadow-emerald-500/25",
    bgGlow: "bg-emerald-500/10",
    iconBg: "bg-emerald-500/20",
  },
  {
    key: "contentCreated" as const,
    label: "Content Created",
    icon: FileText,
    gradient: "from-violet-500 to-purple-500",
    shadowColor: "shadow-violet-500/25",
    bgGlow: "bg-violet-500/10",
    iconBg: "bg-violet-500/20",
  },
  {
    key: "publishedContent" as const,
    label: "Published Content",
    icon: Send,
    gradient: "from-rose-500 to-pink-500",
    shadowColor: "shadow-rose-500/25",
    bgGlow: "bg-rose-500/10",
    iconBg: "bg-rose-500/20",
  },
  {
    key: "activeCampaigns" as const,
    label: "Active Campaigns",
    icon: Rocket,
    gradient: "from-orange-600 to-red-500",
    shadowColor: "shadow-orange-600/25",
    bgGlow: "bg-orange-600/10",
    iconBg: "bg-orange-600/20",
  },
  {
    key: "revenue" as const,
    label: "Revenue",
    icon: DollarSign,
    gradient: "from-amber-500 to-orange-600",
    shadowColor: "shadow-amber-500/25",
    bgGlow: "bg-amber-500/10",
    iconBg: "bg-amber-500/20",
  },
  {
    key: "aiAgentsActive" as const,
    label: "AI Agents Active",
    icon: Bot,
    gradient: "from-cyan-500 to-blue-600",
    shadowColor: "shadow-cyan-500/25",
    bgGlow: "bg-cyan-500/10",
    iconBg: "bg-cyan-500/20",
  },
  {
    key: "seoProgress" as const,
    label: "SEO Progress",
    icon: TrendingUp,
    gradient: "from-green-500 to-emerald-600",
    shadowColor: "shadow-green-500/25",
    bgGlow: "bg-green-500/10",
    iconBg: "bg-green-500/20",
  },
];

// ─── Chart Color Palettes ─────────────────────────────────────────────────────

const PIE_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];
const PIPELINE_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899"];
const FUNNEL_COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"];

// ─── Helper: Glass Card Wrapper ───────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof Card>) {
  return (
    <Card
      className={
        "border-border bg-card/60  shadow-lg dark:border-white/5 " +
        className
      }
      {...props}
    >
      {children}
    </Card>
  );
}

// ─── Helper: Empty State ──────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── KPI Card Component ────────────────────────────────────────────────────────

function KPICard({
  config,
  value,
  index,
  subtitle,
}: {
  config: (typeof kpiConfigs)[number];
  value: string | number;
  index: number;
  subtitle?: string;
}) {
  const Icon = config.icon;
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      className="group"
    >
      <div
        className={
          `relative overflow-hidden rounded-xl p-5 shadow-lg ${config.shadowColor} ` +
          `bg-gradient-to-br ${config.gradient} dark:from-opacity-90 dark:to-opacity-90`
        }
      >
        {/* Decorative circle */}
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 transition-transform group-hover:scale-125" />
        <div className="absolute -right-2 -bottom-6 h-20 w-20 rounded-full bg-white/5" />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">{config.label}</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <Icon className="h-4.5 w-4.5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-white/60">{subtitle}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-[130px] rounded-xl bg-muted/50"
          />
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </GlassCard>
        <GlassCard>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </GlassCard>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </GlassCard>
        <GlassCard>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = "",
  valueSuffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/90 px-3 py-2 text-sm shadow-xl -md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-muted-foreground">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {valuePrefix}{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}{valueSuffix}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function DashboardViewInner() {
  const { user } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Every state update below happens after an `await`, so this can be called
  // straight from an effect without writing state synchronously during render.
  // Results from an aborted request (dependency change or unmount) are dropped.
  const fetchDashboard = useCallback(async (signal?: AbortSignal) => {
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("mos_token")
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/dashboard", { headers, signal });
      if (!res.ok) {
        throw new Error(`Request failed (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (signal?.aborted) return;
      // Support both { data: ... } envelope and direct response
      const result = json?.data ?? json;
      setData(result as DashboardData);
      setError(null);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      setError(message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  // Retry / manual refresh. Runs from an event handler, so showing the skeleton
  // immediately is safe here.
  const reloadDashboard = useCallback(() => {
    setIsLoading(true);
    setError(null);
    void fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const controller = new AbortController();
    // Dispatched inside an async scope so the effect body itself performs no
    // state update; every setState in the loader runs after the response awaits.
    void (async () => {
      await fetchDashboard(controller.signal);
    })();
    return () => controller.abort();
  }, [fetchDashboard]);

  // ── Loading ──
  if (isLoading) return <DashboardSkeleton />;

  // ── Error ──
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI CEO Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </p>
        </div>
        <GlassCard className="border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
            <p className="font-medium text-destructive">
              Failed to load dashboard data
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={reloadDashboard}
              className="mt-4 flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </CardContent>
        </GlassCard>
      </div>
    );
  }

  const kpi = data?.kpi;
  const revenueTrend = data?.revenueTrend ?? [];
  const leadFunnel = data?.leadFunnel ?? [];
  const platformDist = data?.platformDistribution ?? [];
  const dealPipeline = data?.dealPipeline ?? [];
  const recentContentRaw: any[] = data?.recentContent ?? [];
  const recentContent = recentContentRaw.map((item: any) => ({
    ...item,
    engagement: typeof item.engagement === 'string' ? (() => { try { const e = JSON.parse(item.engagement); return ((e.likes || 0) + (e.shares || 0) + (e.comments || 0) + (e.clicks || 0)); } catch { return 0; } })() : (item.engagement || 0),
  }));
  const recentLeads = data?.recentLeads ?? [];
  const activeCampaignsRaw: any[] = data?.activeCampaigns ?? [];
  const activeCampaigns = activeCampaignsRaw.map((c: any) => {
    const m = typeof c.metrics === 'string' ? (() => { try { return JSON.parse(c.metrics); } catch { return {}; } })() : (c.metrics || {});
    return { ...c, reach: m.reach || 0, engagement: m.engagement || m.clicks || 0, conversions: m.conversions || 0, platform: c.type || 'multi_channel' };
  });
  const aiInsights = data?.aiInsights ?? [];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  const insightIcon = (type: AIInsight["type"]) => {
    switch (type) {
      case "opportunity":
        return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "optimization":
        return <Zap className="h-4 w-4 text-blue-500" />;
      case "trend":
        return <TrendingUp className="h-4 w-4 text-violet-500" />;
    }
  };

  const impactColor = (impact: AIInsight["impact"]) => {
    switch (impact) {
      case "high":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
  };

  const contentStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "scheduled":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "draft":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      default:
        return "";
    }
  };

  const leadScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-red-500";
  };

  const campaignStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "paused":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "completed":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      default:
        return "";
    }
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Page Header ── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI CEO Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : ""}{" "}
            &mdash; your marketing command center
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Last synced: {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </motion.div>

      {/* ── 1. KPI Cards ── */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
      >
        {kpiConfigs.map((config, index) => {
          const rawValue = kpi?.[config.key] ?? 0;
          let displayValue: string | number = rawValue;
          let subtitle: string | undefined;

          if (config.key === "revenue") {
            displayValue = formatCurrency(rawValue);
          }
          if (config.key === "seoProgress") {
            displayValue = `${rawValue}%`;
          }
          if (config.key === "newLeads30d" && kpi) {
            const pct =
              kpi.totalLeads > 0
                ? Math.round((rawValue / kpi.totalLeads) * 100)
                : 0;
            subtitle = `${pct}% of total leads`;
          }
          if (config.key === "aiAgentsActive") {
            subtitle = "Running 24/7";
          }

          return (
            <KPICard
              key={config.key}
              config={config}
              value={displayValue}
              index={index}
              subtitle={subtitle}
            />
          );
        })}
      </motion.div>

      {/* ── 2 & 3. Revenue Trend + Lead Funnel ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend Area Chart */}
        <motion.div variants={itemVariants}>
          <GlassCard>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Revenue Trend</CardTitle>
                  <CardDescription>Monthly revenue performance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {revenueTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={revenueTrend}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f97316"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f97316"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="targetGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      content={
                    <ChartTooltip valuePrefix="$" />
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
                {revenueTrend.some((d) => d.target != null) && (
                  <Area
                    type="monotone"
                    dataKey="target"
                    name="Target"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#targetGradient)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={BarChart3}
              message="No revenue data available yet"
            />
          )}
        </CardContent>
      </GlassCard>
    </motion.div>

    {/* Lead Funnel Bar Chart */}
    <motion.div variants={itemVariants}>
      <GlassCard>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Lead Funnel</CardTitle>
              <CardDescription>Conversion across pipeline stages</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {leadFunnel.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={leadFunnel}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="count"
                  name="Leads"
                  radius={[6, 6, 0, 0]}
                >
                  {leadFunnel.map((_entry, index) => (
                    <Cell
                      key={`funnel-${index}`}
                      fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={Target}
              message="No lead funnel data available"
            />
          )}
        </CardContent>
      </GlassCard>
    </motion.div>
  </div>

  {/* ── 4 & 5. Platform Distribution + Deal Pipeline ── */}
  <div className="grid gap-6 lg:grid-cols-2">
    {/* Platform Distribution Donut */}
    <motion.div variants={itemVariants}>
      <GlassCard>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500">
              <PieChartIcon className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">
                Platform Distribution
              </CardTitle>
              <CardDescription>Leads by social platform</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {platformDist.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={260}>
                <PieChart>
                  <Pie
                    data={platformDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={0}
                  >
                    {platformDist.map((entry, index) => (
                      <Cell
                        key={`platform-${index}`}
                        fill={
                          entry.color ||
                          PIE_COLORS[index % PIE_COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 min-w-0">
                {platformDist.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          entry.color ||
                          PIE_COLORS[index % PIE_COLORS.length],
                      }}
                    />
                    <span className="truncate text-muted-foreground">
                      {entry.name}
                    </span>
                    <span className="ml-auto font-medium">
                      {entry.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Globe}
              message="No platform data available"
            />
          )}
        </CardContent>
      </GlassCard>
    </motion.div>

    {/* Deal Pipeline Horizontal Bar */}
    <motion.div variants={itemVariants}>
      <GlassCard>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Deal Pipeline</CardTitle>
              <CardDescription>
                Pipeline value by stage
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dealPipeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={dealPipeline}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  opacity={0.5}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <RechartsTooltip
                  content={<ChartTooltip valuePrefix="$" />}
                />
                <Bar
                  dataKey="value"
                  name="Value"
                  radius={[0, 6, 6, 0]}
                >
                  {dealPipeline.map((entry, index) => (
                    <Cell
                      key={`pipeline-${index}`}
                      fill={
                        entry.color ||
                        PIPELINE_COLORS[index % PIPELINE_COLORS.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={DollarSign}
              message="No deal pipeline data available"
            />
          )}
        </CardContent>
      </GlassCard>
    </motion.div>
  </div>

  {/* ── 6. Recent Content Table ── */}
  <motion.div variants={itemVariants}>
    <GlassCard>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Recent Content</CardTitle>
            <CardDescription>
              Latest content across platforms
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          {recentContent.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Type
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Platform
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Published
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-right">
                    Engagement
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentContent.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {item.title}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="capitalize">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {item.platform}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${contentStatusColor(item.status)}`}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {item.publishedAt
                        ? format(new Date(item.publishedAt), "MMM d")
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">
                          {item.engagement.toLocaleString()}
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={FileText}
              message="No content created yet. Start generating with AI!"
            />
          )}
        </div>
      </CardContent>
    </GlassCard>
  </motion.div>

  {/* ── 7 & 8. Recent Leads + Active Campaigns ── */}
  <div className="grid gap-6 lg:grid-cols-2">
    {/* Recent Leads List */}
    <motion.div variants={itemVariants}>
      <GlassCard>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Recent Leads</CardTitle>
              <CardDescription>Newest lead captures</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {recentLeads.length > 0 ? (
              recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {lead.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {lead.name}
                      </p>
                      <Badge
                        variant="outline"
                        className={`shrink-0 capitalize ${contentStatusColor(lead.status)}`}
                      >
                        {lead.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.email}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-lg font-bold ${leadScoreColor(lead.score)}`}
                    >
                      {lead.score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">score</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Users}
                message="No leads captured yet"
              />
            )}
          </div>
        </CardContent>
      </GlassCard>
    </motion.div>

    {/* Active Campaigns Cards */}
    <motion.div variants={itemVariants}>
      <GlassCard>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Active Campaigns</CardTitle>
              <CardDescription>
                Currently running campaigns
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {activeCampaigns.length > 0 ? (
              activeCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="rounded-lg border border-white/5 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {campaign.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {campaign.platform} &middot; Started{" "}
                        {format(new Date(campaign.startDate), "MMM d")}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 capitalize ${campaignStatusColor(campaign.status)}`}
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <Separator className="my-3 opacity-50" />
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {campaign.reach.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Reach
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {campaign.engagement.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Engagement
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {campaign.conversions.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Conversions
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Rocket}
                message="No active campaigns"
              />
            )}
          </div>
        </CardContent>
      </GlassCard>
    </motion.div>
  </div>

  {/* ── 9. AI Insights ── */}
  <motion.div variants={itemVariants}>
    <GlassCard>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">AI Insights</CardTitle>
            <CardDescription>
              Actionable intelligence from your AI agents
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto space-y-3">
          {aiInsights.length > 0 ? (
            aiInsights.map((insight) => (
              <div
                key={insight.id}
                className="flex items-start gap-3 rounded-lg border border-white/5 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  {insightIcon(insight.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <Badge
                      variant="outline"
                      className={`capitalize ${impactColor(insight.impact)}`}
                    >
                      {insight.impact} impact
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {insight.description}
                  </p>
                  {insight.action && (
                    <button className="mt-2 flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors">
                      <Lightbulb className="h-3.5 w-3.5" />
                      {insight.action}
                    </button>
                  )}
                </div>
                <p className="shrink-0 text-[10px] text-muted-foreground">
                  {format(new Date(insight.createdAt), "MMM d, h:mm a")}
                </p>
              </div>
            ))
          ) : (
            <EmptyState
              icon={Sparkles}
              message="AI insights will appear as your agents analyze data"
            />
          )}
        </div>
      </CardContent>
    </GlassCard>
  </motion.div>
</motion.div>
  );
}

// ─── Named + Default Exports ───────────────────────────────────────────────────

export function DashboardView() {
  return <DashboardViewInner />;
}

export default DashboardView;
