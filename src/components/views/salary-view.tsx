"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  Eye,
  Loader2,
  AlertTriangle,
  Calendar,
  FileText,
  Play,
} from "lucide-react";
import { toast } from "sonner";

interface SalaryRecord {
  id: string;
  basicSalary: number;
  houseRent: number;
  medicalAllowance: number;
  transportAllowance: number;
  bonus: number;
  deduction: number;
  tax: number;
  netSalary: number;
  payDate: string;
  month: string;
  year: number;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
    employeeProfile: {
      id: string;
      employeeId: string;
      designation: { id: string; title: string; level: number; baseSalary: number } | null;
    } | null;
  };
}

interface EmployeeOption {
  id: string;
  name: string;
  employeeProfile: {
    employeeId: string;
    designation: { id: string; title: string } | null;
  } | null;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = MONTHS[new Date().getMonth()];

function SalarySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardContent className="pt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SalaryView() {
  const { user } = useAuth();
  const isAdmin =
    user?.role === "admin" ||
    user?.role === "accountant" ||
    user?.isSuperAdmin;

  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [slipOpen, setSlipOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genEmployeeId, setGenEmployeeId] = useState("");

  const queryPath = `/api/salary?month=${selectedMonth}&year=${selectedYear}`;
  const { data: salaries, isLoading, error, refetch } = useApiQuery<SalaryRecord[]>(queryPath, {
    enabled: isAdmin,
  });

  const { data: employees } = useApiQuery<EmployeeOption[]>("/api/employees?limit=100", {
    enabled: isAdmin,
  });

  const generateMutation = useApiMutation({
    method: "POST",
    path: "/api/salary",
    onSuccess: () => {
      toast.success("Salary generated successfully");
      setGenerateOpen(false);
      setGenEmployeeId("");
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const handleGenerate = useCallback(() => {
    if (!genEmployeeId) {
      toast.error("Please select an employee");
      return;
    }
    generateMutation.mutate({
      userId: genEmployeeId,
      month: selectedMonth,
      year: Number(selectedYear),
    });
  }, [genEmployeeId, selectedMonth, selectedYear, generateMutation]);

  const openSlip = (salary: SalaryRecord) => {
    setSelectedSalary(salary);
    setSlipOpen(true);
  };

  const totalNet = useMemo(
    () => (salaries || []).reduce((sum, s) => sum + s.netSalary, 0),
    [salaries]
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary</h1>
          <p className="text-muted-foreground">Payroll management</p>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm text-destructive font-medium">Access Denied</p>
            <p className="text-xs text-muted-foreground mt-1">
              Only administrators and accountants can manage payroll.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <SalarySkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary & Payroll</h1>
          <p className="text-muted-foreground">Manage employee salaries and payroll</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <Play className="h-4 w-4 mr-1" /> Generate Salary
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="ml-auto text-sm">
          Total: {formatCurrency(totalNet)}
        </Badge>
      </div>

      {/* Salary Table */}
      <Card>
        <CardContent className="pt-6">
          {error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Failed to load salary data</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <button onClick={refetch} className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline">
                Retry
              </button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaries && salaries.length > 0 ? (
                    salaries.map((s) => {
                      const totalAllowances =
                        s.houseRent + s.medicalAllowance + s.transportAllowance + s.bonus;
                      const totalDeductions = s.deduction + s.tax;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{s.user.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.user.employeeProfile?.employeeId || "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.user.employeeProfile?.designation?.title || "—"}
                          </TableCell>
                          <TableCell>{formatCurrency(s.basicSalary)}</TableCell>
                          <TableCell className="text-emerald-600">
                            {formatCurrency(totalAllowances)}
                          </TableCell>
                          <TableCell className="text-red-500">
                            -{formatCurrency(totalDeductions)}
                          </TableCell>
                          <TableCell className="font-bold">{formatCurrency(s.netSalary)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                s.status === "paid"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : s.status === "pending"
                                    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                    : "bg-red-500/10 text-red-600 border-red-500/20"
                              }
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => openSlip(s)}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> Slip
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No salary records for {selectedMonth} {selectedYear}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Salary Slip Dialog */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" /> Salary Slip
            </DialogTitle>
          </DialogHeader>
          {selectedSalary && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Employee</p>
                    <p className="font-medium">{selectedSalary.user.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employee ID</p>
                    <p className="font-medium">{selectedSalary.user.employeeProfile?.employeeId || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Designation</p>
                    <p className="font-medium">{selectedSalary.user.employeeProfile?.designation?.title || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Period</p>
                    <p className="font-medium">{selectedSalary.month} {selectedSalary.year}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-emerald-600">Earnings</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Basic Salary</span>
                  <span className="text-right">{formatCurrency(selectedSalary.basicSalary)}</span>
                  <span className="text-muted-foreground">House Rent</span>
                  <span className="text-right">{formatCurrency(selectedSalary.houseRent)}</span>
                  <span className="text-muted-foreground">Medical Allowance</span>
                  <span className="text-right">{formatCurrency(selectedSalary.medicalAllowance)}</span>
                  <span className="text-muted-foreground">Transport Allowance</span>
                  <span className="text-right">{formatCurrency(selectedSalary.transportAllowance)}</span>
                  {selectedSalary.bonus > 0 && (
                    <>
                      <span className="text-muted-foreground">Bonus</span>
                      <span className="text-right">{formatCurrency(selectedSalary.bonus)}</span>
                    </>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-500">Deductions</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Deduction</span>
                  <span className="text-right">-{formatCurrency(selectedSalary.deduction)}</span>
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-right">-{formatCurrency(selectedSalary.tax)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-bold">Net Salary</span>
                <span className="text-xl font-bold text-emerald-600">
                  {formatCurrency(selectedSalary.netSalary)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-right">
                Pay Date: {selectedSalary.payDate ? new Date(selectedSalary.payDate).toLocaleDateString() : "—"}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Salary Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Salary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Generate salary for <strong>{selectedMonth} {selectedYear}</strong>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Employee</label>
              <Select value={genEmployeeId} onValueChange={setGenEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeProfile?.designation?.title || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isLoading}>
                {generateMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Wallet className="h-4 w-4 mr-1" /> Generate
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
