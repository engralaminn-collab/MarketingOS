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
  GraduationCap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
  role: string;
  createdAt: string;
  studentProfile: {
    id: string;
    studentId: string;
    dateOfBirth: string | null;
    gender: string | null;
    currentSemester: number;
    cgpa: number;
    totalCredits: number;
    status: string;
    admissionDate: string;
    admissionStatus: string;
    address: string | null;
    city: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    emergencyContact: string | null;
  } | null;
  enrollments: {
    id: string;
    program: { id: string; name: string; code: string } | null;
    batch: { id: string; name: string; academicYear: string } | null;
    semester: { id: string; name: string; number: number } | null;
  }[];
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProgramOption {
  id: string;
  name: string;
  code: string | null;
}

interface BatchOption {
  id: string;
  name: string;
  academicYear: string;
}

interface StudentDetail extends StudentRecord {
  institution: { id: string; name: string; shortName: string } | null;
}

function statusBadge(status: string) {
  if (!status) return <Badge variant="outline">unknown</Badge>;
  const s = status.toLowerCase();
  if (s === "active" || s === "completed")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        {status}
      </Badge>
    );
  if (s === "inactive" || s === "dropped" || s === "suspended")
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
        {status}
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
      {status}
    </Badge>
  );
}

export default function StudentsView() {
  const { institution } = useAppStore();

  // Filters
  const [search, setSearch] = useState("");
  const [programId, setProgramId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Build query path
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("search", search);
    if (programId) params.set("programId", programId);
    if (statusFilter) params.set("status", statusFilter);
    return `/api/students?${params.toString()}`;
  }, [search, programId, statusFilter, page]);

  const {
    data: studentsData,
    isLoading,
    error,
    refetch,
  } = useApiQuery<StudentRecord[]>(buildQuery());

  const { data: programs } = useApiQuery<ProgramOption[]>("/api/programs");

  // Pagination extracted from response
  const students = Array.isArray(studentsData) ? studentsData : [];
  const totalPages = 5; // Will rely on a second fetch or header

  // Add student dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    programId: "",
    batchId: "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const { mutateAsync: createStudent } = useMutation<StudentRecord, unknown>({
    method: "POST",
    path: "/api/students",
  });

  const handleAddStudent = async () => {
    setAddSubmitting(true);
    try {
      await createStudent({
        ...addForm,
        programId: addForm.programId || undefined,
        batchId: addForm.batchId || undefined,
        institutionId: institution?.id,
      });
      toast.success("Student added successfully");
      setAddOpen(false);
      setAddForm({ name: "", email: "", phone: "", password: "", programId: "", batchId: "" });
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setAddSubmitting(false);
    }
  };

  // View student dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<StudentDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const handleViewStudent = async (id: string) => {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const data = await api.get<StudentDetail>(`/api/students/${id}`);
      setViewStudent(data);
    } catch {
      toast.error("Failed to load student details");
    } finally {
      setViewLoading(false);
    }
  };

  // Delete student
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteStudent = async (id: string) => {
    setDeleteLoading(true);
    try {
      await api.del(`/api/students/${id}`);
      toast.success("Student deleted successfully");
      setDeletingId(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete student");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Batch filter by programId
  const { data: batches } = useApiQuery<BatchOption[]>(
    addForm.programId ? `/api/batches?programId=${addForm.programId}` : null
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">
            Manage student records and enrollments
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Full Name *</Label>
                <Input
                  id="s-name"
                  placeholder="Student full name"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-email">Email *</Label>
                <Input
                  id="s-email"
                  type="email"
                  placeholder="student@alo.edu.bd"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-phone">Phone</Label>
                <Input
                  id="s-phone"
                  placeholder="+880 1XXX-XXXXXX"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-password">Password *</Label>
                <Input
                  id="s-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Program</Label>
                  <Select
                    value={addForm.programId}
                    onValueChange={(v) => setAddForm({ ...addForm, programId: v, batchId: "" })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(programs) &&
                        programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code ? `${p.code} - ` : ""}
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Batch</Label>
                  <Select
                    value={addForm.batchId}
                    onValueChange={(v) => setAddForm({ ...addForm, batchId: v })}
                    disabled={!addForm.programId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(batches) &&
                        batches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} ({b.academicYear})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAddStudent}
                disabled={!addForm.name || !addForm.email || !addForm.password || addSubmitting}
              >
                {addSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create Student
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
                placeholder="Search by name, email, or student ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={programId} onValueChange={(v) => { setProgramId(v === "__all__" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Programs</SelectItem>
                {Array.isArray(programs) &&
                  programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code ? `${p.code} - ` : ""}{p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "__all__" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="dropped">Dropped</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Records</CardTitle>
          <CardDescription>
            {isLoading ? "Loading..." : `${students.length} students found`}
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
                    <TableHead>Student</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>CGPA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
                    const latestEnrollment = s.enrollments?.[s.enrollments.length - 1];
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-medium text-emerald-600">
                              {s.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <span className="font-medium text-sm">{s.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {s.studentProfile?.studentId || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{s.email}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {s.phone || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {latestEnrollment?.program?.name || "—"}
                        </TableCell>
                        <TableCell>
                          {s.studentProfile?.currentSemester ?? latestEnrollment?.semester?.number ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.studentProfile?.cgpa?.toFixed(2) ?? "—"}
                        </TableCell>
                        <TableCell>
                          {statusBadge(s.studentProfile?.status || "")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewStudent(s.id)}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <AlertDialog
                              open={deletingId === s.id}
                              onOpenChange={(open) => !open && setDeletingId(null)}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeletingId(s.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Student</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete{" "}
                                    <strong>{s.name}</strong>? This action cannot be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteStudent(s.id)}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {students.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
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
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Student Detail Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : viewStudent ? (
            <div className="space-y-4">
              {/* Profile Section */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-lg font-bold text-emerald-600">
                  {viewStudent.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{viewStudent.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {viewStudent.studentProfile?.studentId || "No ID"} · {viewStudent.email}
                  </p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{viewStudent.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-0.5">
                    {statusBadge(viewStudent.studentProfile?.status || "")}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Gender</p>
                  <p className="font-medium">
                    {viewStudent.studentProfile?.gender || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {viewStudent.studentProfile?.dateOfBirth
                      ? new Date(viewStudent.studentProfile.dateOfBirth).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Admission Date</p>
                  <p className="font-medium">
                    {new Date(viewStudent.studentProfile?.admissionDate || "").toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Semester</p>
                  <p className="font-medium">
                    {viewStudent.studentProfile?.currentSemester ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">CGPA</p>
                  <p className="font-medium text-lg text-emerald-600">
                    {viewStudent.studentProfile?.cgpa?.toFixed(2) ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Credits</p>
                  <p className="font-medium">
                    {viewStudent.studentProfile?.totalCredits ?? "—"}
                  </p>
                </div>
              </div>

              {/* Address */}
              {(viewStudent.studentProfile?.address || viewStudent.studentProfile?.city) && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">
                    {[viewStudent.studentProfile?.address, viewStudent.studentProfile?.city]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
              )}

              {/* Guardian Info */}
              {(viewStudent.studentProfile?.guardianName || viewStudent.studentProfile?.guardianPhone) && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Guardian</p>
                    <p className="font-medium">
                      {viewStudent.studentProfile?.guardianName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Guardian Phone</p>
                    <p className="font-medium">
                      {viewStudent.studentProfile?.guardianPhone || "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Enrollments */}
              <div>
                <p className="text-sm font-medium mb-2">Enrollments</p>
                {viewStudent.enrollments?.length ? (
                  <div className="space-y-2">
                    {viewStudent.enrollments.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {e.program?.name || "No program"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.batch?.name
                              ? `${e.batch.name} (${e.batch.academicYear})`
                              : "No batch"}{" "}
                            · Semester {e.semester?.number ?? "—"}
                          </p>
                        </div>
                        {statusBadge("active")}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No enrollments</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Failed to load student details
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
