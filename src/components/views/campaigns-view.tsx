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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  DollarSign,
  Eye,
  Target,
  Plus,
  Loader2,
  BarChart3,
  Megaphone,
  Mail,
  Smartphone,
  FileText,
  Layers,
  CalendarDays,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { PublishingAndEmailSequencePanel } from "@/components/studio/publishing-email-panel";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CampaignMetric {
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  budget: number;
  startDate: string;
  endDate: string;
  description?: string;
  metrics: CampaignMetric;
  dailyMetrics?: Array<{ date: string; value: number }>;
}

interface CampaignsData {
  campaigns: Campaign[];
  summary: {
    activeCampaigns: number;
    totalBudget: number;
    totalReach: number;
    totalConversions: number;
  };
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatCurrency(value: number) {
  if (value == null || isNaN(value)) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatNumber(value: number) {
  if (value == null || isNaN(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

const typeIcons: Record<string, React.ElementType> = {
  social: Layers,
  email: Mail,
  sms: Smartphone,
  content: FileText,
  multi_channel: Megaphone,
};

const typeColors: Record<string, string> = {
  social: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  email: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  sms: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  content: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
  multi_channel: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  draft: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

function SparklineBar({ value, max }: { value: number; max: number }) {
  const height = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <motion.div
      className="w-2.5 rounded-full bg-gradient-to-t from-orange-500 to-blue-500"
      initial={{ height: 0 }}
      animate={{ height: `${height}%` }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ minHeight: 4 }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  gradient,
  shadowColor,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  gradient: string;
  shadowColor: string;
  index: number;
}) {
  return (
    <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} className="group">
      <div
        className={
          `relative overflow-hidden rounded-xl p-5 shadow-lg ${shadowColor} ` +
          `bg-gradient-to-br ${gradient}`
        }
      >
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 transition-transform group-hover:scale-125" />
        <div className="absolute -right-2 -bottom-6 h-20 w-20 rounded-full bg-white/5" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white/80">{label}</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <Icon className="h-4.5 w-4.5 text-white" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function CampaignsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[130px] rounded-xl bg-muted/50" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[280px] rounded-xl bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

// ─── New Campaign Dialog ─────────────────────────────────────────────────────

function NewCampaignDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "social",
    budget: "",
    startDate: "",
    endDate: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.budget || !form.startDate || !form.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm({ name: "", type: "social", budget: "", startDate: "", endDate: "", description: "" });
      onOpenChange(false);
      toast.success("Campaign created successfully");
    } catch {
      toast.error("Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] border-border bg-card/80 ">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-orange-500" />
            New Campaign
          </DialogTitle>
          <DialogDescription>
            Set up a new marketing campaign with your preferred channels and budget.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="camp-name">Campaign Name *</Label>
            <Input
              id="camp-name"
              placeholder="e.g. Summer Sale 2025"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campaign Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="content">Content</SelectItem>
                  <SelectItem value="multi_channel">Multi-Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="camp-budget">Budget ($) *</Label>
              <Input
                id="camp-budget"
                type="number"
                placeholder="5000"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="camp-start">Start Date *</Label>
              <Input
                id="camp-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camp-end">End Date *</Label>
              <Input
                id="camp-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="camp-desc">Description</Label>
            <Textarea
              id="camp-desc"
              placeholder="Describe the campaign goals and strategy..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-700 hover:to-blue-700">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign, index }: { campaign: Campaign; index: number }) {
  const TypeIcon = typeIcons[campaign.type] || Megaphone;

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -2 }}
      transition={{ delay: index * 0.03 }}
    >
      <GlassCard className="h-full transition-shadow hover:shadow-xl hover:shadow-orange-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColors[campaign.type]?.split(" ")[0] || "bg-orange-500/15"}`}
              >
                <TypeIcon className="h-5 w-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{campaign.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={typeColors[campaign.type] || ""}>
                    {campaign.type.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className={statusColors[campaign.status] || ""}>
                    {campaign.status}
                  </Badge>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Budget & Dates */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{formatCurrency(campaign.budget)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="text-xs">
                {format(new Date(campaign.startDate), "MMM d")} – {format(new Date(campaign.endDate), "MMM d")}
              </span>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Reach</p>
                <p className="text-sm font-semibold">{formatNumber(campaign.metrics.reach)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impressions</p>
                <p className="text-sm font-semibold">{formatNumber(campaign.metrics.impressions)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clicks</p>
                <p className="text-sm font-semibold">{formatNumber(campaign.metrics.clicks)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversions</p>
                <p className="text-sm font-semibold">{formatNumber(campaign.metrics.conversions)}</p>
              </div>
            </div>
            <div className="flex items-end justify-center gap-1.5 h-10">
              <SparklineBar value={campaign.metrics.reach} max={campaign.metrics.impressions || campaign.metrics.reach} />
              <SparklineBar value={campaign.metrics.impressions} max={campaign.metrics.impressions || 1} />
              <SparklineBar value={campaign.metrics.clicks} max={campaign.metrics.impressions || 1} />
              <SparklineBar value={campaign.metrics.conversions} max={campaign.metrics.impressions || 1} />
            </div>
          </div>
        </CardContent>
      </GlassCard>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function CampaignsViewInner() {
  const [data, setData] = useState<CampaignsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Every state update below happens after an `await`, so this can be called
  // straight from an effect without writing state synchronously during render.
  // Results from an aborted request (unmount) are dropped.
  const fetchCampaigns = useCallback(async (signal?: AbortSignal) => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("mos_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/campaigns", { headers, signal });
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      const json = await res.json();
      if (signal?.aborted) return;
      const result = json?.data ?? json;
      setData(result as CampaignsData);
      setError(null);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const message = err instanceof Error ? err.message : "Failed to load campaigns";
      setError(message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  // Retry / refresh-after-mutation. Runs from event handlers, so showing the
  // skeleton immediately is safe here.
  const reloadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    const controller = new AbortController();
    // Dispatched inside an async scope so the effect body itself performs no
    // state update; every setState in the loader runs after the response awaits.
    void (async () => {
      await fetchCampaigns(controller.signal);
    })();
    return () => controller.abort();
  }, [fetchCampaigns]);

  const handleCreate = async (formData: Record<string, string>) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("mos_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: formData.name,
        type: formData.type,
        budget: parseFloat(formData.budget),
        startDate: formData.startDate,
        endDate: formData.endDate,
        description: formData.description,
        status: "draft",
        metrics: { reach: 0, impressions: 0, clicks: 0, conversions: 0 },
      }),
    });
    if (!res.ok) throw new Error("Create failed");
    await reloadCampaigns();
  };

  if (isLoading) return <CampaignsSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Manage and track your marketing campaigns.</p>
        </div>
        <GlassCard>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={reloadCampaigns}>
              <Zap className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </GlassCard>
      </div>
    );
  }

  const summary = data?.summary ?? { activeCampaigns: 0, totalBudget: 0, totalReach: 0, totalConversions: 0 };
  const campaigns = data?.campaigns ?? [];

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
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Manage and track your marketing campaigns.</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-700 hover:to-blue-700 shadow-lg shadow-orange-500/25"
        >
          <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={Rocket}
          label="Active Campaigns"
          value={String(summary.activeCampaigns)}
          gradient="from-orange-600 to-red-500"
          shadowColor="shadow-orange-600/25"
          index={0}
        />
        <KPICard
          icon={DollarSign}
          label="Total Budget"
          value={formatCurrency(summary.totalBudget)}
          gradient="from-amber-500 to-orange-600"
          shadowColor="shadow-amber-500/25"
          index={1}
        />
        <KPICard
          icon={Eye}
          label="Total Reach"
          value={formatNumber(summary.totalReach)}
          gradient="from-blue-600 to-cyan-500"
          shadowColor="shadow-blue-600/25"
          index={2}
        />
        <KPICard
          icon={Target}
          label="Conversions"
          value={formatNumber(summary.totalConversions)}
          gradient="from-emerald-500 to-teal-500"
          shadowColor="shadow-emerald-500/25"
          index={3}
        />
      </div>

      {/* Campaigns Grid */}
      {campaigns.length === 0 ? (
        <GlassCard>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Megaphone className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-base font-medium">No campaigns yet</p>
            <p className="text-sm mt-1">Create your first campaign to get started.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Create Campaign
            </Button>
          </CardContent>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {campaigns.map((campaign, i) => (
              <CampaignCard key={campaign.id} campaign={campaign} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <NewCampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />

      <PublishingAndEmailSequencePanel />
    </motion.div>
  );
}

export function CampaignsView() {
  return <CampaignsViewInner />;
}
export default CampaignsView;
