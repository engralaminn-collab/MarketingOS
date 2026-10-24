"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Users, Handshake, Contact as ContactIcon, Ticket as TicketIcon,
  Loader2, ChevronRight, DollarSign, Building2, Mail, Briefcase, X, AlertCircle,
  TrendingUp, Filter, Trash2, Pencil, Phone, MessageSquare, Upload, Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { LeadEnrichmentPanel } from "@/components/studio/lead-enrichment-panel";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragEndEvent, useDraggable, useDroppable,
} from "@dnd-kit/core";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: string | null;
  status: string;
  score: number;
  notes: string | null;
  createdAt: string;
  activities?: { id: string; type: string; content: string | null; createdAt: string }[];
  tags?: { id: string; name: string }[];
}

interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  closeDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  position: string | null;
  source: string | null;
  notes: string | null;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: { id: string; content: string; createdAt: string }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "prospect", label: "Prospect", color: "#64748b" },
  { key: "qualified", label: "Qualified", color: "#3b82f6" },
  { key: "proposal", label: "Proposal", color: "#f59e0b" },
  { key: "negotiation", label: "Negotiation", color: "#f97316" },
  { key: "won", label: "Won", color: "#10b981" },
  { key: "lost", label: "Lost", color: "#ef4444" },
] as const;

const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "lost"] as const;
const LEAD_SOURCES = ["Website", "Referral", "LinkedIn", "Conference", "Cold Email", "Webinar", "Partner"] as const;
const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

const STATUS_STYLES: Record<string, string> = {
  new: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  qualified: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  unqualified: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
};

const TICKET_STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-800",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mos_token");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return "bg-emerald-500";
    if (s >= 60) return "bg-amber-500";
    if (s >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getColor(score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums w-6 text-right">{score}</span>
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={`border-border bg-white shadow-lg ${className}`}>
      {children}
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="rounded-2xl bg-muted/50 p-4 mb-4">
        <Icon className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">{description}</p>
    </motion.div>
  );
}

// ─── Leads Tab ────────────────────────────────────────────────────────────────

function LeadsTab({ leads, isLoading, reload }: { leads: Lead[]; isLoading: boolean; reload: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "", email: "", company: "", source: "Website", phone: "", status: "new", notes: "",
  });

  const handleExportCsv = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/export", { headers: authHeaders() });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Leads exported as CSV");
    } catch {
      toast.error("Failed to export leads");
    }
  }, []);

  const handleImportCsv = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append("file", file);
      const token = getToken();
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formDataObj,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const result = json.data || json;
      toast.success(`Imported ${result.created} leads (${result.skipped} skipped)`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import leads");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // reset for re-import
    }
  }, [reload]);

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.companyName || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [leads, statusFilter, search]);

  const openCreate = () => {
    setEditLead(null);
    setFormData({ name: "", email: "", company: "", source: "Website", phone: "", status: "new", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email || "",
      company: lead.companyName || "",
      source: lead.source || "Website",
      phone: lead.phone || "",
      status: lead.status,
      notes: lead.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: formData.name,
        email: formData.email || null,
        companyName: formData.company || null,
        source: formData.source,
        phone: formData.phone || null,
        status: formData.status,
        notes: formData.notes || null,
      };
      const res = await fetch(
        editLead ? `/api/crm/leads/${editLead.id}` : "/api/crm/leads",
        { method: editLead ? "PATCH" : "POST", headers: authHeaders(), body: JSON.stringify(body) },
      );
      if (!res.ok) throw new Error("Save failed");
      toast.success(editLead ? "Lead updated" : "Lead created");
      setDialogOpen(false);
      reload();
    } catch {
      toast.error("Failed to save lead");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/crm/leads/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Lead deleted");
      reload();
    } catch {
      toast.error("Failed to delete lead");
    }
  };

  const handleStatusChange = async (lead: Lead, newStatus: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Status → ${titleCase(newStatus)}`);
      reload();
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-2 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white  border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 bg-white  border-border">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImportCsv}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Import leads from CSV"
          >
            {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
            Import
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            title="Export all leads as CSV"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/25"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Lead
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No leads found" description={search || statusFilter !== "all" ? "Try adjusting your filters" : "Add your first lead to get started"} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-border bg-white overflow-hidden shadow-lg"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-white">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider hidden md:table-cell">Company</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Source</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Score</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filtered.map((lead, idx) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.2 }}
                      className="border-b border-border last:border-0 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <TableCell className="font-medium text-sm">{lead.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.email || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                          {lead.companyName || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">{lead.source || "—"}</TableCell>
                      <TableCell>
                        <Select value={lead.status} onValueChange={(v) => handleStatusChange(lead, v)}>
                          <SelectTrigger className="h-7 w-[130px] text-[11px] border-0 px-2 py-0 bg-transparent hover:bg-white/60 dark:hover:bg-slate-700/60">
                            <Badge variant="outline" className={`text-[11px] ${STATUS_STYLES[lead.status] || ""}`}>
                              {titleCase(lead.status)}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><ScoreBar score={lead.score} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(lead)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(lead.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-white flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Showing {filtered.length} of {leads.length} leads</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {leads.length > 0 ? Math.round((leads.filter((l) => l.score >= 60).length / leads.length) * 100) : 0}%
              </span>
              high-score
            </div>
          </div>
        </motion.div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-border">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
              {editLead ? "Edit Lead" : "Create New Lead"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Full Name *</Label>
              <Input id="lead-name" placeholder="John Smith" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={submitting} className="bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lead-email">Email</Label>
                <Input id="lead-email" type="email" placeholder="john@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input id="lead-phone" placeholder="+1-555-0000" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lead-company">Company</Label>
                <Input id="lead-company" placeholder="Acme Inc" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-source">Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })} disabled={submitting}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })} disabled={submitting}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea id="lead-notes" placeholder="Initial context, requirements, etc." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} disabled={submitting} className="bg-white min-h-[60px]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {editLead ? "Save Changes" : "Create Lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Deal Card (draggable) ───────────────────────────────────────────────────

function KanbanDealCard({ deal, onClick }: { deal: Deal; onClick?: () => void }) {
  const stageInfo = PIPELINE_STAGES.find((s) => s.key === deal.stage) ?? PIPELINE_STAGES[0];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className="rounded-lg border border-border bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md "
      style={{ borderLeft: `3px solid ${stageInfo.color}` }}
    >
      <h4 className="text-sm font-semibold leading-tight mb-2">{deal.name}</h4>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-bold">{formatCurrency(deal.value)}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{deal.probability}%</span>
        </div>
        <Progress value={deal.probability} className="h-1.5" />
        {deal.closeDate && (
          <p className="text-[10px] text-muted-foreground">Close: {formatDate(deal.closeDate)}</p>
        )}
      </div>
    </motion.div>
  );
}

function KanbanColumn({ stage, deals, onAddDeal }: {
  stage: typeof PIPELINE_STAGES[number];
  deals: Deal[];
  onAddDeal: (stage: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.key}` });
  const total = deals.reduce((s, d) => s + d.value, 0);
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border bg-white transition-colors ${isOver ? "border-orange-500/60 bg-orange-500/5" : "border-border"}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="text-xs font-semibold uppercase tracking-wider">{stage.label}</h3>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{deals.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddDeal(stage.key)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[60vh] overflow-y-auto">
        <AnimatePresence>
          {deals.map((d) => (
            <KanbanDealCard key={d.id} deal={d} />
          ))}
        </AnimatePresence>
        {deals.length === 0 && (
          <p className="text-[10px] text-muted-foreground/50 text-center py-4">Drop deals here</p>
        )}
      </div>
      {total > 0 && (
        <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
          <span>Total</span>
          <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}

function DealsTab({ deals, isLoading, reload }: { deals: Deal[]; isLoading: boolean; reload: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "", value: "0", stage: "prospect", probability: "10", closeDate: "", notes: "",
  });
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of PIPELINE_STAGES) {
      map[stage.key] = deals.filter((d) => d.stage === stage.key);
    }
    return map;
  }, [deals]);

  const totalPipeline = useMemo(
    () => deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0),
    [deals],
  );

  const handleDragStart = (e: DragStartEvent) => setActiveDealId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    const dealId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveDealId(null);
    if (!overId) return;
    const newStage = overId.replace("stage-", "");
    if (!PIPELINE_STAGES.find((s) => s.key === newStage)) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;
    try {
      const res = await fetch(`/api/crm/deals/${dealId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Move failed");
      toast.success(`Moved to ${titleCase(newStage)}`);
      reload();
    } catch {
      toast.error("Failed to move deal");
    }
  };

  const openCreate = (stage: string = "prospect") => {
    setFormData({ name: "", value: "0", stage, probability: "10", closeDate: "", notes: "" });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: formData.name,
          value: Number(formData.value) || 0,
          stage: formData.stage,
          probability: Number(formData.probability) || 0,
          closeDate: formData.closeDate || null,
          notes: formData.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      toast.success("Deal created");
      setDialogOpen(false);
      reload();
    } catch {
      toast.error("Failed to create deal");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDeal = async (id: string) => {
    if (!confirm("Delete this deal?")) return;
    try {
      const res = await fetch(`/api/crm/deals/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Deal deleted");
      reload();
    } catch {
      toast.error("Failed to delete deal");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Deal Pipeline — Drag &amp; Drop</h3>
          <p className="text-xs text-muted-foreground">
            Total active pipeline: <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalPipeline)}</span>
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => openCreate()}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Deal
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              deals={grouped[stage.key] || []}
              onAddDeal={openCreate}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDealId ? (
            <KanbanDealCard deal={deals.find((d) => d.id === activeDealId)!} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Deals table with delete buttons (so users can also see them as a list) */}
      <details className="rounded-xl border border-border bg-white p-4">
        <summary className="text-sm font-semibold cursor-pointer">All deals ({deals.length}) — list view</summary>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase">Name</TableHead>
                <TableHead className="text-xs uppercase">Stage</TableHead>
                <TableHead className="text-xs uppercase">Value</TableHead>
                <TableHead className="text-xs uppercase">Probability</TableHead>
                <TableHead className="text-xs uppercase">Close Date</TableHead>
                <TableHead className="text-xs uppercase w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => {
                const stage = PIPELINE_STAGES.find((s) => s.key === d.stage);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm font-medium">{d.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]" style={{ borderColor: stage?.color, color: stage?.color }}>
                        {stage?.label || d.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-bold">{formatCurrency(d.value)}</TableCell>
                    <TableCell className="text-sm">{d.probability}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.closeDate ? formatDate(d.closeDate) : "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteDeal(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </details>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-border">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">Create New Deal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deal-name">Deal Title *</Label>
              <Input id="deal-name" placeholder="Enterprise SaaS License — Acme" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={submitting} className="bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="deal-value">Value (USD)</Label>
                <Input id="deal-value" type="number" min="0" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-probability">Probability (%)</Label>
                <Input id="deal-probability" type="number" min="0" max="100" value={formData.probability} onChange={(e) => setFormData({ ...formData, probability: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="deal-stage">Stage</Label>
                <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v })} disabled={submitting}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-close">Close Date</Label>
                <Input id="deal-close" type="date" value={formData.closeDate} onChange={(e) => setFormData({ ...formData, closeDate: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-notes">Notes</Label>
              <Textarea id="deal-notes" placeholder="Champion, next step, blockers..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} disabled={submitting} className="bg-white min-h-[60px]" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white">
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Create Deal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab({ contacts, isLoading, reload }: { contacts: Contact[]; isLoading: boolean; reload: () => void }) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", company: "", position: "", source: "Website", notes: "",
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.companyName || "").toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const openCreate = () => {
    setEditContact(null);
    setFormData({ name: "", email: "", phone: "", company: "", position: "", source: "Website", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditContact(c);
    setFormData({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      company: c.companyName || "",
      position: c.position || "",
      source: c.source || "Website",
      notes: c.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        companyName: formData.company || null,
        position: formData.position || null,
        source: formData.source,
        notes: formData.notes || null,
      };
      const res = await fetch(
        editContact ? `/api/crm/contacts/${editContact.id}` : "/api/crm/contacts",
        { method: editContact ? "PATCH" : "POST", headers: authHeaders(), body: JSON.stringify(body) },
      );
      if (!res.ok) throw new Error("Save failed");
      toast.success(editContact ? "Contact updated" : "Contact created");
      setDialogOpen(false);
      reload();
    } catch {
      toast.error("Failed to save contact");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Contact deleted");
      reload();
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-white  border-border" />
        </div>
        <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Add Contact
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ContactIcon} title="No contacts found" description="Add your first contact to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map((c, idx) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: idx * 0.02 }}
              >
                <GlassCard className="p-4 group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                        {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold">{c.name}</h4>
                        <p className="text-xs text-muted-foreground">{c.position || "—"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {c.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" /> {c.email}
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </div>
                    )}
                    {c.companyName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-3 w-3" /> {c.companyName}
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-border">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
              {editContact ? "Edit Contact" : "Create New Contact"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name *</Label>
              <Input id="contact-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={submitting} className="bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input id="contact-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input id="contact-phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contact-company">Company</Label>
                <Input id="contact-company" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-position">Position</Label>
                <Input id="contact-position" placeholder="CTO, VP Sales..." value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} disabled={submitting} className="bg-white" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white">
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {editContact ? "Save Changes" : "Create Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────

function TicketsTab({ tickets, isLoading, reload }: { tickets: Ticket[]; isLoading: boolean; reload: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subject: "", description: "", status: "open", priority: "medium",
  });

  const filtered = useMemo(() => {
    let result = tickets;
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.subject.toLowerCase().includes(q));
    }
    return result;
  }, [tickets, statusFilter, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/tickets", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Create failed");
      toast.success("Ticket created");
      setDialogOpen(false);
      setFormData({ subject: "", description: "", status: "open", priority: "medium" });
      reload();
    } catch {
      toast.error("Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (ticket: Ticket, newStatus: string) => {
    try {
      const res = await fetch(`/api/crm/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Status → ${titleCase(newStatus)}`);
      reload();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ticket?")) return;
    try {
      const res = await fetch(`/api/crm/tickets/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Ticket deleted");
      reload();
    } catch {
      toast.error("Failed to delete ticket");
    }
  };

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-white  border-border" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 bg-white  border-border">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> New Ticket
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={TicketIcon} title="No tickets found" description="Create a ticket when a customer reports an issue" />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: idx * 0.02 }}
              >
                <GlassCard className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 shrink-0 ${
                      t.priority === "critical" ? "bg-red-500/15 text-red-500" :
                      t.priority === "high" ? "bg-amber-500/15 text-amber-500" :
                      t.priority === "medium" ? "bg-blue-500/15 text-blue-500" :
                      "bg-slate-500/15 text-slate-500"
                    }`}>
                      <TicketIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold truncate">{t.subject}</h4>
                        <div className="flex gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[t.priority] || ""}`}>{titleCase(t.priority)}</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>Opened {formatDate(t.createdAt)}</span>
                        <span>•</span>
                        <Select value={t.status} onValueChange={(v) => handleStatusChange(t, v)}>
                          <SelectTrigger className="h-6 w-[120px] text-[10px] border-0 px-1 py-0 bg-transparent hover:bg-white/60 dark:hover:bg-slate-700/60">
                            <Badge variant="outline" className={`text-[10px] ${TICKET_STATUS_STYLES[t.status] || ""}`}>{titleCase(t.status)}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border-border">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">New Support Ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">Subject *</Label>
              <Input id="ticket-subject" placeholder="Brief summary of the issue" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} required disabled={submitting} className="bg-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-desc">Description</Label>
              <Textarea id="ticket-desc" placeholder="Full details..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} disabled={submitting} className="bg-white min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ticket-priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })} disabled={submitting}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })} disabled={submitting}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white">
                {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main CrmView ─────────────────────────────────────────────────────────────

export function CrmView() {
  const { user } = useAppStore();
  const [activeTab, setActiveTab] = useState("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Every state update below happens after an `await`, so this can be called
  // straight from an effect without writing state synchronously during render.
  // Results from an aborted request (unmount) are dropped.
  const loadAllData = useCallback(async (signal?: AbortSignal) => {
    try {
      const headers = authHeaders();
      const [leadsRes, dealsRes, contactsRes, ticketsRes] = await Promise.all([
        fetch("/api/crm/leads", { headers, signal }),
        fetch("/api/crm/deals", { headers, signal }),
        fetch("/api/crm/contacts", { headers, signal }),
        fetch("/api/crm/tickets", { headers, signal }),
      ]);
      if (!leadsRes.ok || !dealsRes.ok || !contactsRes.ok || !ticketsRes.ok) {
        throw new Error(`Failed to load CRM data (leads=${leadsRes.status}, deals=${dealsRes.status}, contacts=${contactsRes.status}, tickets=${ticketsRes.status})`);
      }
      const [leadsJson, dealsJson, contactsJson, ticketsJson] = await Promise.all([
        leadsRes.json(), dealsRes.json(), contactsRes.json(), ticketsRes.json(),
      ]);
      if (signal?.aborted) return;
      setLeads(leadsJson.leads || []);
      setDeals(dealsJson.deals || []);
      setContacts(contactsJson.contacts || []);
      setTickets(ticketsJson.tickets || []);
      setLoadError(null);
    } catch (err) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : "Failed to load CRM data";
      setLoadError(msg);
      setLeads([]); setDeals([]); setContacts([]); setTickets([]);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  // Retry / refresh-after-mutation. Runs from event handlers and child `reload`
  // props, so flipping the loading flag immediately is safe here.
  const reloadAllData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    await loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const controller = new AbortController();
    // Dispatched inside an async scope so the effect body itself performs no
    // state update; every setState in the loader runs after the response awaits.
    void (async () => {
      await loadAllData(controller.signal);
    })();
    return () => controller.abort();
  }, [loadAllData]);

  const leadStats = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) => ["qualified", "contacted"].includes(l.status)).length;
    const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / total) : 0;
    return { total, qualified, avgScore };
  }, [leads]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
            CRM
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage leads, deals, contacts, and support tickets — real data, no mocks
          </p>
        </div>
        {user && (
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium">{user.name}</span>
          </p>
        )}
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 p-2.5 shadow-md shadow-orange-500/20">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Leads</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : leadStats.total}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <span>{isLoading ? "—" : `${leadStats.qualified} qualified`}</span>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 p-2.5 shadow-md shadow-blue-500/20">
                <Handshake className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Deals</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : deals.filter((d) => !["won", "lost"].includes(d.stage)).length}</p>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              Pipeline: <span className="font-semibold text-blue-600 dark:text-blue-400">{isLoading ? "—" : formatCurrency(deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0))}</span>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-2.5 shadow-md shadow-amber-500/20">
                <ContactIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Contacts</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : contacts.length}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-red-400 to-red-600 p-2.5 shadow-md shadow-red-500/20">
                <TicketIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Open Tickets</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : tickets.filter((t) => t.status === "open").length}</p>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              <span className="font-semibold text-orange-600 dark:text-orange-400">{isLoading ? "—" : tickets.filter((t) => t.priority === "critical" && t.status !== "closed").length}</span> critical
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {loadError && (
        <GlassCard className="p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Failed to load CRM data</p>
              <p className="text-xs text-muted-foreground mt-0.5">{loadError}</p>
            </div>
            <Button size="sm" variant="outline" onClick={reloadAllData}>Retry</Button>
          </div>
        </GlassCard>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white/60 dark:bg-slate-800/60  border border-border p-1 h-auto">
          <TabsTrigger value="leads" className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20 px-4 py-2 text-sm font-medium transition-all">
            <Users className="h-4 w-4" /><span className="hidden sm:inline">Leads</span>
          </TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/20 px-4 py-2 text-sm font-medium transition-all">
            <Handshake className="h-4 w-4" /><span className="hidden sm:inline">Deals</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20 px-4 py-2 text-sm font-medium transition-all">
            <ContactIcon className="h-4 w-4" /><span className="hidden sm:inline">Contacts</span>
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-red-500/20 px-4 py-2 text-sm font-medium transition-all">
            <TicketIcon className="h-4 w-4" /><span className="hidden sm:inline">Tickets</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads"><LeadsTab leads={leads} isLoading={isLoading} reload={reloadAllData} /></TabsContent>
        <TabsContent value="deals"><DealsTab deals={deals} isLoading={isLoading} reload={reloadAllData} /></TabsContent>
        <TabsContent value="contacts"><ContactsTab contacts={contacts} isLoading={isLoading} reload={reloadAllData} /></TabsContent>
        <TabsContent value="tickets"><TicketsTab tickets={tickets} isLoading={isLoading} reload={reloadAllData} /></TabsContent>
      </Tabs>

      <LeadEnrichmentPanel leads={leads} onReload={reloadAllData} />
    </div>
  );
}

export default CrmView;
