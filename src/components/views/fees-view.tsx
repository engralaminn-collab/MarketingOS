"use client";

import { useState, useCallback } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  AlertTriangle,
  Loader2,
  Receipt,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface FeeRecord {
  id: string;
  studentName: string;
  studentId: string;
  feeStructureName: string;
  amount: number;
  paidAmount: number;
  dueDate: string | null;
  status: string;
}

interface FeeStructureRecord {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  isActive: boolean;
  program: { id: string; name: string } | null;
}

interface PaginatedFees {
  items: FeeRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "partial":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "overdue":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    default:
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
  }
}

function FeesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </CardHeader>
        <CardContent>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FeesView() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payTxId, setPayTxId] = useState("");
  const [payRemarks, setPayRemarks] = useState("");
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [structName, setStructName] = useState("");
  const [structAmount, setStructAmount] = useState("");
  const [structFrequency, setStructFrequency] = useState("semester");

  const queryPath = `/api/fees?status=${statusFilter}&page=${page}${search ? `&search=${search}` : ""}`;
  const { data: feesData, isLoading, error, refetch } = useApiQuery<PaginatedFees>(queryPath);
  const { data: feeStructures, isLoading: structLoading, refetch: refetchStructs } = useApiQuery<FeeStructureRecord[]>("/api/fee-structures");

  const payMutation = useApiMutation({
    method: "POST",
    path: "/api/payments",
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      setPayDialogOpen(false);
      resetPayForm();
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const structMutation = useApiMutation({
    method: "POST",
    path: "/api/fee-structures",
    onSuccess: () => {
      toast.success("Fee structure created");
      setStructureDialogOpen(false);
      setStructName("");
      setStructAmount("");
      refetchStructs();
    },
    onError: (err) => toast.error(err),
  });

  const resetPayForm = () => {
    setPayAmount("");
    setPayMethod("cash");
    setPayTxId("");
    setPayRemarks("");
    setSelectedFee(null);
  };

  const handleRecordPayment = useCallback(() => {
    if (!selectedFee || !payAmount || Number(payAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    payMutation.mutate({
      feeId: selectedFee.id,
      amount: Number(payAmount),
      method: payMethod,
      transactionId: payTxId || null,
      remarks: payRemarks || null,
    });
  }, [selectedFee, payAmount, payMethod, payTxId, payRemarks, payMutation]);

  const handleAddStructure = useCallback(() => {
    if (!structName || !structAmount || Number(structAmount) <= 0) {
      toast.error("Please fill in all fields");
      return;
    }
    structMutation.mutate({
      name: structName,
      amount: Number(structAmount),
      frequency: structFrequency,
    });
  }, [structName, structAmount, structFrequency, structMutation]);

  const openPayDialog = (fee: FeeRecord) => {
    const remaining = fee.amount - fee.paidAmount;
    setSelectedFee(fee);
    setPayAmount(String(remaining > 0 ? remaining : fee.amount));
    setPayDialogOpen(true);
  };

  if (isLoading) return <FeesSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fee Management</h1>
        <p className="text-muted-foreground">Track and manage student fees</p>
      </div>

      {/* Fee Structures Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">Fee Structures</CardTitle>
            </div>
            <Button size="sm" onClick={() => setStructureDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Structure
            </Button>
          </div>
          <CardDescription>Define fee types and amounts</CardDescription>
        </CardHeader>
        <CardContent>
          {structLoading ? (
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 flex-1" />
              ))}
            </div>
          ) : feeStructures && feeStructures.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {feeStructures.map((fs) => (
                <div
                  key={fs.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{fs.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fs.frequency} · {fs.program?.name || "General"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">
                      {formatCurrency(fs.amount)}
                    </p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {fs.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No fee structures defined yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Fees Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">Student Fees</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  className="pl-8 w-48"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Failed to load fees</p>
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
                      <TableHead>Student</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feesData?.items && feesData.items.length > 0 ? (
                      feesData.items.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">{fee.studentName}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{fee.studentId}</TableCell>
                          <TableCell>{fee.feeStructureName}</TableCell>
                          <TableCell>{formatCurrency(fee.amount)}</TableCell>
                          <TableCell className="text-emerald-600 font-medium">{formatCurrency(fee.paidAmount)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {fee.dueDate ? format(new Date(fee.dueDate), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadge(fee.status)}>
                              {fee.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {fee.status !== "paid" && (
                              <Button size="sm" variant="outline" onClick={() => openPayDialog(fee)}>
                                Record Payment
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No fees found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {feesData?.pagination && feesData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {feesData.pagination.page} of {feesData.pagination.totalPages}
                    <span className="ml-2">({feesData.pagination.total} total)</span>
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
                      disabled={page >= feesData.pagination.totalPages}
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

      {/* Record Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => { setPayDialogOpen(open); if (!open) resetPayForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedFee && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-sm font-medium">{selectedFee.studentName}</p>
                <p className="text-xs text-muted-foreground">{selectedFee.feeStructureName} · {selectedFee.studentId}</p>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm">
                  <span>Total Amount:</span>
                  <span className="font-medium">{formatCurrency(selectedFee.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Already Paid:</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(selectedFee.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Remaining:</span>
                  <span className="text-amber-600">{formatCurrency(selectedFee.amount - selectedFee.paidAmount)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-amount">Amount</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="mobile">Mobile Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-txid">Transaction ID (optional)</Label>
                <Input
                  id="pay-txid"
                  placeholder="Enter transaction ID"
                  value={payTxId}
                  onChange={(e) => setPayTxId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-remarks">Remarks (optional)</Label>
                <Textarea
                  id="pay-remarks"
                  placeholder="Any remarks"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPayDialogOpen(false); resetPayForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleRecordPayment} disabled={payMutation.isLoading}>
                  {payMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Fee Structure Dialog */}
      <Dialog open={structureDialogOpen} onOpenChange={setStructureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fee Structure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="struct-name">Name</Label>
              <Input
                id="struct-name"
                placeholder="e.g., Tuition Fee"
                value={structName}
                onChange={(e) => setStructName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="struct-amount">Amount (BDT)</Label>
              <Input
                id="struct-amount"
                type="number"
                placeholder="Enter amount"
                value={structAmount}
                onChange={(e) => setStructAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={structFrequency} onValueChange={setStructFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStructureDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStructure} disabled={structMutation.isLoading}>
                {structMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Structure
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
