"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
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
import { Button } from "@/components/ui/button";
import {
  Eye,
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion, type Variants } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "1y";

interface AnalyticsOverview {
  totalReach: number;
  totalEngagement: number;
  conversionRate: number;
  revenue: number;
  costPerLead: number;
  roi: number;
}

interface EngagementPoint {
  date: string;
  engagement: number;
  reach: number;
}

interface ContentTypePerformance {
  type: string;
  impressions: number;
  clicks: number;
  conversions: number;
  engagement: number;
}

interface PlatformComparison {
  platform: string;
  reach: number;
  engagement: number;
  conversions: number;
}

interface CampaignROI {
  name: string;
  spend: number;
  revenue: number;
  roi: number;
}

interface TopContent {
  id: string;
  title: string;
  type: string;
  platform: string;
  engagement: number;
  reach: number;
  conversions: number;
}

interface AnalyticsData {
  overview: AnalyticsOverview;
  engagementOverTime: EngagementPoint[];
  contentTypePerformance: ContentTypePerformance[];
  platformComparison: PlatformComparison[];
  campaignROI: CampaignROI[];
  topContent: TopContent[];
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
  visible: { opacity: 1, y: 0 },
};

// ─── Color Palettes ───────────────────────────────────────────────────────────

const ORANGE_BLUE = "#f97316";
const CHART_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b", "#ef4444"];
const RADAR_COLORS = ["#f97316", "#3b82f6"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof Card>) {
  return (
    <Card
      className={
        "border-white/10 bg-card/60 backdrop-blur-xl shadow-lg dark:border-white/5 " +
        className
      }
      {...props}
    >
      {children}
    </Card>
  );
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
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
    <div className="rounded-lg border border-white/10 bg-card/90 px-3 py-2 text-sm shadow-xl backdrop-blur-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-muted-foreground">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {valuePrefix}
          {typeof entry.value === "number"
            ? entry.value.toLocaleString()
            : entry.value}
          {valueSuffix}
        </p>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-16 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[120px] rounded-xl bg-muted/50" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </GlassCard>
        <GlassCard>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full rounded-lg" />
          </CardContent>
        </GlassCard>
      </div>
      <GlassCard>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </GlassCard>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
 change,
  gradient,
  shadowColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  change?: number;
  gradient: string;
  shadowColor: string;
}) {
  const isPositive = change !== undefined && change >= 0;
  return (
    <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} className="group">
      <div
        className={`relative overflow-hidden rounded-xl p-4 shadow-lg ${shadowColor} bg-gradient-to-br ${gradient}`}
      >
        <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-white/10 transition-transform group-hover:scale-125" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-white/80">{label}</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20">
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{value}</p>
          {change !== undefined && (
            <p className="mt-0.5 flex items-center gap-0.5 text-xs text-white/70">
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3 text-green-300" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-300" />
              )}
              <span className={isPositive ? "text-green-300" : "text-red-300"}>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="ml-0.5">vs prev</span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Period Button ────────────────────────────────────────────────────────────

function PeriodButton({
  period,
  active,
  onClick,
}: {
  period: Period;
  active: boolean;
  onClick: () => void;
}) {
  const labels: Record<Period, string> = {
    "7d": "7 Days",
    "30d": "30 Days",
    "90d": "90 Days",
    "1y": "1 Year",
  };
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={
        active
          ? "bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-700 hover:to-blue-700 border-0 text-white shadow-md"
          : "border-white/10 bg-background/50 hover:bg-accent/50"
      }
    >
      {labels[period]}
    </Button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function AnalyticsViewInner() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("30d");

  // Every state update below happens after an `await`, so this can be called
  // straight from an effect without writing state synchronously during render.
  // Results from an aborted request (period change or unmount) are dropped.
  const fetchAnalytics = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("mos_token") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/analytics?period=${period}`, { headers, signal });
        if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
        const json = await res.json();
        if (signal?.aborted) return;
        const result = json?.data ?? json;
        setData(result as AnalyticsData);
        setError(null);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load analytics";
        setError(message);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [period],
  );

  // Retry from an event handler — safe to show the skeleton immediately.
  const reloadAnalytics = useCallback(() => {
    setIsLoading(true);
    setError(null);
    void fetchAnalytics();
  }, [fetchAnalytics]);

  // Switching period re-runs the effect below; flipping the skeleton on here
  // preserves the previous loading behaviour without an in-effect setState.
  const handlePeriodChange = useCallback((next: Period) => {
    setIsLoading(true);
    setError(null);
    setPeriod(next);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Dispatched inside an async scope so the effect body itself performs no
    // state update; every setState in the loader runs after the response awaits.
    void (async () => {
      await fetchAnalytics(controller.signal);
    })();
    return () => controller.abort();
  }, [fetchAnalytics]);

  if (isLoading) return <AnalyticsSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Deep insights into your marketing performance.
          </p>
        </div>
        <GlassCard>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={reloadAnalytics}>
              <Zap className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </GlassCard>
      </div>
    );
  }

  const overview = data?.overview ?? {
    totalReach: 0,
    totalEngagement: 0,
    conversionRate: 0,
    revenue: 0,
    costPerLead: 0,
    roi: 0,
  };

  const engagementData = data?.engagementOverTime ?? [];
  const contentTypeData = data?.contentTypePerformance ?? [];
  const platformData = data?.platformComparison ?? [];
  const campaignRoiData = data?.campaignROI ?? [];
  const topContentList = data?.topContent ?? [];

  // Transform platform data for radar chart
  const radarData = platformData.map((p) => ({
    platform: p.platform,
    reach: p.reach,
    engagement: p.engagement,
    conversions: p.conversions,
  }));

  const statConfigs = [
    {
      icon: Eye,
      label: "Total Reach",
      value: formatNumber(overview.totalReach),
      gradient: "from-blue-600 to-cyan-500",
      shadowColor: "shadow-blue-600/25",
      change: 12.5,
    },
    {
      icon: TrendingUp,
      label: "Total Engagement",
      value: formatNumber(overview.totalEngagement),
      gradient: "from-orange-600 to-red-500",
      shadowColor: "shadow-orange-600/25",
      change: 8.3,
    },
    {
      icon: Target,
      label: "Conversion Rate",
      value: `${overview.conversionRate.toFixed(2)}%`,
      gradient: "from-emerald-500 to-teal-500",
      shadowColor: "shadow-emerald-500/25",
      change: 2.1,
    },
    {
      icon: DollarSign,
      label: "Revenue",
      value: formatCurrency(overview.revenue),
      gradient: "from-amber-500 to-orange-600",
      shadowColor: "shadow-amber-500/25",
      change: 15.7,
    },
    {
      icon: BarChart3,
      label: "Cost Per Lead",
      value: formatCurrency(overview.costPerLead),
      gradient: "from-violet-500 to-purple-500",
      shadowColor: "shadow-violet-500/25",
      change: -5.2,
    },
    {
      icon: Zap,
      label: "ROI",
      value: `${overview.roi.toFixed(0)}%`,
      gradient: "from-rose-500 to-pink-500",
      shadowColor: "shadow-rose-500/25",
      change: 9.8,
    },
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Deep insights into your marketing performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodButton period="7d" active={period === "7d"} onClick={() => handlePeriodChange("7d")} />
          <PeriodButton period="30d" active={period === "30d"} onClick={() => handlePeriodChange("30d")} />
          <PeriodButton period="90d" active={period === "90d"} onClick={() => handlePeriodChange("90d")} />
          <PeriodButton period="1y" active={period === "1y"} onClick={() => handlePeriodChange("1y")} />
        </div>
      </div>

      {/* Big Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statConfigs.map((cfg) => (
          <StatCard key={cfg.label} {...cfg} />
        ))}
      </div>

      {/* Charts Row 1: Engagement Line + Content Type Bar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement Over Time */}
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base">Engagement Over Time</CardTitle>
            <CardDescription>
              Track engagement and reach trends across your selected period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {engagementData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-muted-foreground">
                <p className="text-sm">No engagement data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="engagement"
                    name="Engagement"
                    stroke={ORANGE_BLUE}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reach"
                    name="Reach"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>

        {/* Content Performance by Type */}
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base">Content Performance by Type</CardTitle>
            <CardDescription>
              Compare impressions, clicks, and conversions across content types.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contentTypeData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-muted-foreground">
                <p className="text-sm">No content type data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={contentTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="impressions"
                    name="Impressions"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="clicks"
                    name="Clicks"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="conversions"
                    name="Conversions"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>
      </div>

      {/* Charts Row 2: Platform Comparison + Campaign ROI */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Comparison (Bar Chart) */}
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base">Platform Comparison</CardTitle>
            <CardDescription>
              Reach, engagement, and conversions by platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {platformData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-muted-foreground">
                <p className="text-sm">No platform data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={radarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="platform"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="reach"
                    name="Reach"
                    fill="#f97316"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="engagement"
                    name="Engagement"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="conversions"
                    name="Conversions"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>

        {/* Campaign ROI Comparison */}
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base">Campaign ROI Comparison</CardTitle>
            <CardDescription>
              Revenue vs. spend for each campaign with ROI percentage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaignRoiData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-muted-foreground">
                <p className="text-sm">No campaign ROI data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={campaignRoiData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    content={
                      <ChartTooltip
                        valuePrefix="$"
                      />
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="spend"
                    name="Spend"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>
      </div>

      {/* Top Performing Content Table */}
      <GlassCard>
        <CardHeader>
          <CardTitle className="text-base">Top Performing Content</CardTitle>
          <CardDescription>
            Your best-performing content ranked by engagement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topContentList.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <p className="text-sm">No top content data available</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Platform</TableHead>
                    <TableHead className="text-xs text-right">Reach</TableHead>
                    <TableHead className="text-xs text-right">Engagement</TableHead>
                    <TableHead className="text-xs text-right">Conversions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topContentList.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      className="border-white/5 transition-colors hover:bg-white/5"
                    >
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-orange-500/20 bg-orange-500/10 text-orange-500"
                        >
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {item.platform}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {formatNumber(item.reach)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {formatNumber(item.engagement)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {formatNumber(item.conversions)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </GlassCard>
    </motion.div>
  );
}

export function AnalyticsView() {
  return <AnalyticsViewInner />;
}
export default AnalyticsView;
