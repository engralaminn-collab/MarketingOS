"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Command, CornerDownLeft, ArrowUp, ArrowDown,
  LayoutDashboard, Users, Handshake, Megaphone, FileText, BarChart3,
  Settings, UserCog, Bot, Plug, Palette, Network, Search as SearchIcon,
  Link2, Plus, Download, Upload, Bell, Sparkles, Activity, Rss,
  Zap, BookOpen, Phone, GitBranch, GraduationCap, School, CalendarCheck,
  ClipboardList, Clock, DollarSign, Receipt, CreditCard, Briefcase, PlaneTakeoff,
} from "lucide-react";
import { useAppStore, type ViewId } from "@/stores/app-store";
import { useRouter } from "next/navigation";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  group: "Navigate" | "Actions" | "CRM" | "Create";
  action: () => void;
  keywords?: string;
}

interface CommandPaletteProps {
  onNavigate?: (view: ViewId) => void;
  onQuickAction?: (action: string) => void;
}

export function CommandPalette({ onNavigate, onQuickAction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { setActiveView } = useAppStore();

  // Opening/closing owns the query + selection reset. Doing it here, at the
  // user interaction, keeps the palette state in one place and removes the
  // need for an effect that writes state while rendering.
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // Typing restarts the selection at the top of the new result set.
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
  }, []);

  const go = useCallback(
    (view: ViewId) => {
      setActiveView(view);
      onNavigate?.(view);
      closePalette();
    },
    [setActiveView, onNavigate, closePalette],
  );

  const fireAction = useCallback(
    (action: string) => {
      onQuickAction?.(action);
      closePalette();
    },
    [onQuickAction, closePalette],
  );

  const items: CommandItem[] = useMemo(
    () => [
      // Navigate
      { id: "nav-dashboard", label: "CEO Dashboard", icon: LayoutDashboard, group: "Navigate", action: () => go("dashboard"), keywords: "home overview" },
      { id: "nav-crm", label: "CRM — Leads, Deals, Contacts, Tickets", icon: Users, group: "Navigate", action: () => go("crm"), keywords: "lead deal contact ticket sales pipeline" },
      { id: "nav-campaigns", label: "Campaigns", icon: Megaphone, group: "Navigate", action: () => go("campaigns") },
      { id: "nav-content", label: "Content", icon: FileText, group: "Navigate", action: () => go("content"), keywords: "blog post social media" },
      { id: "nav-marketing-studio", label: "Marketing Studio — kits, diagrams and CTA buttons", icon: Sparkles, group: "Navigate", action: () => go("marketing-studio"), keywords: "campaign kit button diagram workflow" },
      { id: "nav-seo", label: "SEO Engine", icon: SearchIcon, group: "Navigate", action: () => go("seo") },
      { id: "nav-market-intelligence", label: "Market Intelligence — competitor profiles and feed signals", icon: Activity, group: "Navigate", action: () => go("market-intelligence"), keywords: "competitor market research news radar signals" },
      { id: "nav-news-feeds", label: "News Feeds", icon: Rss, group: "Navigate", action: () => go("feeds"), keywords: "rss news headlines media monitoring" },
      { id: "nav-analytics", label: "Analytics", icon: BarChart3, group: "Navigate", action: () => go("analytics") },
      { id: "nav-team", label: "Team", icon: UserCog, group: "Navigate", action: () => go("team") },
      { id: "nav-settings", label: "Settings", icon: Settings, group: "Navigate", action: () => go("settings") },
      { id: "nav-integrations", label: "Integrations", icon: Plug, group: "Navigate", action: () => go("integrations") },
      { id: "nav-workforce", label: "AI Workforce", icon: Network, group: "Navigate", action: () => go("workforce") },
      { id: "nav-ai-agents", label: "AI Agents", icon: Bot, group: "Navigate", action: () => go("ai-agents") },
      { id: "nav-ai-command", label: "AI Command", icon: Bot, group: "Navigate", action: () => go("ai-command") },
      { id: "nav-free-ai-hub", label: "Free AI Agent Hub — 17 free LLM providers, tool loop, MCP & telemetry", icon: Zap, group: "Navigate", action: () => go("free-ai-hub"), keywords: "groq cerebras openrouter gemini ollama pollinations modeldeck radiant agent" },
      { id: "nav-knowledge-wiki", label: "Knowledge Wiki & RAG — [[WikiLinks]], episodic memory & context compressor", icon: BookOpen, group: "Navigate", action: () => go("knowledge-wiki"), keywords: "wiki rag memory embeddings bm25 llm_wiki hindsight" },
      { id: "nav-outreach-hub", label: "Omni-Channel Outreach — SMS, VoIP dialer, Inbox & Firecrawl scraper", icon: Phone, group: "Navigate", action: () => go("outreach-hub"), keywords: "sms httpsms twilio voip telnyx scraper firecrawl auto-reply" },
      { id: "nav-workflow-studio", label: "Workflow Studio — visual automation & n8n JSON export", icon: GitBranch, group: "Navigate", action: () => go("workflow-studio"), keywords: "n8n workflow automation trigger tooljet" },
      { id: "nav-ukvi-hub", label: "Study Abroad & UKVI Consultancy Hub — University matcher, CAS & IELTS", icon: GraduationCap, group: "Navigate", action: () => go("ukvi-hub"), keywords: "ukvi cas visa ielts university study abroad consultancy" },
      { id: "nav-media-studio", label: "Media Studio — images, video, VideoCaptioner subtitles & VoiceStudio", icon: Palette, group: "Navigate", action: () => go("media-studio"), keywords: "subtitles srt vtt whisperflux video audio" },
      { id: "nav-social", label: "Social Accounts", icon: Link2, group: "Navigate", action: () => go("social-accounts") },
      // Academic, UKVI, ERP, Finance & HRM views
      { id: "nav-students", label: "Students Directory", icon: GraduationCap, group: "Navigate", action: () => go("students"), keywords: "academic student enrollment" },
      { id: "nav-programs", label: "Programs & Courses", icon: BookOpen, group: "Navigate", action: () => go("programs"), keywords: "academic curriculum batch" },
      { id: "nav-departments", label: "Departments", icon: School, group: "Navigate", action: () => go("departments"), keywords: "academic faculty" },
      { id: "nav-attendance", label: "Attendance Tracking", icon: CalendarCheck, group: "Navigate", action: () => go("attendance"), keywords: "student class attendance" },
      { id: "nav-assignments", label: "Assignments & Submissions", icon: ClipboardList, group: "Navigate", action: () => go("assignments"), keywords: "homework coursework grading" },
      { id: "nav-exams", label: "Exams & Results", icon: FileText, group: "Navigate", action: () => go("exams"), keywords: "grades marks exam" },
      { id: "nav-schedule", label: "Class Schedule", icon: Clock, group: "Navigate", action: () => go("schedule"), keywords: "timetable calendar" },
      { id: "nav-partners", label: "University & Channel Partners", icon: Handshake, group: "Navigate", action: () => go("partners"), keywords: "agency commission university" },
      { id: "nav-finance", label: "Finance & General Ledger", icon: DollarSign, group: "Navigate", action: () => go("finance"), keywords: "accounting expenses slowbooks erp" },
      { id: "nav-fees", label: "Fee Management", icon: Receipt, group: "Navigate", action: () => go("fees"), keywords: "tuition invoice payment" },
      { id: "nav-salary", label: "Payroll & Salary", icon: CreditCard, group: "Navigate", action: () => go("salary"), keywords: "payroll payslip compensation" },
      { id: "nav-employees", label: "Employees Directory", icon: Users, group: "Navigate", action: () => go("employees"), keywords: "staff hr directory" },
      { id: "nav-hrm", label: "HR Management", icon: Briefcase, group: "Navigate", action: () => go("hrm"), keywords: "human resources designations" },
      { id: "nav-leave", label: "Leave Management", icon: PlaneTakeoff, group: "Navigate", action: () => go("leave"), keywords: "vacation pto sick leave" },
      // Quick actions
      { id: "action-new-lead", label: "Add new lead", icon: Plus, group: "Actions", action: () => fireAction("new-lead"), keywords: "create lead crm" },
      { id: "action-export-leads", label: "Export leads as CSV", icon: Download, group: "Actions", action: () => fireAction("export-leads"), keywords: "download csv backup" },
      { id: "action-import-leads", label: "Import leads from CSV", icon: Upload, group: "Actions", action: () => fireAction("import-leads"), keywords: "upload csv bulk" },
      { id: "action-notifications", label: "Open notifications", icon: Bell, group: "Actions", action: () => fireAction("notifications") },
    ],
    [go, fireAction],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.keywords || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  // Keep the highlighted row inside the current result set without an effect:
  // the clamp is derived during render, so a shrinking list can never leave a
  // stale out-of-range selection behind.
  const safeActiveIndex =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  // Scroll active item into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-cmd-idx="${safeActiveIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeActiveIndex, open]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      } else if (e.key === "Escape" && open) {
        closePalette();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, openPalette, closePalette]);

  // Focus input when opening
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(Math.min(safeActiveIndex + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(Math.max(safeActiveIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[safeActiveIndex]?.action();
    }
  };

  // Group filtered items
  const groups = useMemo(() => {
    const g: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!g[item.group]) g[item.group] = [];
      g[item.group].push(item);
    }
    return g;
  }, [filtered]);

  // Flatten for index tracking
  const flat = filtered;

  return (
    <>
      {/* Trigger button — render the keyboard shortcut hint */}
      <button
        onClick={openPalette}
        className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors text-xs text-muted-foreground"
        title="Open command palette (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Search or jump to…</span>
        <kbd className="ml-2 flex items-center gap-0.5 px-1 py-0.5 rounded border border-border/60 bg-background/80 text-[10px] font-mono">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 -sm flex items-start justify-center pt-[15vh] px-4"
            onClick={closePalette}
          >
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-xl bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or search…"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
                <kbd className="text-[10px] px-1 py-0.5 rounded border border-border/60 text-muted-foreground font-mono">ESC</kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
                {flat.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No results for &quot;{query}&quot;
                  </div>
                ) : (
                  Object.entries(groups).map(([groupName, groupItems]) => (
                    <div key={groupName} className="mb-2">
                      <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                        {groupName}
                      </p>
                      {groupItems.map((item) => {
                        const idx = flat.indexOf(item);
                        const isActive = idx === safeActiveIndex;
                        return (
                          <button
                            key={item.id}
                            data-cmd-idx={idx}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={item.action}
                            className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                              isActive ? "bg-primary/10 text-primary" : "hover:bg-accent/50"
                            }`}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.label}</p>
                              {item.hint && <p className="text-[10px] text-muted-foreground">{item.hint}</p>}
                            </div>
                            {isActive && (
                              <kbd className="text-[10px] px-1 py-0.5 rounded border border-border/60 text-muted-foreground font-mono flex items-center gap-0.5">
                                <CornerDownLeft className="h-2.5 w-2.5" />
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ArrowUp className="h-2.5 w-2.5" />
                    <ArrowDown className="h-2.5 w-2.5" />
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <CornerDownLeft className="h-2.5 w-2.5" />
                    Select
                  </span>
                </div>
                <span>{flat.length} commands</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
