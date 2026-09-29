"use client";

import React, { useState, useCallback } from "react";
import { motion, type Variants } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bot,
  Search,
  BarChart3,
  PenTool,
  Share2,
  UserPlus,
  LineChart,
  Mail,
  Video,
  Image,
  Lightbulb,
  Globe,
  Database,
  ShoppingBag,
  MessageSquare,
  Smartphone,
  Target,
  LayoutGrid,
  Loader2,
  Zap,
  Brain,
  Filter,
  Play,
  X,
  Send,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AIAgent {
  id: string;
  name: string;
  icon: string;
  type: string;
  category: string;
  description: string;
  enabled: boolean;
  lastActive?: string;
  tasksCompleted?: number;
}

interface AIAgentsData {
  agents: AIAgent[];
  stats: {
    totalAgents: number;
    activeAgents: number;
    categories: string[];
  };
}

// ─── Agent Definitions ─────────────────────────────────────────────────────────

const AGENT_DEFINITIONS: AIAgent[] = [
  {
    id: "seo-agent",
    name: "SEO Agent",
    icon: "🔍",
    type: "Analysis",
    category: "Optimization",
    description: "Automates keyword research, on-page SEO audits, and rank tracking across search engines.",
    enabled: true,
    lastActive: "2025-01-22T10:00:00Z",
    tasksCompleted: 147,
  },
  {
    id: "content-writer",
    name: "Content Writer",
    icon: "✍️",
    type: "Creation",
    category: "Content",
    description: "Generates blog posts, articles, and marketing copy with SEO optimization built-in.",
    enabled: true,
    lastActive: "2025-01-22T14:30:00Z",
    tasksCompleted: 234,
  },
  {
    id: "social-media-manager",
    name: "Social Media Manager",
    icon: "📱",
    type: "Management",
    category: "Social",
    description: "Schedules posts, analyzes engagement, and manages content across all social platforms.",
    enabled: true,
    lastActive: "2025-01-22T13:00:00Z",
    tasksCompleted: 189,
  },
  {
    id: "lead-generator",
    name: "Lead Generator",
    icon: "🎯",
    type: "Outreach",
    category: "Sales",
    description: "Identifies and qualifies potential leads through AI-driven prospecting and outreach.",
    enabled: false,
    lastActive: "2025-01-20T09:00:00Z",
    tasksCompleted: 56,
  },
  {
    id: "analytics-agent",
    name: "Analytics Agent",
    icon: "📊",
    type: "Analysis",
    category: "Analytics",
    description: "Provides real-time analytics, custom reports, and predictive insights for all channels.",
    enabled: true,
    lastActive: "2025-01-22T15:00:00Z",
    tasksCompleted: 312,
  },
  {
    id: "email-campaign-agent",
    name: "Email Campaign Agent",
    icon: "📧",
    type: "Campaign",
    category: "Email",
    description: "Designs, sends, and optimizes email campaigns with A/B testing and automation.",
    enabled: true,
    lastActive: "2025-01-22T12:00:00Z",
    tasksCompleted: 98,
  },
  {
    id: "video-creator",
    name: "Video Creator",
    icon: "🎬",
    type: "Creation",
    category: "Media",
    description: "Generates video scripts, creates short-form content, and auto-edits marketing videos.",
    enabled: false,
    lastActive: "2025-01-18T11:00:00Z",
    tasksCompleted: 23,
  },
  {
    id: "image-creator",
    name: "Image Creator",
    icon: "🎨",
    type: "Creation",
    category: "Media",
    description: "Produces AI-generated images, social graphics, and brand visuals with style control.",
    enabled: true,
    lastActive: "2025-01-22T11:30:00Z",
    tasksCompleted: 167,
  },
  {
    id: "brand-strategist",
    name: "Brand Strategist",
    icon: "💡",
    type: "Strategy",
    category: "Strategy",
    description: "Develops brand guidelines, positioning strategies, and competitive brand analysis.",
    enabled: false,
    lastActive: "2025-01-15T08:00:00Z",
    tasksCompleted: 12,
  },
  {
    id: "competitor-research-agent",
    name: "Competitor Research Agent",
    icon: "🌐",
    type: "Research",
    category: "Analytics",
    description: "Monitors competitors' strategies, pricing, content, and market positioning.",
    enabled: true,
    lastActive: "2025-01-22T09:00:00Z",
    tasksCompleted: 78,
  },
  {
    id: "crm-agent",
    name: "CRM Agent",
    icon: "🗃️",
    type: "Management",
    category: "Sales",
    description: "Manages customer relationships, tracks interactions, and automates follow-ups.",
    enabled: true,
    lastActive: "2025-01-22T14:00:00Z",
    tasksCompleted: 203,
  },
  {
    id: "sales-agent",
    name: "Sales Agent",
    icon: "💰",
    type: "Outreach",
    category: "Sales",
    description: "Automates sales processes, qualifying leads, drafting proposals, and closing deals.",
    enabled: false,
    lastActive: "2025-01-19T10:00:00Z",
    tasksCompleted: 34,
  },
  {
    id: "sms-agent",
    name: "SMS Agent",
    icon: "📲",
    type: "Communication",
    category: "Messaging",
    description: "Handles SMS marketing campaigns, OTP verification, and transactional messaging.",
    enabled: true,
    lastActive: "2025-01-22T15:30:00Z",
    tasksCompleted: 289,
  },
  {
    id: "strategy-planner",
    name: "Strategy Planner",
    icon: "🗓️",
    type: "Strategy",
    category: "Strategy",
    description: "Creates marketing plans, budget allocations, and quarterly strategy roadmaps.",
    enabled: false,
    lastActive: "2025-01-12T14:00:00Z",
    tasksCompleted: 8,
  },
];

// ─── Animation Variants ────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Optimization: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  Content: { bg: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/30" },
  Social: { bg: "bg-pink-500/15", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30" },
  Sales: { bg: "bg-orange-500/15", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  Analytics: { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  Email: { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  Media: { bg: "bg-rose-500/15", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
  Strategy: { bg: "bg-cyan-500/15", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30" },
  Messaging: { bg: "bg-teal-500/15", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30" },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Optimization: Target,
  Content: PenTool,
  Social: Share2,
  Sales: ShoppingBag,
  Analytics: LineChart,
  Email: Mail,
  Media: Image,
  Strategy: Lightbulb,
  Messaging: MessageSquare,
};

// ─── Glass Card Wrapper ────────────────────────────────────────────────────────

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

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function AgentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Agent Card ──────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onToggle,
  isToggling,
  onRun,
  isRunning,
}: {
  agent: AIAgent;
  onToggle: (id: string, enabled: boolean) => void;
  isToggling: boolean;
  onRun?: (agent: AIAgent) => void;
  isRunning?: boolean;
}) {
  const catColors = CATEGORY_COLORS[agent.category] || CATEGORY_COLORS.Optimization;
  const CatIcon = CATEGORY_ICONS[agent.category] || Bot;

  return (
    <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <GlassCard
        className={`group h-full transition-all duration-300 ${
          agent.enabled
            ? "ring-1 ring-white/10 hover:ring-orange-500/30"
            : "opacity-70 hover:opacity-90"
        }`}
      >
        <CardContent className="p-4">
          {/* Top Row: Icon + Name + Toggle */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-blue-500/20 text-2xl shadow-md">
                  {agent.icon}
                </div>
                {/* Status Dot */}
                <div
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                    agent.enabled
                      ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                      : "bg-gray-400"
                  }`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{agent.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 border ${catColors.bg} ${catColors.text} ${catColors.border}`}
                  >
                    <CatIcon className="h-2.5 w-2.5 mr-0.5" />
                    {agent.category}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{agent.type}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onRun && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px] bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400"
                        disabled={!agent.enabled || isRunning}
                        onClick={() => onRun(agent)}
                      >
                        {isRunning ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 mr-1" />
                        )}
                        Run
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {agent.enabled ? "Run this agent on a task" : "Enable the agent first"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Label htmlFor={`toggle-${agent.id}`} className="sr-only">
                        Toggle {agent.name}
                      </Label>
                      <Switch
                        id={`toggle-${agent.id}`}
                        checked={agent.enabled}
                        disabled={isToggling}
                        onCheckedChange={(checked) => onToggle(agent.id, checked)}
                        className="data-[state=checked]:bg-orange-500"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {agent.enabled ? "Disable agent" : "Enable agent"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Description */}
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {agent.description}
          </p>

          {/* Bottom Stats */}
          <Separator className="my-3 bg-white/5" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              <span>{agent.tasksCompleted ?? 0} tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${agent.enabled ? "bg-emerald-500" : "bg-gray-400"}`} />
              <span>{agent.enabled ? "Active" : "Inactive"}</span>
            </div>
          </div>
        </CardContent>
      </GlassCard>
    </motion.div>
  );
}

// ─── Stats Card ──────────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: { totalAgents: number; activeAgents: number; categories: string[] } }) {
  const inactiveCount = stats.totalAgents - stats.activeAgents;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        {
          label: "Total Agents",
          value: stats.totalAgents,
          icon: LayoutGrid,
          gradient: "from-orange-500 to-amber-500",
          shadow: "shadow-orange-500/25",
        },
        {
          label: "Active Agents",
          value: stats.activeAgents,
          icon: Zap,
          gradient: "from-emerald-500 to-teal-500",
          shadow: "shadow-emerald-500/25",
        },
        {
          label: "Inactive Agents",
          value: inactiveCount,
          icon: Bot,
          gradient: "from-slate-400 to-slate-500",
          shadow: "shadow-slate-400/25",
        },
        {
          label: "Categories",
          value: stats.categories.length,
          icon: Brain,
          gradient: "from-blue-500 to-cyan-500",
          shadow: "shadow-blue-500/25",
        },
      ].map((stat) => (
        <GlassCard key={stat.label} className="p-3">
          <CardContent className="p-0">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} text-white shadow-md ${stat.shadow}`}
              >
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </GlassCard>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AiAgentsView() {
  const { user } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [runDialogAgent, setRunDialogAgent] = useState<AIAgent | null>(null);
  const [runTask, setRunTask] = useState("");
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Fetch real AI agents from /api/ai-agents
  const { data: apiData, isLoading, refetch } = useApiQuery<{ agents: any[] }>("/api/ai-agents", { enabled: true });

  // Map DB agents to the view's expected shape.
  // If the DB has no agents yet, fall back to AGENT_DEFINITIONS seeded into the DB on first run.
  const agents: AIAgent[] = (apiData?.agents ?? []).map((a: any) => {
    const config = (() => { try { return JSON.parse(a.config || '{}'); } catch { return {}; } })();
    return {
      id: a.id,
      name: a.name,
      icon: config.icon || a.icon || 'Bot',
      description: a.description || '',
      category: config.category || 'Strategy',
      type: a.type,
      enabled: a.isEnabled,
      lastActive: a.updatedAt || a.createdAt,
      tasksCompleted: config.tasksCompleted || 0,
    };
  });

  // Mutation for toggling agents — calls /api/ai-agents PATCH with { id, isEnabled }
  const toggleMutation = useApiMutation({
    method: "PATCH",
    path: "/api/ai-agents",
    onSuccess: () => { refetch(); },
    onError: () => { toast.error("Failed to update agent status"); refetch(); },
  });

  const handleToggle = useCallback(
    async (agentId: string, enabled: boolean) => {
      setTogglingId(agentId);
      try {
        toggleMutation.mutate({ id: agentId, isEnabled: enabled });
        toast.success(`${agents.find((a) => a.id === agentId)?.name || 'Agent'} ${enabled ? "enabled" : "disabled"}`);
      } catch {
        toast.error("Failed to update agent status");
      } finally {
        setTogglingId(null);
      }
    },
    [toggleMutation, agents]
  );

  const handleRunAgent = useCallback(
    async (agent: AIAgent) => {
      setRunDialogAgent(agent);
      setRunTask("");
      setRunOutput(null);
      setRunError(null);
    },
    [],
  );

  const handleExecuteAgent = useCallback(async () => {
    if (!runDialogAgent || !runTask.trim()) return;
    setRunningAgentId(runDialogAgent.id);
    setRunOutput(null);
    setRunError(null);
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch(`/api/ai/agents/${runDialogAgent.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ task: runTask }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const result = json.data || json;
      if (result.success === false) {
        setRunError(result.error || "Agent failed to produce output");
        toast.error(`Agent failed: ${result.error || "unknown error"}`);
      } else {
        setRunOutput(result.output);
        toast.success(`${runDialogAgent.name} completed in ${result.durationMs}ms`);
        refetch(); // refresh task counts
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to run agent";
      setRunError(msg);
      toast.error(msg);
    } finally {
      setRunningAgentId(null);
    }
  }, [runDialogAgent, runTask, refetch]);

  // Calculate stats from real agent list
  const stats = {
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.enabled).length,
    categories: [...new Set(agents.map((a) => a.category))],
  };

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.description.toLowerCase().includes(search.toLowerCase()) ||
      agent.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === "all" || agent.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) return <AgentsSkeleton />;

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-blue-500 text-white shadow-lg shadow-orange-500/25">
              <Bot className="h-5 w-5" />
            </div>
            AI Agent Control Panel
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and control your AI-powered marketing agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
            {stats.activeAgents} Active
          </Badge>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants}>
        <StatsRow stats={stats} />
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 flex-wrap">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              filterCategory === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {stats.categories.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat] || Bot;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                  filterCategory === cat
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CatIcon className="h-3 w-3" />
                {cat}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Agent Grid */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {filteredAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onToggle={handleToggle}
            isToggling={togglingId === agent.id}
            onRun={handleRunAgent}
            isRunning={runningAgentId === agent.id}
          />
        ))}
      </motion.div>

      {filteredAgents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bot className="h-10 w-10 opacity-30 mb-2" />
          <p className="text-sm">No agents found matching your filters</p>
        </div>
      )}

      {/* Run Agent Dialog */}
      <Dialog open={!!runDialogAgent} onOpenChange={(v) => !v && setRunDialogAgent(null)}>
        <DialogContent className="sm:max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-white/20 dark:border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">{runDialogAgent?.icon}</span>
              Run Agent: {runDialogAgent?.name}
            </DialogTitle>
            <DialogDescription>
              Type a task for the {runDialogAgent?.name} agent to execute via the LLM. The agent will save its output to the activity feed + audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Task description</label>
              <textarea
                value={runTask}
                onChange={(e) => setRunTask(e.target.value)}
                placeholder="e.g. Score this lead: Sarah Chen from TechVault Inc, source LinkedIn, currently 65"
                disabled={runningAgentId === runDialogAgent?.id}
                className="w-full min-h-[80px] rounded-md border border-border/50 bg-white/80 dark:bg-slate-800/80 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                rows={3}
              />
            </div>

            {runningAgentId === runDialogAgent?.id && (
              <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Calling LLM... (this may take 5-15 seconds)
              </div>
            )}

            {runError && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
                <strong>Error:</strong> {runError}
              </div>
            )}

            {runOutput && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Agent output</label>
                <pre className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                  {runOutput}
                </pre>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRunDialogAgent(null)} disabled={!!runningAgentId}>
              Close
            </Button>
            <Button
              onClick={handleExecuteAgent}
              disabled={!runTask.trim() || runningAgentId === runDialogAgent?.id}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              {runningAgentId === runDialogAgent?.id ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Running...</>
              ) : (
                <><Send className="h-4 w-4 mr-1.5" /> Run Agent</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default AiAgentsView;
