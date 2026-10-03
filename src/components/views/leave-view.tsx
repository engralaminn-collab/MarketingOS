"use client";

import { useState, useCallback } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import { useAuth } from "@/hooks/use-auth";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarOff,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";

interface LeaveRequestItem {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionNote: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  leaveType: {
    id: string;
    name: string;
    code: string | null;
    isPaid: boolean;
  } | null;
}

interface LeaveTypeOption {
  id: string;
  name: string;
  code: string | null;
  daysPerYear: number;
  isPaid: boolean;
}

interface PaginatedLeaves {
  items: LeaveRequestItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "pending":
    default:
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
  }
}

function LeaveSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-36" />
      </div>
      <Card>
        <CardContent className="pt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeaveView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.isSuperAdmin;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTypeId, setCreateTypeId] = useState("");
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const basePath = isAdmin ? "/api/leave" : "/api/leave/mine";
  const queryPath = `${basePath}?status=${statusFilter}&page=${page}`;
  const { data: leavesData, isLoading, error, refetch } = useApiQuery<PaginatedLeaves>(queryPath);

  const { data: leaveTypes } = useApiQuery<LeaveTypeOption[]>("/api/leave-types");

  const createMutation = useApiMutation({
    method: "POST",
    path: "/api/leave",
    onSuccess: () => {
      toast.success("Leave request submitted");
      setCreateOpen(false);
      resetCreateForm();
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const approveMutation = useApiMutation({
    method: "PUT",
    onSuccess: () => {
      toast.success("Leave request approved");
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const rejectMutation = useApiMutation({
    method: "PUT",
    onSuccess: () => {
      toast.success("Leave request rejected");
      setRejectDialogId(null);
      setRejectNote("");
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const resetCreateForm = () => {
    setCreateTypeId("");
    setCreateStart("");
    setCreateEnd("");
    setCreateReason("");
  };

  const handleCreate = useCallback(() => {
    if (!createTypeId || !createStart || !createEnd) {
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate({
      leaveTypeId: createTypeId,
      startDate: createStart,
      endDate: createEnd,
      reason: createReason || null,
    });
  }, [createTypeId, createStart, createEnd, createReason, createMutation]);

  const handleApprove = useCallback(
    (id: string) => {
      approveMutation.mutate(
        { status: "approved" },
        `/api/leave/${id}`
      );
    },
    [approveMutation]
  );

  const handleReject = useCallback(() => {
    if (!rejectDialogId) return;
    rejectMutation.mutate(
      { status: "rejected", rejectionNote: rejectNote || null },
      `/api/leave/${rejectDialogId}`
    );
  }, [rejectDialogId, rejectNote, rejectMutation]);

  if (isLoading) return <LeaveSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage all leave requests" : "Your leave requests"}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Request
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leave Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">Leave Requests</CardTitle>
          </div>
          <CardDescription>
            {leavesData?.pagination.total ?? 0} total requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Failed to load leave requests</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <button onClick={refetch} className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline">
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leavesData?.items && leavesData.items.length > 0 ? (
                      leavesData.items.map((lr) => (
                        <TableRow key={lr.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-medium text-emerald-600">
                                {lr.user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{lr.user.name}</p>
                                <p className="text-xs text-muted-foreground">{lr.user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{lr.leaveType?.name || "General"}</span>
                              {lr.leaveType?.isPaid && (
                                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  Paid
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(lr.startDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(lr.endDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{lr.totalDays} day{lr.totalDays > 1 ? "s" : ""}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {lr.reason || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadge(lr.status)}>
                              {lr.status}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              {lr.status === "pending" && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-emerald-600 hover:text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10"
                                    onClick={() => handleApprove(lr.id)}
                                    disabled={approveMutation.isLoading}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-500 hover:text-red-600 border-red-500/30 hover:bg-red-500/10"
                                    onClick={() => setRejectDialogId(lr.id)}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                                  </Button>
                                </div>
                              )}
                              {lr.rejectionNote && (
                                <p className="text-xs text-red-500 mt-1" title={lr.rejectionNote}>
                                  {lr.rejectionNote.length > 20 ? lr.rejectionNote.slice(0, 20) + "..." : lr.rejectionNote}
                                </p>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-8">
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {leavesData?.pagination && leavesData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {leavesData.pagination.page} of {leavesData.pagination.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={page >= leavesData.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Leave Request Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={createTypeId} onValueChange={setCreateTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes?.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.name} ({lt.daysPerYear} days/year{lt.isPaid ? " · Paid" : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leave-start">Start Date</Label>
                <Input id="leave-start" type="date" value={createStart} onChange={(e) => setCreateStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-end">End Date</Label>
                <Input id="leave-end" type="date" value={createEnd} onChange={(e) => setCreateEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-reason">Reason</Label>
              <Textarea id="leave-reason" placeholder="Why do you need leave?" value={createReason} onChange={(e) => setCreateReason(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isLoading}>
                {createMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={!!rejectDialogId} onOpenChange={(open) => { if (!open) { setRejectDialogId(null); setRejectNote(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this leave request? Optionally provide a reason below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Rejection reason (optional)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={2}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleReject}
              disabled={rejectMutation.isLoading}
            >
              {rejectMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
