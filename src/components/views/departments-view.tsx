"use client";

import { useState } from "react";
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
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Users,
  BookOpen,
  GraduationCap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface DepartmentRecord {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  head: { id: string; name: string; email: string; avatar: string | null } | null;
  institution: { id: string; name: string; shortName: string };
  _count: {
    programs: number;
    subjects: number;
    employees: number;
  };
}

export default function DepartmentsView() {
  const { institution } = useAppStore();
  const [search, setSearch] = useState("");

  const {
    data: departmentsData,
    isLoading,
    error,
    refetch,
  } = useApiQuery<DepartmentRecord[]>(
    `/api/departments${search ? `?search=${encodeURIComponent(search)}` : ""}`
  );

  const departments = Array.isArray(departmentsData) ? departmentsData : [];

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const openAddDialog = () => {
    setEditingDept(null);
    setForm({ name: "", code: "", description: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (dept: DepartmentRecord) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      code: dept.code || "",
      description: dept.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingDept) {
        await api.put(`/api/departments/${editingDept.id}`, {
          name: form.name,
          code: form.code || null,
          description: form.description || null,
        });
        toast.success("Department updated successfully");
      } else {
        if (!institution?.id) {
          toast.error("No institution found. Please set up institution first.");
          setSubmitting(false);
          return;
        }
        await api.post("/api/departments", {
          name: form.name,
          code: form.code || null,
          description: form.description || null,
          institutionId: institution.id,
        });
        toast.success("Department created successfully");
      }
      setDialogOpen(false);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save department"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      await api.del(`/api/departments/${id}`);
      toast.success("Department deleted successfully");
      setDeletingId(null);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete department"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground">
            Manage academic departments and their structure
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingDept ? "Edit Department" : "Add Department"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Department Name *</Label>
                <Input
                  id="d-name"
                  placeholder="e.g., Computer Science"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-code">Department Code</Label>
                <Input
                  id="d-code"
                  placeholder="e.g., CSE"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-desc">Description</Label>
                <Input
                  id="d-desc"
                  placeholder="Brief description of the department"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSubmit}
                disabled={!form.name || submitting}
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                {editingDept ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search departments by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
          <button onClick={refetch} className="underline ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Department Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : departments.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <Card key={dept.id} className="relative">
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{dept.name}</CardTitle>
                    <CardDescription>
                      {dept.code
                        ? dept.code.toUpperCase()
                        : "No code"}{" "}
                      · {dept.head?.name || "No Head Assigned"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditDialog(dept)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog
                    open={deletingId === dept.id}
                    onOpenChange={(open) => !open && setDeletingId(null)}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(dept.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Department</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete{" "}
                          <strong>{dept.name}</strong>? All related programs,
                          subjects, and employee associations will be removed.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(dept.id)}
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
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Programs
                      </p>
                      <p className="text-sm font-bold">
                        {dept._count.programs}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Subjects
                      </p>
                      <p className="text-sm font-bold">
                        {dept._count.subjects}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Employees
                      </p>
                      <p className="text-sm font-bold">
                        {dept._count.employees}
                      </p>
                    </div>
                  </div>
                </div>
                {dept.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                    {dept.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              {search ? "No departments match your search" : "No departments yet"}
            </p>
            {!search && (
              <Button
                variant="outline"
                className="mt-3"
                onClick={openAddDialog}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create First Department
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Table */}
      {departments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Department Summary</CardTitle>
            <CardDescription>Overview of all departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Head</TableHead>
                    <TableHead>Programs</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-sm">
                            {dept.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dept.code ? dept.code.toUpperCase() : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dept.head?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dept._count.programs}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dept._count.subjects}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dept._count.employees}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            dept.isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                          }
                        >
                          {dept.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
