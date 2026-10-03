"use client";

import { useState, useCallback } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  AlertTriangle,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

interface EmployeeRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  employeeProfile: {
    id: string;
    employeeId: string;
    employmentType: string;
    status: string;
    joinDate: string;
    department: { id: string; name: string; code: string } | null;
    designation: {
      id: string;
      title: string;
      level: number;
      baseSalary: number;
    } | null;
    bankName: string | null;
    bankAccount: string | null;
    bankBranch: string | null;
  } | null;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string | null;
}

interface DesignationOption {
  id: string;
  title: string;
  level: number;
  baseSalary: number;
}

interface EmployeeDetail extends EmployeeRecord {
  institution: { id: string; name: string; shortName: string } | null;
  leaveRequests: { id: string; startDate: string; endDate: string; status: string; reason: string | null }[];
  salaries: { id: string; month: string; year: number; netSalary: number; status: string }[];
}

function empStatusBadge(status: string) {
  if (!status) return <Badge variant="outline">unknown</Badge>;
  const s = status.toLowerCase();
  if (s === "active")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        {status}
      </Badge>
    );
  if (s === "inactive" || s === "terminated" || s === "resigned")
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
        {status}
      </Badge>
    );
  if (s === "on_leave" || s === "on leave")
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        On Leave
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
      {status}
    </Badge>
  );
}

function employmentTypeBadge(type: string) {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === "full-time")
    return (
      <Badge variant="secondary" className="text-xs">
        Full-time
      </Badge>
    );
  if (t === "part-time")
    return (
      <Badge variant="secondary" className="text-xs">
        Part-time
      </Badge>
    );
  if (t === "contract")
    return (
      <Badge variant="secondary" className="text-xs">
        Contract
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-xs">
      {type}
    </Badge>
  );
}

export default function EmployeesView() {
  const { institution } = useAppStore();

  // Filters
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("search", search);
    if (departmentId) params.set("departmentId", departmentId);
    if (statusFilter) params.set("status", statusFilter);
    return `/api/employees?${params.toString()}`;
  }, [search, departmentId, statusFilter, page]);

  const {
    data: employeesData,
    isLoading,
    error,
    refetch,
  } = useApiQuery<EmployeeRecord[]>(buildQuery());

  const { data: departments } = useApiQuery<DepartmentOption[]>(
    "/api/departments"
  );
  const { data: designations } = useApiQuery<DesignationOption[]>(
    "/api/designations"
  );

  const employees = Array.isArray(employeesData) ? employeesData : [];

  // Add employee dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    employeeId: "",
    role: "employee",
    employmentType: "full-time",
    departmentId: "",
    designationId: "",
    bankName: "",
    bankAccount: "",
    bankBranch: "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const { mutateAsync: createEmployee } = useApiMutation<unknown, unknown>({
    method: "POST",
    path: "/api/employees",
  });

  const handleAddEmployee = async () => {
    setAddSubmitting(true);
    try {
      await createEmployee({
        ...addForm,
        institutionId: institution?.id,
        employeeProfile: {
          employeeId: addForm.employeeId || undefined,
          employmentType: addForm.employmentType,
          departmentId: addForm.departmentId || undefined,
          designationId: addForm.designationId || undefined,
          bankName: addForm.bankName || undefined,
          bankAccount: addForm.bankAccount || undefined,
          bankBranch: addForm.bankBranch || undefined,
        },
      });
      toast.success("Employee added successfully");
      setAddOpen(false);
      setAddForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        employeeId: "",
        role: "employee",
        employmentType: "full-time",
        departmentId: "",
        designationId: "",
        bankName: "",
        bankAccount: "",
        bankBranch: "",
      });
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add employee"
      );
    } finally {
      setAddSubmitting(false);
    }
  };

  // View employee dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<EmployeeDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const handleViewEmployee = async (id: string) => {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const data = await api.get<EmployeeDetail>(`/api/employees/${id}`);
      setViewEmployee(data);
    } catch {
      toast.error("Failed to load employee details");
    } finally {
      setViewLoading(false);
    }
  };

  // Delete employee
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteEmployee = async (id: string) => {
    setDeleteLoading(true);
    try {
      await api.del(`/api/employees/${id}`);
      toast.success("Employee deleted successfully");
      setDeletingId(null);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete employee"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage staff and faculty records
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-name">Full Name *</Label>
                  <Input
                    id="e-name"
                    placeholder="Employee name"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-email">Email *</Label>
                  <Input
                    id="e-email"
                    type="email"
                    placeholder="emp@alo.edu.bd"
                    value={addForm.email}
                    onChange={(e) =>
                      setAddForm({ ...addForm, email: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-phone">Phone</Label>
                  <Input
                    id="e-phone"
                    placeholder="+880 1XXX-XXXXXX"
                    value={addForm.phone}
                    onChange={(e) =>
                      setAddForm({ ...addForm, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-password">Password *</Label>
                  <Input
                    id="e-password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={addForm.password}
                    onChange={(e) =>
                      setAddForm({ ...addForm, password: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-eid">Employee ID</Label>
                  <Input
                    id="e-eid"
                    placeholder="e.g., EMP-001"
                    value={addForm.employeeId}
                    onChange={(e) =>
                      setAddForm({ ...addForm, employeeId: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={addForm.role}
                    onValueChange={(v) =>
                      setAddForm({ ...addForm, role: v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Employment Type</Label>
                  <Select
                    value={addForm.employmentType}
                    onValueChange={(v) =>
                      setAddForm({ ...addForm, employmentType: v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select
                    value={addForm.departmentId}
                    onValueChange={(v) =>
                      setAddForm({ ...addForm, departmentId: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {Array.isArray(departments) &&
                        departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.code ? `${d.code} - ` : ""}
                            {d.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Designation</Label>
                  <Select
                    value={addForm.designationId}
                    onValueChange={(v) =>
                      setAddForm({ ...addForm, designationId: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {Array.isArray(designations) &&
                        designations.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bank Details */}
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-3 flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Bank Details (Optional)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="e-bank">Bank Name</Label>
                    <Input
                      id="e-bank"
                      placeholder="e.g., DBBL"
                      value={addForm.bankName}
                      onChange={(e) =>
                        setAddForm({ ...addForm, bankName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-account">Account No.</Label>
                    <Input
                      id="e-account"
                      placeholder="Account number"
                      value={addForm.bankAccount}
                      onChange={(e) =>
                        setAddForm({ ...addForm, bankAccount: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-branch">Branch</Label>
                    <Input
                      id="e-branch"
                      placeholder="Branch name"
                      value={addForm.bankBranch}
                      onChange={(e) =>
                        setAddForm({ ...addForm, bankBranch: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAddEmployee}
                disabled={
                  !addForm.name || !addForm.email || !addForm.password || addSubmitting
                }
              >
                {addSubmitting && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Create Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or employee ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={departmentId}
              onValueChange={(v) => {
                setDepartmentId(v === "__all__" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Departments</SelectItem>
                {Array.isArray(departments) &&
                  departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code ? `${d.code} - ` : ""}
                      {d.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v === "__all__" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Records</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `${employees.length} employees found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 mb-4 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
              <button onClick={refetch} className="underline ml-2">
                Retry
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32 flex-1" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/10 text-xs font-medium text-teal-600">
                            {e.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <span className="font-medium text-sm">
                              {e.name}
                            </span>
                            <p className="text-xs text-muted-foreground capitalize">
                              {e.role}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {e.employeeProfile?.employeeId || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{e.email}</TableCell>
                      <TableCell className="text-sm">
                        {e.employeeProfile?.department?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.employeeProfile?.designation?.title || "—"}
                      </TableCell>
                      <TableCell>
                        {employmentTypeBadge(
                          e.employeeProfile?.employmentType || ""
                        )}
                      </TableCell>
                      <TableCell>
                        {empStatusBadge(e.employeeProfile?.status || "")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewEmployee(e.id)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog
                            open={deletingId === e.id}
                            onOpenChange={(open) => !open && setDeletingId(null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingId(e.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete{" "}
                                  <strong>{e.name}</strong>? This action cannot
                                  be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteEmployee(e.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                  disabled={deleteLoading}
                                >
                                  {deleteLoading && (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  )}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {employees.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={employees.length < limit}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Employee Detail Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : viewEmployee ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-lg font-bold text-teal-600">
                  {viewEmployee.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{viewEmployee.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {viewEmployee.employeeProfile?.employeeId || "No ID"} ·{" "}
                    {viewEmployee.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">
                    {viewEmployee.phone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">
                    {viewEmployee.role}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-0.5">
                    {empStatusBadge(viewEmployee.employeeProfile?.status || "")}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Employment Type</p>
                  <div className="mt-0.5">
                    {employmentTypeBadge(
                      viewEmployee.employeeProfile?.employmentType || ""
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">
                    {viewEmployee.employeeProfile?.department?.name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Designation</p>
                  <p className="font-medium">
                    {viewEmployee.employeeProfile?.designation?.title || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Join Date</p>
                  <p className="font-medium">
                    {new Date(
                      viewEmployee.employeeProfile?.joinDate || ""
                    ).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Base Salary</p>
                  <p className="font-medium">
                    {viewEmployee.employeeProfile?.designation?.baseSalary
                      ? `${viewEmployee.employeeProfile.designation.baseSalary} BDT`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Bank Details */}
              {(viewEmployee.employeeProfile?.bankName ||
                viewEmployee.employeeProfile?.bankAccount) && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Bank Details</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Bank</p>
                      <p className="font-medium">
                        {viewEmployee.employeeProfile?.bankName || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Account</p>
                      <p className="font-medium">
                        {viewEmployee.employeeProfile?.bankAccount || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Branch</p>
                      <p className="font-medium">
                        {viewEmployee.employeeProfile?.bankBranch || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Salary */}
              {viewEmployee.salaries?.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Recent Salaries</p>
                  <div className="space-y-2">
                    {viewEmployee.salaries.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {s.month} {s.year}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{s.netSalary} BDT</p>
                          {empStatusBadge(s.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leave Requests */}
              {viewEmployee.leaveRequests?.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-2">Leave Requests</p>
                  <div className="space-y-2">
                    {viewEmployee.leaveRequests.slice(0, 3).map((lr) => (
                      <div
                        key={lr.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(lr.startDate).toLocaleDateString()} –{" "}
                            {new Date(lr.endDate).toLocaleDateString()}
                          </p>
                          <p className="font-medium">{lr.reason || "No reason"}</p>
                        </div>
                        {empStatusBadge(lr.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Failed to load employee details
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
