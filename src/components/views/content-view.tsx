"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Plus,
  Search,
  Loader2,
  FileText,
  LayoutGrid,
  Calendar,
  CalendarDays,
  Sparkles,
  Heart,
  Share2,
  MessageCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  Filter,
  PenLine,
  Video,
  Mail,
  Smartphone,
  Globe,
  ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths, subMonths } from "date-fns";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  type: string;
  platform: string;
  status: string;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
  };
  aiGenerated: boolean;
  scheduledDate?: string;
  publishedDate?: string;
  createdAt: string;
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
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
        "border-white/10 bg-card/60 backdrop-blur-xl shadow-lg dark:border-white/5 " +
        className
      }
      {...props}
    >
      {children}
    </Card>
  );
}

const typeIcons: Record<string, React.ElementType> = {
  blog: PenLine,
  social_post: LayoutGrid,
  email: Mail,
  sms: Smartphone,
  landing_page: Globe,
  video_script: Video,
  ad_copy: FileText,
};

const typeColors: Record<string, string> = {
  blog: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
  social_post: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  email: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  sms: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  landing_page: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  video_script: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
  ad_copy: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const statusColors: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  scheduled: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  archived: "bg-zinc-400/15 text-zinc-500 dark:text-zinc-500 border-zinc-400/20",
};

const platformColors: Record<string, string> = {
  facebook: "bg-blue-600/15 text-blue-600 dark:text-blue-400",
  instagram: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  twitter: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  linkedin: "bg-blue-700/15 text-blue-700 dark:text-blue-500",
  tiktok: "bg-zinc-800/15 text-zinc-300 dark:text-zinc-200",
  youtube: "bg-red-500/15 text-red-600 dark:text-red-400",
  website: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  email: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
};

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[220px] rounded-xl bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

// ─── Create Content Dialog ────────────────────────────────────────────────────

function CreateContentDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "",
    type: "social_post",
    platform: "facebook",
    status: "draft",
    scheduledDate: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm({ title: "", type: "social_post", platform: "facebook", status: "draft", scheduledDate: "" });
      onOpenChange(false);
      toast.success("Content created successfully");
    } catch {
      toast.error("Failed to create content");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] border-white/10 bg-card/80 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Create Content
          </DialogTitle>
          <DialogDescription>
            Add a new piece of content to your marketing calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="content-title">Title *</Label>
            <Input
              id="content-title"
              placeholder="e.g. 5 Tips for Better Engagement"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Content Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog">Blog Post</SelectItem>
                  <SelectItem value="social_post">Social Post</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="landing_page">Landing Page</SelectItem>
                  <SelectItem value="video_script">Video Script</SelectItem>
                  <SelectItem value="ad_copy">Ad Copy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-date">Schedule Date</Label>
              <Input
                id="content-date"
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-700 hover:to-blue-700">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Content
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({ item, index }: { item: ContentItem; index: number }) {
  const TypeIcon = typeIcons[item.type] || FileText;
  const displayDate = item.publishedDate || item.scheduledDate;

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
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColors[item.type]?.split(" ")[0] || "bg-orange-500/15"}`}>
                <TypeIcon className="h-5 w-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base leading-tight">{item.title}</CardTitle>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <Badge variant="outline" className={typeColors[item.type] || ""}>
                    {item.type.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className={platformColors[item.platform] || ""}>
                    {item.platform}
                  </Badge>
                  <Badge variant="outline" className={statusColors[item.status] || ""}>
                    {item.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Engagement Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-rose-500" /> {formatNumber(item.engagement.likes)}
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5 text-blue-500" /> {formatNumber(item.engagement.shares)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> {formatNumber(item.engagement.comments)}
            </span>
          </div>
          {/* Date & AI Badge */}
          <div className="flex items-center justify-between">
            {displayDate ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {format(new Date(displayDate), "MMM d, yyyy")}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No date set</span>
            )}
            {item.aiGenerated && (
              <Badge variant="secondary" className="gap-1 bg-gradient-to-r from-orange-500/10 to-blue-500/10 border-orange-500/20">
                <Sparkles className="h-3 w-3 text-orange-500" /> AI Generated
              </Badge>
            )}
          </div>
        </CardContent>
      </GlassCard>
    </motion.div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarView({ items }: { items: ContentItem[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    // Pad start of month to align with weekday
    const startDay = getDay(start);
    const padStart = Array.from({ length: startDay }).map((_, i) => ({
      date: new Date(start.getTime() - (startDay - i) * 86400000),
      isCurrentMonth: false,
    }));
    const monthDays = allDays.map((d) => ({ date: d, isCurrentMonth: true }));
    return [...padStart, ...monthDays];
  }, [currentMonth]);

  const getItemsForDay = useCallback(
    (date: Date) =>
      items.filter((item) => {
        const d = item.scheduledDate || item.publishedDate;
        return d && isSameDay(new Date(d), date);
      }),
    [items]
  );

  return (
    <GlassCard>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {format(currentMonth, "MMMM yyyy")}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-px mb-1">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1.5 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-white/10">
          {days.map(({ date, isCurrentMonth }, idx) => {
            const dayItems = isCurrentMonth ? getItemsForDay(date) : [];
            const isToday = isSameDay(date, new Date());
            return (
              <div
                key={idx}
                className={`min-h-[72px] p-1 border-t border-white/5 ${
                  isCurrentMonth ? "bg-card/30" : "bg-muted/20 opacity-50"
                }`}
              >
                <span
                  className={`text-xs font-medium inline-flex h-6 w-6 items-center justify-center rounded-full ${
                    isToday
                      ? "bg-gradient-to-r from-orange-600 to-blue-600 text-white"
                      : "text-muted-foreground"
                  }`}
                >
                  {format(date, "d")}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayItems.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className={`truncate text-[10px] leading-tight px-1 py-0.5 rounded ${
                        typeColors[item.type]?.split(" ")[0] || "bg-orange-500/15"
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayItems.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </GlassCard>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

function ContentViewInner() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Every state update below happens after an `await`, so this can be called
  // straight from an effect without writing state synchronously during render.
  // Results from an aborted request (unmount) are dropped.
  const fetchContent = useCallback(async (signal?: AbortSignal) => {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("mos_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/content", { headers, signal });
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      const json = await res.json();
      if (signal?.aborted) return;
      const result = json?.data ?? json;
      const list = Array.isArray(result) ? result : result?.items ?? result?.content ?? [];
      setItems(list as ContentItem[]);
      setError(null);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      const message = err instanceof Error ? err.message : "Failed to load content";
      setError(message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  // Retry / refresh-after-mutation. Runs from event handlers, so showing the
  // skeleton immediately is safe here.
  const reloadContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await fetchContent();
  }, [fetchContent]);

  useEffect(() => {
    const controller = new AbortController();
    // Dispatched inside an async scope so the effect body itself performs no
    // state update; every setState in the loader runs after the response awaits.
    void (async () => {
      await fetchContent(controller.signal);
    })();
    return () => controller.abort();
  }, [fetchContent]);

  const handleCreate = async (formData: Record<string, string>) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("mos_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/content", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: formData.title,
        type: formData.type,
        platform: formData.platform,
        status: formData.status,
        scheduledDate: formData.scheduledDate || null,
        engagement: { likes: 0, shares: 0, comments: 0 },
        aiGenerated: false,
      }),
    });
    if (!res.ok) throw new Error("Create failed");
    await reloadContent();
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [items, searchQuery, typeFilter, statusFilter]);

  if (isLoading) return <ContentSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">Plan, schedule, and manage your content.</p>
        </div>
        <GlassCard>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={reloadContent}>
              <Zap className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </GlassCard>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">Plan, schedule, and manage your content.</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-orange-600 to-blue-600 hover:from-orange-700 hover:to-blue-700 shadow-lg shadow-orange-500/25"
        >
          <Plus className="mr-2 h-4 w-4" /> Create Content
        </Button>
      </div>

      {/* Filter Bar */}
      <GlassCard>
        <CardContent className="py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                className="pl-9 border-white/10 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] border-white/10 bg-background/50">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="social_post">Social Post</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="landing_page">Landing Page</SelectItem>
                <SelectItem value="video_script">Video Script</SelectItem>
                <SelectItem value="ad_copy">Ad Copy</SelectItem>
              </SelectContent>
            </Select>
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] border-white/10 bg-background/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            {/* View Toggle */}
            <div className="flex rounded-lg border border-white/10 bg-background/50 p-0.5">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4 mr-1" /> Grid
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode("calendar")}
              >
                <Calendar className="h-4 w-4 mr-1" /> Calendar
              </Button>
            </div>
          </div>
        </CardContent>
      </GlassCard>

      {/* Content Area */}
      {viewMode === "calendar" ? (
        <CalendarView items={filteredItems} />
      ) : filteredItems.length === 0 ? (
        <GlassCard>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-base font-medium">No content found</p>
            <p className="text-sm mt-1">
              {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters."
                : "Create your first content piece to get started."}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Content
            </Button>
          </CardContent>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, i) => (
              <ContentCard key={item.id} item={item} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateContentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />
    </motion.div>
  );
}

export function ContentView() {
  return <ContentViewInner />;
}
export default ContentView;
