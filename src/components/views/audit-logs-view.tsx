"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface PaginatedLogs {
  items: AuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const RESOURCES = [
  "User",
  "Student",
  "Employee",
  "Department",
  "Program",
  "Subject",
  "Fee",
  "Payment",
  "Salary",
  "Leave",
  "Announcement",
  "Partner",
  "Institution",
];

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"];

function actionColor(action: string) {
  switch (action) {
    case "CREATE":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "UPDATE":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "DELETE":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "LOGIN":
      return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    case "LOGOUT":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "";
  }
}

function AuditSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Card>
        <CardContent className="pt-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuditLogsView() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (actionFilter !== "all") params.set("action", actionFilter);
  if (resourceFilter !== "all") params.set("resource", resourceFilter);
  params.set("page", String(page));

  const { data: logsData, isLoading, error, refetch } =
    useApiQuery<PaginatedLogs>(`/api/audit-logs?${params.toString()}`);

  if (isLoading) return <AuditSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          Track all system actions and changes
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={resourceFilter}
          onValueChange={(v) => {
            setResourceFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {RESOURCES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">System Activity</CardTitle>
            </div>
            <CardDescription>
              {logsData?.pagination.total ?? 0} total log entries
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">
                Failed to load audit logs
              </p>
              <button
                onClick={refetch}
                className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Resource ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData?.items && logsData.items.length > 0 ? (
                      logsData.items.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>
                                {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                              </span>
                              <span className="text-[10px]">
                                {formatDistanceToNow(new Date(log.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">
                                {log.user?.name || "System"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {log.user?.email || ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={actionColor(log.action)}
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.resource}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground max-w-[80px] truncate">
                            {log.resourceId
                              ? log.resourceId.length > 12
                                ? log.resourceId.slice(0, 12) + "..."
                                : log.resourceId
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.ipAddress || "—"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {log.details || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          No audit logs found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {logsData?.pagination &&
                logsData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Page {logsData.pagination.page} of{" "}
                      {logsData.pagination.totalPages} ({logsData.pagination.total} total)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          page >= logsData.pagination.totalPages
                        }
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
