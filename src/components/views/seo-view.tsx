"use client";

import { useState, useMemo } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Loader2,
  Search,
  TrendingUp,
  TrendingDown,
  Target,
  Globe,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Zap,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Play,
  Lightbulb,
  Star,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Brain,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SeoDailyTask {
  id: string;
  day: number;
  title: string;
  description: string | null;
  category: string;
  status: string;
  completedAt: string | null;
}

interface SeoChallenge {
  id: string;
  name: string;
  websiteUrl: string;
  targetKeywords: string | null;
  duration: number;
  status: string;
  currentDay: number;
  score: number;
  results: string | null;
  createdAt: string;
  dailyTasks: SeoDailyTask[];
}

interface SeoResponse {
  challenges: SeoChallenge[];
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  technical: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500", label: "Technical" },
  research: { color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500", label: "Research" },
  onpage: { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500", label: "On-Page" },
  content: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", label: "Content" },
  offpage: { color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500", label: "Off-Page" },
};

const DURATIONS = [
  { value: 30, label: "30 Days" },
  { value: 60, label: "60 Days" },
  { value: 90, label: "90 Days" },
  { value: 180, label: "180 Days" },
  { value: 365, label: "365 Days" },
];

const AI_RECOMMENDATIONS = [
  {
    title: "Optimize Core Web Vitals",
    description: "Improve LCP, FID, and CLS scores. Aim for LCP under 2.5s and CLS under 0.1 for better rankings.",
    priority: "high" as const,
    category: "technical",
  },
  {
    title: "Build Topic Clusters",
    description: "Create pillar content with interlinked cluster articles to establish topical authority in your niche.",
    priority: "high" as const,
    category: "content",
  },
  {
    title: "Earn Quality Backlinks",
    description: "Focus on earning backlinks from high-authority domains through guest posting, digital PR, and collaborations.",
    priority: "high" as const,
    category: "offpage",
  },
  {
    title: "Update Existing Content",
    description: "Refresh top-performing pages with new data, stats, and current information to maintain rankings.",
    priority: "medium" as const,
    category: "content",
  },
  {
    title: "Implement Schema Markup",
    description: "Add structured data (JSON-LD) for articles, FAQs, products, and local business to enhance SERP features.",
    priority: "medium" as const,
    category: "technical",
  },
  {
    title: "Optimize for Featured Snippets",
    description: "Structure content with clear headings, bullet points, and tables to target position-zero rankings.",
    priority: "medium" as const,
    category: "onpage",
  },
  {
    title: "Improve Internal Linking",
    description: "Create a strategic internal linking structure to distribute page authority and improve crawlability.",
    priority: "medium" as const,
    category: "onpage",
  },
  {
    title: "Mobile-First Optimization",
    description: "Ensure all pages pass mobile-friendliness tests. Check responsive design, tap targets, and mobile speed.",
    priority: "low" as const,
    category: "technical",
  },
];

// ─── Score Circle Component ────────────────────────────────────────────────────

function ScoreCircle({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/30"
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="text-lg font-bold"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
      </div>
    </div>
  );
}

// ─── Stat Card Component ───────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  trend,
  trendLabel,
}: {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}) {
  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-white/80 to-white/40 dark:from-white/5 dark:to-white/[0.02] -sm">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-xl font-bold">{value}</p>
          {trend && trendLabel && (
            <div
              className={`flex items-center gap-0.5 text-xs font-medium ${
                trend === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trend === "down"
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              }`}
            >
              {trend === "up" ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : trend === "down" ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : null}
              {trendLabel}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function SeoView() {
  const { data, isLoading, refetch } = useApiQuery<SeoResponse>("/api/seo");
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [taskPage, setTaskPage] = useState(0);

  // New challenge form
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formDuration, setFormDuration] = useState("90");

  // Task completion mutation
  const completeTaskMutation = useApiMutation<any>({
    method: "POST",
    path: "/api/seo",
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err),
  });

  // New challenge mutation
  const createChallengeMutation = useApiMutation<any>({
    method: "POST",
    path: "/api/seo",
    onSuccess: () => {
      toast.success("SEO Challenge created!");
      setShowNewChallenge(false);
      setFormName("");
      setFormUrl("");
      setFormKeywords("");
      setFormDuration("90");
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const challenges = data?.challenges || [];
  const activeChallenge = challenges.find(
    (c) => c.id === selectedChallenge && c.status === "active"
  );
  const activeChallenges = challenges.filter((c) => c.status === "active");

  // Parse results from JSON string
  const parseResults = (results: string | null) => {
    try {
      return results ? JSON.parse(results) : {};
    } catch {
      return {};
    }
  };

  const handleCreateChallenge = () => {
    if (!formUrl.trim()) {
      toast.error("Website URL is required");
      return;
    }
    createChallengeMutation.mutateAsync({
      name: formName.trim() || undefined,
      websiteUrl: formUrl.trim(),
      targetKeywords: formKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      duration: parseInt(formDuration),
    });
  };

  const handleSelectChallenge = (id: string) => {
    setSelectedChallenge(id === selectedChallenge ? null : id);
    setTaskPage(0);
  };

  const handleMarkComplete = (taskId: string) => {
    completeTaskMutation.mutate({ action: "completeTask", taskId });
  };

  // Paginate tasks for day grid
  const TASKS_PER_PAGE = 15;
  const paginatedTasks = activeChallenge
    ? activeChallenge.dailyTasks.slice(
        taskPage * TASKS_PER_PAGE,
        (taskPage + 1) * TASKS_PER_PAGE
      )
    : [];
  const totalTaskPages = activeChallenge
    ? Math.ceil(activeChallenge.dailyTasks.length / TASKS_PER_PAGE)
    : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            AI SEO Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered SEO challenges and daily optimization tasks
          </p>
        </div>
        <Button
          onClick={() => setShowNewChallenge(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          New Challenge
        </Button>
      </div>

      {/* Stats Overview */}
      {activeChallenges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
        >
          <StatCard
            label="Active Challenges"
            value={activeChallenges.length}
          />
          <StatCard
            label="Total Keywords"
            value={activeChallenges.reduce((acc, c) => {
              try {
                const kw = JSON.parse(c.targetKeywords || "[]");
                return acc + kw.length;
              } catch {
                return acc;
              }
            }, 0)}
          />
          <StatCard
            label="Tasks Completed"
            value={activeChallenges.reduce(
              (acc, c) =>
                acc + c.dailyTasks.filter((t) => t.status === "completed").length,
              0
            )}
          />
          <StatCard
            label="Avg. Score"
            value={
              activeChallenges.length
                ? Math.round(
                    activeChallenges.reduce((a, c) => a + c.score, 0) /
                      activeChallenges.length
                  )
                : 0
            }
            trend="up"
            trendLabel="+12%"
          />
          <StatCard
            label="Organic Traffic"
            value="2.4K"
            trend="up"
            trendLabel="+18%"
          />
          <StatCard
            label="Backlinks"
            value="156"
            trend="up"
            trendLabel="+8%"
          />
        </motion.div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="challenges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="challenges" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Challenges
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Daily Tasks
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            AI Tips
          </TabsTrigger>
        </TabsList>

        {/* ─── Challenges Tab ────────────────────────────────────────────────── */}
        <TabsContent value="challenges" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-md">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2 w-full" />
                    <div className="grid grid-cols-3 gap-3">
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-16 rounded-lg" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : challenges.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <Rocket className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold">No SEO Challenges Yet</h3>
                <p className="text-muted-foreground text-sm mt-1 max-w-md">
                  Start your first AI-powered SEO challenge to systematically
                  improve your search rankings.
                </p>
                <Button
                  onClick={() => setShowNewChallenge(true)}
                  variant="outline"
                  className="mt-4 gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
                >
                  <Play className="h-4 w-4" />
                  Start Your First Challenge
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {challenges.map((challenge, i) => {
                  const results = parseResults(challenge.results);
                  const completedTasks = challenge.dailyTasks.filter(
                    (t) => t.status === "completed"
                  ).length;
                  const totalTasks = challenge.dailyTasks.length;
                  const progressPct =
                    totalTasks > 0
                      ? Math.round((completedTasks / totalTasks) * 100)
                      : 0;

                  return (
                    <motion.div
                      key={challenge.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      layout
                    >
                      <Card
                        className={`border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group ${
                          selectedChallenge === challenge.id
                            ? "ring-2 ring-orange-500 shadow-orange-100 dark:shadow-orange-900/20"
                            : ""
                        }`}
                        onClick={() => handleSelectChallenge(challenge.id)}
                      >
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate">
                                  {challenge.name}
                                </h3>
                                <Badge
                                  variant="secondary"
                                  className={
                                    challenge.status === "active"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                  }
                                >
                                  {challenge.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Globe className="h-3 w-3" />
                                <span className="truncate">{challenge.websiteUrl}</span>
                              </div>
                            </div>
                            <ScoreCircle score={challenge.score} size={64} />
                          </div>

                          {/* Progress */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Day {challenge.currentDay} of {challenge.duration}
                              </span>
                              <span className="font-medium">
                                {completedTasks}/{totalTasks} tasks
                              </span>
                            </div>
                            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-500 to-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1 }}
                              />
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground">
                                Initial
                              </p>
                              <p className="text-sm font-bold">
                                #{results.initialRanking || "—"}
                              </p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground">
                                Current
                              </p>
                              <div className="flex items-center justify-center gap-1">
                                <p className="text-sm font-bold">
                                  #{results.currentRanking || "—"}
                                </p>
                                {results.initialRanking &&
                                  results.currentRanking &&
                                  results.currentRanking <
                                    results.initialRanking && (
                                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                  )}
                              </div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground">
                                Backlinks
                              </p>
                              <p className="text-sm font-bold">
                                {results.backlinks || 0}
                              </p>
                            </div>
                          </div>

                          {/* Keywords */}
                          {challenge.targetKeywords && (
                            <div className="flex flex-wrap gap-1">
                              {JSON.parse(challenge.targetKeywords)
                                .slice(0, 4)
                                .map((kw: string, ki: number) => (
                                  <Badge
                                    key={ki}
                                    variant="outline"
                                    className="text-[10px] px-2 py-0"
                                  >
                                    {kw}
                                  </Badge>
                                ))}
                              {JSON.parse(challenge.targetKeywords).length >
                                4 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-2 py-0"
                                >
                                  +
                                  {JSON.parse(challenge.targetKeywords).length -
                                    4}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* ─── Daily Tasks Tab ─────────────────────────────────────────────── */}
        <TabsContent value="tasks" className="space-y-4">
          {!activeChallenge ? (
            <Card className="border-dashed border-2 bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold">No Challenge Selected</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Select an active challenge to view and manage its daily tasks.
                </p>
                {challenges.length > 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      const firstActive = challenges.find(
                        (c) => c.status === "active"
                      );
                      if (firstActive) handleSelectChallenge(firstActive.id);
                    }}
                  >
                    Select Active Challenge
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Selected challenge header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-blue-500 flex items-center justify-center">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{activeChallenge.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {activeChallenge.websiteUrl} • {activeChallenge.duration} days •{" "}
                      {activeChallenge.dailyTasks.filter((t) => t.status === "completed").length}/
                      {activeChallenge.dailyTasks.length} completed
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChallenge(null)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  All Challenges
                </Button>
              </div>

              {/* Day Grid */}
              <Card className="border-0 shadow-md overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Daily Task Grid
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Click a pending task to mark it as complete
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    <AnimatePresence>
                      {paginatedTasks.map((task, i) => {
                        const catStyle =
                          CATEGORY_STYLES[task.category] ||
                          CATEGORY_STYLES.technical;
                        const isPending = task.status === "pending";
                        const isCompleted = task.status === "completed";
                        const isInProgress = task.status === "in_progress";

                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                            layout
                          >
                            <div
                              onClick={() =>
                                isPending &&
                                handleMarkComplete(task.id)
                              }
                              className={`
                                relative rounded-lg border p-3 transition-all text-left
                                ${
                                  isCompleted
                                    ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                                    : isInProgress
                                      ? "border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20"
                                      : "border-muted hover:border-orange-400 dark:hover:border-orange-600 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 cursor-pointer"
                                }
                              `}
                            >
                              {/* Category color bar */}
                              <div
                                className={`h-1 rounded-full mb-2 ${catStyle.bg}`}
                                style={{ width: "40%" }}
                              />

                              {/* Day badge */}
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  Day {task.day}
                                </span>
                                {isCompleted ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : isInProgress ? (
                                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </div>

                              {/* Title */}
                              <p
                                className={`text-xs font-medium leading-tight line-clamp-2 ${
                                  isCompleted ? "line-through text-muted-foreground" : ""
                                }`}
                              >
                                {task.title}
                              </p>

                              {/* Category badge */}
                              <Badge
                                variant="secondary"
                                className={`mt-2 text-[9px] px-1.5 py-0 ${catStyle.color}`}
                              >
                                {catStyle.label}
                              </Badge>

                              {/* Pending indicator */}
                              {isPending && (
                                <motion.div
                                  className="absolute inset-0 rounded-lg border-2 border-orange-400 dark:border-orange-500 opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
                                />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Pagination */}
                  {totalTaskPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {taskPage * TASKS_PER_PAGE + 1}–
                        {Math.min(
                          (taskPage + 1) * TASKS_PER_PAGE,
                          activeChallenge.dailyTasks.length
                        )}{" "}
                        of {activeChallenge.dailyTasks.length} tasks
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          disabled={taskPage === 0}
                          onClick={() => setTaskPage(taskPage - 1)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {taskPage + 1}/{totalTaskPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          disabled={taskPage >= totalTaskPages - 1}
                          onClick={() => setTaskPage(taskPage + 1)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ─── AI Recommendations Tab ────────────────────────────────────────── */}
        <TabsContent value="recommendations" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold">AI-Powered SEO Recommendations</h3>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Personalized tips based on current SEO best practices and your
            challenge progress.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {AI_RECOMMENDATIONS.map((rec, i) => {
                const catStyle =
                  CATEGORY_STYLES[rec.category] ||
                  CATEGORY_STYLES.technical;
                const priorityColors = {
                  high: {
                    bg: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                    border: "border-l-red-500",
                  },
                  medium: {
                    bg: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
                    border: "border-l-amber-500",
                  },
                  low: {
                    bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                    border: "border-l-blue-500",
                  },
                };
                const pColor = priorityColors[rec.priority];

                return (
                  <motion.div
                    key={rec.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <Card
                      className={`border-0 shadow-md border-l-4 ${pColor.border} hover:shadow-lg transition-shadow`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                            <h4 className="font-semibold text-sm">
                              {rec.title}
                            </h4>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 py-0 shrink-0 ${pColor.bg}`}
                          >
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {rec.description}
                        </p>
                        <div className="mt-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${catStyle.color}`}
                          >
                            {catStyle.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── New Challenge Dialog ───────────────────────────────────────────── */}
      <Dialog open={showNewChallenge} onOpenChange={setShowNewChallenge}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-orange-500" />
              Start New SEO Challenge
            </DialogTitle>
            <DialogDescription>
              Define your SEO challenge parameters and let AI generate a
              personalized daily action plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="challenge-name">Challenge Name</Label>
              <Input
                id="challenge-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Q1 Ranking Push"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-url">Website URL</Label>
              <Input
                id="website-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">
                Target Keywords{" "}
                <span className="text-muted-foreground">(comma-separated)</span>
              </Label>
              <Input
                id="keywords"
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                placeholder="seo tools, keyword research, rank tracker"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Challenge Duration</Label>
              <Select value={formDuration} onValueChange={setFormDuration}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewChallenge(false)}
              disabled={createChallengeMutation.isLoading}
            >
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
              onClick={handleCreateChallenge}
              disabled={
                createChallengeMutation.isLoading || !formUrl.trim()
              }
            >
              {createChallengeMutation.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Create Challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SeoView;
