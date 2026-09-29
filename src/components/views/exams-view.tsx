"use client";

import { useState, useMemo } from "react";
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
  GraduationCap,
  Eye,
  Loader2,
  AlertTriangle,
  Trophy,
  FileSpreadsheet,
  CalendarDays,
  Target,
  Users,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExamRecord {
  id: string;
  name: string;
  examType: string;
  totalMarks: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  subjectId: string;
  subject: { id: string; name: string; code: string | null };
  createdBy: string | null;
  createdAt: string;
  _count: { results: number };
}

interface ExamDetail extends ExamRecord {
  results: ExamResultItem[];
}

interface ExamResultItem {
  id: string;
  marksObtained: number;
  grade: string | null;
  remarks: string | null;
  userId: string;
  user: { id: string; name: string; email: string; avatar: string | null };
}

interface StudentItem {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  studentProfile: { id: string; studentId: string } | null;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string | null;
}

interface BatchOption {
  id: string;
  name: string;
  academicYear: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function examStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        Completed
      </Badge>
    );
  if (s === "upcoming")
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        Upcoming
      </Badge>
    );
  if (s === "in-progress" || s === "ongoing")
    return (
      <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20">
        In Progress
      </Badge>
    );
  if (s === "cancelled")
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
        Cancelled
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20">
      {status}
    </Badge>
  );
}

function examTypeBadge(type: string) {
  const t = type.toLowerCase();
  if (t === "midterm")
    return (
      <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/20">
        Midterm
      </Badge>
    );
  if (t === "final")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        Final
      </Badge>
    );
  if (t === "quiz")
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        Quiz
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/20">
      {type}
    </Badge>
  );
}

function gradeColor(grade: string | null, totalMarks: number, obtained: number): string {
  if (!grade) return "text-muted-foreground";
  const pct = totalMarks > 0 ? (obtained / totalMarks) * 100 : 0;
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 60) return "text-teal-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExamsView() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher" || user?.role === "admin" || user?.isSuperAdmin;
  const isStudent = user?.role === "student";

  // Filters
  const [subjectId, setSubjectId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [addResultsOpen, setAddResultsOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamRecord | null>(null);
  const [selectedExamDetail, setSelectedExamDetail] = useState<ExamDetail | null>(null);

  // Create form
  const [createName, setCreateName] = useState("");
  const [createExamType, setCreateExamType] = useState("midterm");
  const [createSubjectId, setCreateSubjectId] = useState("");
  const [createTotalMarks, setCreateTotalMarks] = useState("100");
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");

  // Add results form: map of userId -> marksObtained
  const [resultMarks, setResultMarks] = useState<Record<string, string>>({});
  const [resultRemarks, setResultRemarks] = useState<Record<string, string>>({});
  const [batchIdForResults, setBatchIdForResults] = useState<string>("");

  // Queries
  const examsQuery = useApiQuery<ExamRecord[]>(
    `/api/exams${subjectId ? `?subjectId=${subjectId}` : ""}${statusFilter ? `${subjectId ? "&" : "?"}status=${statusFilter}` : ""}`
  );

  const subjectsQuery = useApiQuery<SubjectOption[]>("/api/subjects");

  const batchesQuery = useApiQuery<BatchOption[]>("/api/batches");

  const studentsQuery = useApiQuery<StudentItem[]>(
    batchIdForResults ? `/api/students?batchId=${batchIdForResults}` : null,
    { enabled: !!batchIdForResults }
  );

  // Fetch exam detail when viewing results
  const examDetailQuery = useApiQuery<ExamDetail>(
    selectedExam ? `/api/exams/${selectedExam.id}` : null,
    { enabled: resultsOpen && !!selectedExam }
  );

  // Mutations
  const createMutation = useApiMutation<
    { name: string; examType: string; subjectId: string; totalMarks: number; startDate?: string; endDate?: string; status: string },
    ExamRecord
  >({
    method: "POST",
    path: "/api/exams",
    onSuccess: () => {
      toast.success("Exam created successfully");
      setCreateOpen(false);
      resetCreateForm();
      examsQuery.refetch();
    },
    onError: (err) => toast.error(err || "Failed to create exam"),
  });

  const addResultsMutation = useApiMutation<
    { results: { userId: string; marksObtained: number; remarks?: string }[] },
    ExamResultItem[]
  >({
    method: "POST",
    onSuccess: () => {
      toast.success("Exam results added successfully");
      setAddResultsOpen(false);
      setResultMarks({});
      setResultRemarks({});
      examDetailQuery.refetch();
      examsQuery.refetch();
    },
    onError: (err) => toast.error(err || "Failed to add results"),
  });

  // Helpers
  function resetCreateForm() {
    setCreateName("");
    setCreateExamType("midterm");
    setCreateSubjectId("");
    setCreateTotalMarks("100");
    setCreateStartDate("");
    setCreateEndDate("");
  }

  const handleCreate = () => {
    if (!createName.trim() || !createSubjectId) {
      toast.error("Name and subject are required");
      return;
    }
    createMutation.mutate({
      name: createName.trim(),
      examType: createExamType,
      subjectId: createSubjectId,
      totalMarks: parseInt(createTotalMarks) || 100,
      startDate: createStartDate || undefined,
      endDate: createEndDate || undefined,
      status: "upcoming",
    });
  };

  const openResults = (exam: ExamRecord) => {
    setSelectedExam(exam);
    setResultsOpen(true);
  };

  const openAddResults = (exam: ExamRecord) => {
    setSelectedExam(exam);
    setAddResultsOpen(true);
    setResultMarks({});
    setResultRemarks({});
  };

  const handleAddResults = () => {
    if (!selectedExam) return;
    const entries = Object.entries(resultMarks);
    if (entries.length === 0) {
      toast.error("No results to submit");
      return;
    }
    const results = entries
      .filter(([, marks]) => marks !== "" && !isNaN(parseInt(marks)))
      .map(([userId, marks]) => ({
        userId,
        marksObtained: parseInt(marks),
        remarks: resultRemarks[userId] || undefined,
      }));
    if (results.length === 0) {
      toast.error("Please enter marks for at least one student");
      return;
    }
    addResultsMutation.mutateAsync(
      { results },
      `/api/exams/${selectedExam.id}/results`
    );
  };

  const subjects = subjectsQuery.data || [];
  const batches = batchesQuery.data || [];
  const exams = examsQuery.data || [];
  const studentsForBatch = useMemo(() => {
    if (!studentsQuery.data) return [];
    return studentsQuery.data.filter(
      (s) => s.role === "student" || s.studentProfile !== null
    );
  }, [studentsQuery.data]);

  // Computed stats
  const examStats = useMemo(() => {
    const total = exams.length;
    const upcoming = exams.filter((e) => e.status === "upcoming").length;
    const completed = exams.filter((e) => e.status === "completed").length;
    const totalResults = exams.reduce((acc, e) => acc + e._count.results, 0);
    return { total, upcoming, completed, totalResults };
  }, [exams]);

  const examDetail = examDetailQuery.data;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-teal-600" />
            Exams
          </h1>
          <p className="text-muted-foreground text-sm">
            {isTeacher
              ? "Create exams, manage results and grades"
              : "View your exam schedule and results"}
          </p>
        </div>
        {isTeacher && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Exam</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Exam Name</Label>
                  <Input
                    placeholder="e.g., Midterm Mathematics"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Exam Type</Label>
                    <Select value={createExamType} onValueChange={setCreateExamType}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="midterm">Midterm</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="datetime-local"
                      value={createStartDate}
                      onChange={(e) => setCreateStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="datetime-local"
                      value={createEndDate}
                      onChange={(e) => setCreateEndDate(e.target.value)}
                    />
                  </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-500/10 p-2.5">
                <GraduationCap className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Exams</p>
                <p className="text-2xl font-bold">{examStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <CalendarDays className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold text-amber-600">{examStats.upcoming}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-emerald-600">{examStats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-500/10 p-2.5">
                <BarChart3 className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Results</p>
                <p className="text-2xl font-bold">{examStats.totalResults}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {examsQuery.error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-600">{examsQuery.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Exams Table */}
      <Card>
        <CardContent className="p-0">
          {examsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <GraduationCap className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No exams found</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-center">Total Marks</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Results</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-teal-500/5 border-teal-500/20 text-teal-600">
                          {exam.subject.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{examTypeBadge(exam.examType)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Target className="h-3.5 w-3.5 text-muted-foreground" />
                          {exam.totalMarks}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {exam.startDate
                            ? format(new Date(exam.startDate), "MMM dd, yyyy")
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{examStatusBadge(exam.status)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{exam._count.results}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openResults(exam)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isTeacher && (
                            <Button variant="ghost" size="sm" onClick={() => openAddResults(exam)}>
                              <FileSpreadsheet className="h-4 w-4 text-amber-500" />
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

      {/* ── View Results Dialog ───────────────────────────────────────── */}
      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Results — {selectedExam?.name}
            </DialogTitle>
            <CardDescription>
              {selectedExam?.subject.name} | Total: {selectedExam?.totalMarks} marks
            </CardDescription>
          </DialogHeader>

          {examDetailQuery.isLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : examDetailQuery.error ? (
            <div className="flex items-center gap-3 py-6 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">{examDetailQuery.error}</p>
            </div>
          ) : examDetail && examDetail.results && examDetail.results.length > 0 ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border bg-emerald-500/5 p-3 text-center">
                  <p className="text-xs text-emerald-600 mb-0.5">Highest</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {Math.max(...examDetail.results.map((r) => r.marksObtained))}
                  </p>
                </div>
                <div className="rounded-lg border bg-amber-500/5 p-3 text-center">
                  <p className="text-xs text-amber-600 mb-0.5">Average</p>
                  <p className="text-lg font-bold text-amber-600">
                    {Math.round(
                      examDetail.results.reduce((sum, r) => sum + r.marksObtained, 0) /
                        examDetail.results.length
                    )}
                  </p>
                </div>
                <div className="rounded-lg border bg-teal-500/5 p-3 text-center">
                  <p className="text-xs text-teal-600 mb-0.5">Passed</p>
                  <p className="text-lg font-bold text-teal-600">
                    {examDetail.results.filter((r) => {
                      const pct = examDetail.totalMarks > 0
                        ? (r.marksObtained / examDetail.totalMarks) * 100
                        : 0;
                      return pct >= 50;
                    }).length}
                    /{examDetail.results.length}
                  </p>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-center">Marks</TableHead>
                      <TableHead className="text-center">Percentage</TableHead>
                      <TableHead className="text-center">Grade</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examDetail.results.map((result, idx) => {
                      const pct = examDetail.totalMarks > 0
                        ? Math.round((result.marksObtained / examDetail.totalMarks) * 100)
                        : 0;
                      return (
                        <TableRow key={result.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{result.user.name}</TableCell>
                          <TableCell className={`text-center font-semibold ${gradeColor(result.grade, examDetail.totalMarks, result.marksObtained)}`}>
                            {result.marksObtained}/{examDetail.totalMarks}
                          </TableCell>
                          <TableCell className={`text-center ${gradeColor(result.grade, examDetail.totalMarks, result.marksObtained)}`}>
                            {pct}%
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                pct >= 80
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : pct >= 60
                                  ? "bg-teal-500/10 text-teal-600 border-teal-500/20"
                                  : pct >= 50
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : "bg-red-500/10 text-red-600 border-red-500/20"
                              }
                            >
                              {result.grade || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {result.remarks || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trophy className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No results recorded yet</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Results Dialog (Teacher) ──────────────────────────────── */}
      <Dialog open={addResultsOpen} onOpenChange={setAddResultsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Results — {selectedExam?.name}</DialogTitle>
            <CardDescription>
              Total: {selectedExam?.totalMarks} marks | {selectedExam?.subject.name}
            </CardDescription>
          </DialogHeader>

          {/* Batch select for students */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Batch</Label>
              <Select value={batchIdForResults} onValueChange={(val) => { setBatchIdForResults(val); setResultMarks({}); setResultRemarks({}); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select batch to load students" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.academicYear})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {studentsQuery.isLoading && batchIdForResults ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-md" />
                ))}
              </div>
            ) : studentsForBatch.length > 0 ? (
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="w-[140px]">Marks</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsForBatch.map((student, idx) => (
                      <TableRow key={student.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={selectedExam?.totalMarks || 100}
                            placeholder="0"
                            value={resultMarks[student.id] || ""}
                            onChange={(e) =>
                              setResultMarks((prev) => ({
                                ...prev,
                                [student.id]: e.target.value,
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Optional"
                            value={resultRemarks[student.id] || ""}
                            onChange={(e) =>
                              setResultRemarks((prev) => ({
                                ...prev,
                                [student.id]: e.target.value,
                              }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              batchIdForResults && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No students found in this batch</p>
                </div>
              )
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddResultsOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddResults}
              disabled={addResultsMutation.isLoading || Object.keys(resultMarks).length === 0}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {addResultsMutation.isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Save Results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
