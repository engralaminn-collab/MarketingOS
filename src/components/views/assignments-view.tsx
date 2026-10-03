"use client";

import { useState } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import { api } from "@/lib/api-client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  FileText,
  Eye,
  Send,
  Star,
  Loader2,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Target,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AssignmentRecord {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  totalMarks: number;
  status: string;
  subjectId: string;
  subject: { id: string; name: string; code: string | null };
  assignedBy: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { submissions: number };
}

interface SubmissionRecord {
  id: string;
  content: string | null;
  fileName: string | null;
  fileUrl: string | null;
  marks: number | null;
  feedback: string | null;
  status: string;
  submittedAt: string;
  gradedAt: string | null;
  userId: string;
  user: { id: string; name: string; email: string; avatar: string | null };
}

interface SubjectOption {
  id: string;
  name: string;
  code: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assignmentStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "active" || s === "published")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        Active
      </Badge>
    );
  if (s === "completed" || s === "graded")
    return (
      <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20">
        Completed
      </Badge>
    );
  if (s === "overdue" || s === "closed")
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

function submissionStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "graded")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        Graded
      </Badge>
    );
  if (s === "submitted")
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        Submitted
      </Badge>
    );
  if (s === "late")
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
        Late
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20">
      {status}
    </Badge>
  );
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AssignmentsView() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher" || user?.role === "admin" || user?.isSuperAdmin;
  const isStudent = user?.role === "student";

  // Filters
  const [subjectId, setSubjectId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentRecord | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);

  // Create form
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSubjectId, setCreateSubjectId] = useState("");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createTotalMarks, setCreateTotalMarks] = useState("100");

  // Submit form
  const [submitContent, setSubmitContent] = useState("");
  const [submitFileName, setSubmitFileName] = useState("");
  const [submitFileUrl, setSubmitFileUrl] = useState("");

  // Grade form
  const [gradeMarks, setGradeMarks] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");

  // Queries
  const assignmentsQuery = useApiQuery<AssignmentRecord[]>(
    `/api/assignments${subjectId ? `?subjectId=${subjectId}` : ""}${statusFilter ? `${subjectId ? "&" : "?"}status=${statusFilter}` : ""}`
  );

  const subjectsQuery = useApiQuery<SubjectOption[]>("/api/subjects");

  const submissionsQuery = useApiQuery<SubmissionRecord[]>(
    selectedAssignment ? `/api/assignments/${selectedAssignment.id}/submissions` : null,
    { enabled: submissionsOpen && !!selectedAssignment }
  );

  // Mutations
  const createMutation = useApiMutation<
    { title: string; description?: string; subjectId: string; dueDate?: string; totalMarks: number; status: string },
    AssignmentRecord
  >({
    method: "POST",
    path: "/api/assignments",
    onSuccess: () => {
      toast.success("Assignment created successfully");
      setCreateOpen(false);
      resetCreateForm();
      assignmentsQuery.refetch();
    },
    onError: (err) => toast.error(err || "Failed to create assignment"),
  });

  const submitMutation = useApiMutation<
    { content: string; fileName?: string; fileUrl?: string },
    SubmissionRecord
  >({
    method: "POST",
    onSuccess: () => {
      toast.success("Assignment submitted successfully");
      setSubmitOpen(false);
      resetSubmitForm();
      assignmentsQuery.refetch();
      if (selectedAssignment) {
        submissionsQuery.refetch();
      }
    },
    onError: (err) => toast.error(err || "Failed to submit assignment"),
  });

  const gradeMutation = useApiMutation<
    { marks: number; feedback: string },
    SubmissionRecord
  >({
    method: "PATCH",
    onSuccess: () => {
      toast.success("Submission graded successfully");
      setGradeOpen(false);
      resetGradeForm();
      submissionsQuery.refetch();
    },
    onError: (err) => toast.error(err || "Failed to grade submission"),
  });

  // Helpers
  function resetCreateForm() {
    setCreateTitle("");
    setCreateDescription("");
    setCreateSubjectId("");
    setCreateDueDate("");
    setCreateTotalMarks("100");
  }

  function resetSubmitForm() {
    setSubmitContent("");
    setSubmitFileName("");
    setSubmitFileUrl("");
  }

  function resetGradeForm() {
    setGradeMarks("");
    setGradeFeedback("");
  }

  const handleCreate = () => {
    if (!createTitle.trim() || !createSubjectId) {
      toast.error("Title and subject are required");
      return;
    }
    createMutation.mutate({
      title: createTitle.trim(),
      description: createDescription.trim() || undefined,
      subjectId: createSubjectId,
      dueDate: createDueDate || undefined,
      totalMarks: parseInt(createTotalMarks) || 100,
      status: "active",
    });
  };

  const handleSubmitAssignment = () => {
    if (!selectedAssignment) return;
    if (!submitContent.trim()) {
      toast.error("Content is required");
      return;
    }
    submitMutation.mutateAsync(
      {
        content: submitContent.trim(),
        fileName: submitFileName.trim() || undefined,
        fileUrl: submitFileUrl.trim() || undefined,
      },
      `/api/assignments/${selectedAssignment.id}/submissions`
    );
  };

  const handleGrade = () => {
    if (!selectedSubmission || !selectedAssignment) return;
    const marks = parseInt(gradeMarks);
    if (isNaN(marks)) {
      toast.error("Please enter valid marks");
      return;
    }
    gradeMutation.mutateAsync(
      { marks, feedback: gradeFeedback.trim() },
      `/api/assignments/${selectedAssignment.id}/submissions/${selectedSubmission.id}`
    );
  };

  const openSubmissions = (assignment: AssignmentRecord) => {
    setSelectedAssignment(assignment);
    setSubmissionsOpen(true);
  };

  const openSubmitDialog = (assignment: AssignmentRecord) => {
    setSelectedAssignment(assignment);
    setSubmitOpen(true);
  };

  const openGradeDialog = (submission: SubmissionRecord) => {
    setSelectedSubmission(submission);
    setGradeMarks(submission.marks?.toString() || "");
    setGradeFeedback(submission.feedback || "");
    setGradeOpen(true);
  };

  const subjects = subjectsQuery.data || [];
  const assignments = assignmentsQuery.data || [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-teal-600" />
            Assignments
          </h1>
          <p className="text-muted-foreground text-sm">
            {isTeacher ? "Create and manage assignments, grade submissions" : "View and submit your assignments"}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="Assignment title"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Assignment description"
                    rows={3}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={createSubjectId} onValueChange={setCreateSubjectId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}{s.code ? ` (${s.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Marks</Label>
                    <Input
                      type="number"
                      value={createTotalMarks}
                      onChange={(e) => setCreateTotalMarks(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isLoading}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {createMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.code ? ` (${s.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {assignmentsQuery.error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-600">{assignmentsQuery.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Assignments Table */}
      <Card>
        <CardContent className="p-0">
          {assignmentsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No assignments found</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-center">Submissions</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{assignment.title}</p>
                            {assignment.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                {assignment.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-teal-500/5 border-teal-500/20 text-teal-600">
                          {assignment.subject.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          {assignment.dueDate
                            ? format(new Date(assignment.dueDate), "MMM dd, yyyy")
                            : "—"}
                          {isOverdue(assignment.dueDate) && assignment.status === "active" && (
                            <Badge variant="outline" className="ml-1 bg-red-500/10 text-red-600 border-red-500/20 text-[10px] px-1 py-0">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Target className="h-3.5 w-3.5 text-muted-foreground" />
                          {assignment.totalMarks}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{assignment._count.submissions}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {assignmentStatusBadge(assignment.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isTeacher && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSubmissions(assignment)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {isStudent && assignment.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openSubmitDialog(assignment)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* ── View Submissions Dialog (Teacher) ────────────────────────── */}
      <Dialog open={submissionsOpen} onOpenChange={setSubmissionsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submissions — {selectedAssignment?.title}</DialogTitle>
          </DialogHeader>
          {submissionsQuery.isLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : submissionsQuery.error ? (
            <div className="flex items-center gap-3 py-6 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">{submissionsQuery.error}</p>
            </div>
          ) : submissionsQuery.data && submissionsQuery.data.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissionsQuery.data.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(sub.submittedAt), "MMM dd, HH:mm")}
                      </TableCell>
                      <TableCell className="text-center">
                        {submissionStatusBadge(sub.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {sub.marks !== null ? (
                          <span className="font-semibold text-emerald-600">{sub.marks}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openGradeDialog(sub)}>
                          <Star className="h-4 w-4 text-amber-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No submissions yet</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Submit Assignment Dialog (Student) ────────────────────────── */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Submitting for: <strong>{selectedAssignment?.title}</strong>
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Content / Answer</Label>
              <Textarea
                placeholder="Write your answer or content here..."
                rows={5}
                value={submitContent}
                onChange={(e) => setSubmitContent(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>File Name (optional)</Label>
                <Input
                  placeholder="document.pdf"
                  value={submitFileName}
                  onChange={(e) => setSubmitFileName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>File URL (optional)</Label>
                <Input
                  placeholder="https://..."
                  value={submitFileUrl}
                  onChange={(e) => setSubmitFileUrl(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitAssignment}
              disabled={submitMutation.isLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {submitMutation.isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Grade Submission Dialog (Teacher) ────────────────────────── */}
      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Student: <strong>{selectedSubmission?.user.name}</strong>
            <br />
            Total Marks: <strong>{selectedAssignment?.totalMarks}</strong>
          </p>
          <div className="space-y-4 py-2">
            {selectedSubmission?.content && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Submission Content:</p>
                <p className="text-sm whitespace-pre-wrap">{selectedSubmission.content}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marks Obtained</Label>
                <Input
                  type="number"
                  min={0}
                  max={selectedAssignment?.totalMarks || 100}
                  placeholder="0"
                  value={gradeMarks}
                  onChange={(e) => setGradeMarks(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Feedback</Label>
              <Textarea
                placeholder="Add feedback for the student..."
                rows={3}
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGrade}
              disabled={gradeMutation.isLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {gradeMutation.isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Save Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
