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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Clock,
  Trash2,
  Send,
  Ban,
  Eye,
  Loader2,
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

const ALL_ROLES = [
  "Super Admin",
  "Company Owner",
  "Admin",
  "Manager",
  "Social Media Manager",
  "Content Manager",
  "SEO Manager",
  "AI Agent Manager",
  "Customer Support",
  "Team Member",
  "Client User",
  "Viewer",
] as const;

type RoleType = (typeof ALL_ROLES)[number];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  avatar?: string;
  joinDate: string;
  status: "active" | "inactive";
}

interface PendingInvitation {
  id: string;
  email: string;
  role: RoleType;
  invitedBy: string;
  expiry: string;
  status: "pending" | "expired";
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  details: string;
}

interface TeamData {
  members: TeamMember[];
  pendingInvitations: PendingInvitation[];
  auditLogs: AuditLogEntry[];
}


// ─── Animation Variants ────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  "Super Admin": "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  "Company Owner": "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  "Admin": "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  "Manager": "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  "Social Media Manager": "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
  "Content Manager": "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  "SEO Manager": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "AI Agent Manager": "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  "Customer Support": "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30",
  "Team Member": "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  "Client User": "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  "Viewer": "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarGradient(name: string): string {
  const gradients = [
    "from-orange-400 to-amber-500",
    "from-blue-400 to-cyan-500",
    "from-emerald-400 to-teal-500",
    "from-violet-400 to-purple-500",
    "from-rose-400 to-pink-500",
    "from-cyan-400 to-blue-500",
    "from-amber-400 to-orange-500",
    "from-teal-400 to-emerald-500",
    "from-pink-400 to-rose-500",
    "from-indigo-400 to-violet-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function isExpired(dateStr: string): boolean {
  try {
    return new Date(dateStr) < new Date();
  } catch {
    return false;
  }
}

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

function TeamSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Invite Dialog ───────────────────────────────────────────────────────────────

function InviteDialog({ onInvite }: { onInvite: (email: string, role: string) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim() || !role) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      await onInvite(email.trim(), role);
      setEmail("");
      setRole("");
      setOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-500" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation email. They will receive a link to join your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Assign Role</Label>
            <Select value={role} onValueChange={setRole} disabled={sending}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={sending || !email.trim() || !role}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Member Card ────────────────────────────────────────────────────────────────

function MemberCard({
  member,
  onRoleChange,
  onRemove,
}: {
  member: TeamMember;
  onRoleChange: (id: string, role: string) => void;
  onRemove: (id: string) => void;
}) {
  const [changingRole, setChangingRole] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === member.role) return;
    setChangingRole(true);
    try {
      await onRoleChange(member.id, newRole);
    } finally {
      setChangingRole(false);
    }
  };

  return (
    <motion.div variants={itemVariants} whileHover={{ scale: 1.01 }}>
      <GlassCard className="group transition-shadow hover:shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGradient(
                  member.name
                )} text-white font-bold text-sm shadow-md`}
              >
                {getInitials(member.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{member.name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 dark:text-red-400"
                  onClick={() => onRemove(member.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0.5 font-medium border ${ROLE_COLORS[member.role] || "bg-slate-500/15 text-slate-600 border-slate-500/30"}`}
            >
              <Shield className="h-3 w-3 mr-1" />
              {member.role}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Joined {formatDate(member.joinDate)}
            </span>
          </div>

          {/* Inline Role Change */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Role:</Label>
              <Select
                value={member.role}
                onValueChange={handleRoleChange}
                disabled={changingRole || member.role === "Super Admin" || member.role === "Company Owner"}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  {changingRole ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </GlassCard>
    </motion.div>
  );
}

// ─── Pending Invitations Table ──────────────────────────────────────────────────

function PendingInvitationsTable({
  invitations,
  onResend,
  onRevoke,
}: {
  invitations: PendingInvitation[];
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  if (invitations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No pending invitations</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 dark:border-white/5">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs">Email</TableHead>
            <TableHead className="text-xs">Role</TableHead>
            <TableHead className="text-xs hidden sm:table-cell">Invited By</TableHead>
            <TableHead className="text-xs">Expiry</TableHead>
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => {
            const expired = isExpired(inv.expiry);
            return (
              <TableRow key={inv.id} className="hover:bg-white/5 dark:hover:bg-white/[0.02]">
                <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 border ${
                      ROLE_COLORS[inv.role] || "bg-slate-500/15 text-slate-600 border-slate-500/30"
                    }`}
                  >
                    {inv.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                  {inv.invitedBy}
                </TableCell>
                <TableCell>
                  <span
                    className={`text-xs ${expired ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    {formatDate(inv.expiry)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!expired && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              onClick={() => onResend(inv.id)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Resend invitation</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => onRevoke(inv.id)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revoke invitation</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────────

function AuditLogsSection({ logs }: { logs: AuditLogEntry[] }) {
  return (
    <ScrollArea className="max-h-96">
      <div className="overflow-hidden rounded-lg border border-white/10 dark:border-white/5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs w-[140px]">Timestamp</TableHead>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs w-[120px]">Action</TableHead>
              <TableHead className="text-xs hidden lg:table-cell">Resource</TableHead>
              <TableHead className="text-xs hidden md:table-cell">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} className="hover:bg-white/5 dark:hover:bg-white/[0.02]">
                <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </TableCell>
                <TableCell className="text-xs font-medium">{log.user}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 border-blue-500/20">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                  {log.resource}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                  {log.details}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function TeamView() {
  const { user } = useAppStore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"members" | "invitations" | "logs">("members");

  // Fetch real team data from /api/team
  const { data: apiData, isLoading, refetch } = useApiQuery<TeamData>("/api/team", { enabled: true });

  // Map API response to the view's expected shape
  const teamData: TeamData = apiData ?? {
    members: [],
    pendingInvitations: [],
    auditLogs: [],
  };

  // Mutations — hit real /api/team endpoint with action=invite / action=update_role
  const inviteMutation = useApiMutation({
    method: "POST",
    path: "/api/team",
    onSuccess: () => { toast.success("Invitation sent!"); refetch(); },
    onError: () => { toast.error("Failed to send invitation"); },
  });

  const roleMutation = useApiMutation({
    method: "POST",
    path: "/api/team",
    onSuccess: () => { toast.success("Role updated"); refetch(); },
    onError: () => { toast.error("Failed to update role"); },
  });

  const removeMutation = useApiMutation({
    method: "POST",
    path: "/api/team",
    onSuccess: () => { toast.success("Member removed"); refetch(); },
    onError: () => { toast.error("Failed to remove member"); },
  });

  const resendMutation = useApiMutation({
    method: "POST",
    path: "/api/team",
    onSuccess: () => { toast.success("Invitation resent"); refetch(); },
    onError: () => { toast.error("Failed to resend invitation"); },
  });

  const revokeMutation = useApiMutation({
    method: "POST",
    path: "/api/team",
    onSuccess: () => { toast.success("Invitation revoked"); refetch(); },
    onError: () => { toast.error("Failed to revoke invitation"); },
  });

  const handleInvite = useCallback(
    async (email: string, role: string) => {
      try {
        inviteMutation.mutate({ action: "invite", email, role });
      } catch {
        // handled by mutation
      }
    },
    [inviteMutation]
  );

  const handleRoleChange = useCallback(
    async (id: string, role: string) => {
      try {
        roleMutation.mutate({ action: "update_role", companyUserId: id, role });
      } catch {
        // handled by mutation
      }
    },
    [roleMutation]
  );

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        removeMutation.mutate({ action: "remove_member", companyUserId: id });
      } catch {
        // handled by mutation
      }
    },
    [removeMutation]
  );

  const handleResend = useCallback(
    async (id: string) => {
      try {
        resendMutation.mutate({ action: "resend_invitation", invitationId: id });
      } catch {
        // handled by mutation
      }
    },
    [resendMutation]
  );

  const handleRevoke = useCallback(
    async (id: string) => {
      try {
        revokeMutation.mutate({ action: "revoke_invitation", invitationId: id });
      } catch {
        // handled by mutation
      }
    },
    [revokeMutation]
  );

  // Filter members by search
  const filteredMembers = teamData.members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = teamData.members.filter((m) => m.status === "active").length;
  const pendingCount = teamData.pendingInvitations.filter((i) => i.status === "pending").length;

  if (isLoading) return <TeamSkeleton />;

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
            <Users className="h-7 w-7 text-orange-500" />
            Team Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your team members, roles, and permissions
          </p>
        </div>
        <InviteDialog onInvite={handleInvite} />
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Members", value: teamData.members.length, icon: Users, color: "from-orange-500 to-amber-500" },
          { label: "Active Members", value: activeCount, icon: Eye, color: "from-emerald-500 to-teal-500" },
          { label: "Pending Invites", value: pendingCount, icon: Mail, color: "from-blue-500 to-cyan-500" },
          { label: "Audit Entries", value: teamData.auditLogs.length, icon: Shield, color: "from-violet-500 to-purple-500" },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-3">
            <CardContent className="p-0">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color} text-white shadow-md`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </GlassCard>
        ))}
      </motion.div>

      {/* Tab Navigation */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 w-fit">
          {(["members", "invitations", "logs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "members"
                ? `Members (${teamData.members.length})`
                : tab === "invitations"
                  ? `Invitations (${teamData.pendingInvitations.length})`
                  : `Audit Logs (${teamData.auditLogs.length})`}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* Search */}
          <motion.div variants={itemVariants} className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </motion.div>

          {/* Members Grid */}
          <motion.div
            variants={containerVariants}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            ))}
          </motion.div>

          {filteredMembers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No members match your search</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Invitations Tab */}
      {activeTab === "invitations" && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <GlassCard>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                Pending Invitations
              </CardTitle>
              <CardDescription>
                Manage pending and expired invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingInvitationsTable
                invitations={teamData.pendingInvitations}
                onResend={handleResend}
                onRevoke={handleRevoke}
              />
            </CardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === "logs" && (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <GlassCard>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-500" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                Track all team and system activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogsSection logs={teamData.auditLogs} />
            </CardContent>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  );
}

export default TeamView;
