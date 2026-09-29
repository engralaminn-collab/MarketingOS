"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
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
  Pencil,
  Trash2,
  BookOpen,
  GraduationCap,
  Calendar,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface ProgramRecord {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  duration: number;
  durationUnit: string;
  totalCredits: number;
  isActive: boolean;
  createdAt: string;
  department: { id: string; name: string; code: string } | null;
  institution: { id: string; name: string; shortName: string };
  _count: {
    batches: number;
    enrollments: number;
    feeStructures: number;
  };
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string | null;
}

export default function ProgramsView() {
  const { institution } = useAppStore();
  const [departmentId, setDepartmentId] = useState("");

  const {
    data: programsData,
    isLoading,
    error,
    refetch,
  } = useApiQuery<ProgramRecord[]>(
    `/api/programs${departmentId ? `?departmentId=${departmentId}` : ""}`
  );

  const { data: departments } = useApiQuery<DepartmentOption[]>(
    "/api/departments"
  );

  const programs = Array.isArray(programsData) ? programsData : [];

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProg, setEditingProg] = useState<ProgramRecord | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    duration: "4",
    durationUnit: "years",
    totalCredits: "0",
    departmentId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const openAddDialog = () => {
    setEditingProg(null);
    setForm({
      name: "",
      code: "",
      description: "",
      duration: "4",
      durationUnit: "years",
      totalCredits: "0",
      departmentId: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (prog: ProgramRecord) => {
    setEditingProg(prog);
    setForm({
      name: prog.name,
      code: prog.code || "",
      description: prog.description || "",
      duration: String(prog.duration),
      durationUnit: prog.durationUnit,
      totalCredits: String(prog.totalCredits),
      departmentId: prog.department?.id || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        duration: parseInt(form.duration, 10) || 4,
        durationUnit: form.durationUnit,
        totalCredits: parseInt(form.totalCredits, 10) || 0,
        departmentId: form.departmentId || null,
      };

      if (editingProg) {
        await api.put(`/api/programs/${editingProg.id}`, payload);
        toast.success("Program updated successfully");
      } else {
        if (!institution?.id) {
          toast.error("No institution found. Please set up institution first.");
          setSubmitting(false);
          return;
        }
        await api.post("/api/programs", {
          ...payload,
          institutionId: institution.id,
        });
        toast.success("Program created successfully");
      }
      setDialogOpen(false);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save program"
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
      await api.del(`/api/programs/${id}`);
      toast.success("Program deleted successfully");
      setDeletingId(null);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete program"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">
            Manage academic programs and their configurations
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Add Program
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingProg ? "Edit Program" : "Add Program"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Program Name *</Label>
                  <Input
                    id="p-name"
                    placeholder="e.g., B.Sc. in Computer Science"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-code">Program Code</Label>
                  <Input
                    id="p-code"
                    placeholder="e.g., BSCS"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="uppercase"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-dept">Department</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(v) =>
                    setForm({ ...form, departmentId: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Department</SelectItem>
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
                <Label htmlFor="p-desc">Description</Label>
                <Input
                  id="p-desc"
                  placeholder="Brief description of the program"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-duration">Duration</Label>
                  <Input
                    id="p-duration"
                    type="number"
                    placeholder="4"
                    value={form.duration}
                    onChange={(e) =>
                      setForm({ ...form, duration: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration Unit</Label>
                  <Select
                    value={form.durationUnit}
                    onValueChange={(v) =>
                      setForm({ ...form, durationUnit: v })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="years">Years</SelectItem>
                      <SelectItem value="semesters">Semesters</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-credits">Total Credits</Label>
                  <Input
                    id="p-credits"
                    type="number"
                    placeholder="120"
                    value={form.totalCredits}
                    onChange={(e) =>
                      setForm({ ...form, totalCredits: e.target.value })
                    }
                  />
                </div>
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
                {editingProg ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Department Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={departmentId}
              onValueChange={(v) =>
                setDepartmentId(v === "__all__" ? "" : v)
              }
            >
              <SelectTrigger className="w-full sm:w-[280px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
          <button onClick={refetch} className="underline ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Programs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Program Records</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading..."
              : `${programs.length} program${programs.length !== 1 ? "s" : ""} found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32 flex-1" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Batches</TableHead>
                    <TableHead>Enrollments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.map((prog) => (
                    <TableRow key={prog.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                            <GraduationCap className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <span className="font-medium text-sm">
                              {prog.name}
                            </span>
                            {prog.description && (
                              <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                                {prog.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {prog.code ? prog.code.toUpperCase() : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {prog.department
                          ? `${prog.department.code ? prog.department.code + " - " : ""}${prog.department.name}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {prog.duration} {prog.durationUnit}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {prog.totalCredits}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          {prog._count.batches}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {prog._count.enrollments}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            prog.isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                          }
                        >
                          {prog.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(prog)}
                            title="Edit program"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog
                            open={deletingId === prog.id}
                            onOpenChange={(open) => !open && setDeletingId(null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingId(prog.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Program</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete{" "}
                                  <strong>{prog.name}</strong>? All associated
                                  batches, enrollments, and fee structures will be
                                  removed. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(prog.id)}
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
        </CardContent>
      </Card>

      {/* Summary Cards when no filter */}
      {!departmentId && programs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Programs
                </p>
                <p className="text-xl font-bold">{programs.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
                <Calendar className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Batches
                </p>
                <p className="text-xl font-bold">
                  {programs.reduce((s, p) => s + p._count.batches, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <BookOpen className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Enrollments
                </p>
                <p className="text-xl font-bold">
                  {programs.reduce((s, p) => s + p._count.enrollments, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Active Programs
                </p>
                <p className="text-xl font-bold">
                  {programs.filter((p) => p.isActive).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
