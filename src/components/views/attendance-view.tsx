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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck,
  CalendarIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
  userId: string;
  user: { id: string; name: string; email: string; avatar: string | null };
  subject: { id: string; name: string; code: string } | null;
  markedBy: string | null;
}

interface StudentItem {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  studentProfile: { id: string; studentId: string } | null;
  enrollments: {
    id: string;
    batch: { id: string; name: string } | null;
  }[];
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

interface BatchAttendanceOverview {
  batchName: string;
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateParam(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "present")
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
        Present
      </Badge>
    );
  if (s === "absent")
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
        Absent
      </Badge>
    );
  if (s === "late")
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
        Late
      </Badge>
    );
  return <Badge variant="outline">{status}</Badge>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AttendanceView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.isSuperAdmin;
  const isTeacher = user?.role === "teacher";

  // Filters
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [subjectId, setSubjectId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"mark" | "overview">(
    isAdmin ? "overview" : "mark"
  );

  // Attendance statuses per student for marking
  const [studentStatuses, setStudentStatuses] = useState<Record<string, string>>({});

  // Fetch attendance records for selected date/filters
  const attendanceQuery = useApiQuery<AttendanceRecord[]>(
    `/api/attendance?date=${formatDateParam(selectedDate)}${subjectId ? `&subjectId=${subjectId}` : ""}${batchId ? `&batchId=${batchId}` : ""}`,
    { enabled: activeTab === "mark" && !!selectedDate }
  );

  // Fetch subjects
  const subjectsQuery = useApiQuery<SubjectOption[]>("/api/subjects");

  // Fetch batches
  const batchesQuery = useApiQuery<BatchOption[]>("/api/batches");

  // Fetch students for the selected batch
  const studentsQuery = useApiQuery<StudentItem[]>(
    batchId ? `/api/students?batchId=${batchId}` : null,
    { enabled: !!batchId }
  );

  // Fetch all attendance for admin overview
  const allAttendanceQuery = useApiQuery<AttendanceRecord[]>(
    "/api/attendance",
    { enabled: activeTab === "overview" }
  );

  // POST attendance mutation
  const submitAttendance = useApiMutation<
    { date: string; subjectId: string; batchId: string; records: { userId: string; status: string }[] },
    { message: string; count: number }
  >({
    method: "POST",
    path: "/api/attendance",
    onSuccess: () => {
      toast.success("Attendance marked successfully");
      attendanceQuery.refetch();
      setStudentStatuses({});
    },
    onError: (err) => toast.error(err || "Failed to mark attendance"),
  });

  // Computed: students to mark attendance for
  const studentsForBatch = useMemo(() => {
    if (!studentsQuery.data) return [];
    return studentsQuery.data.filter(
      (s) => s.role === "student" || s.studentProfile !== null
    );
  }, [studentsQuery.data]);

  // Computed: existing attendance map
  const existingAttendanceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (attendanceQuery.data) {
      for (const rec of attendanceQuery.data) {
        map.set(rec.userId, rec.status);
      }
    }
    return map;
  }, [attendanceQuery.data]);

  // Computed: overview stats per batch
  const batchOverview = useMemo((): BatchAttendanceOverview[] => {
    if (!allAttendanceQuery.data || !batchesQuery.data) return [];
    const batchMap = new Map<string, { present: number; absent: number; late: number; total: number }>();
    for (const rec of allAttendanceQuery.data) {
      const key = rec.subject?.name || "Unknown";
      if (!batchMap.has(key)) {
        batchMap.set(key, { present: 0, absent: 0, late: 0, total: 0 });
      }
      const entry = batchMap.get(key)!;
      entry.total++;
      if (rec.status.toLowerCase() === "present") entry.present++;
      else if (rec.status.toLowerCase() === "absent") entry.absent++;
      else if (rec.status.toLowerCase() === "late") entry.late++;
    }

    // Group by batch names from batches data
    const result: BatchAttendanceOverview[] = batchesQuery.data.map((b) => {
      const filtered = allAttendanceQuery.data || [];
      const totalRecords = filtered.length;
      const present = filtered.filter((r) => r.status.toLowerCase() === "present").length;
      const absent = filtered.filter((r) => r.status.toLowerCase() === "absent").length;
      const late = filtered.filter((r) => r.status.toLowerCase() === "late").length;
      return {
        batchName: b.name,
        totalRecords,
        present,
        absent,
        late,
        rate: totalRecords > 0 ? Math.round((present / totalRecords) * 100) : 0,
      };
    });
    return result;
  }, [allAttendanceQuery.data, batchesQuery.data]);

  // Computed: summary stats for selected date
  const daySummary = useMemo(() => {
    const records = attendanceQuery.data || [];
    const total = records.length;
    const present = records.filter((r) => r.status.toLowerCase() === "present").length;
    const absent = records.filter((r) => r.status.toLowerCase() === "absent").length;
    const late = records.filter((r) => r.status.toLowerCase() === "late").length;
    return { total, present, absent, late };
  }, [attendanceQuery.data]);

  // Handlers
  const handleStatusChange = (studentId: string, status: string) => {
    setStudentStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSubmitAttendance = () => {
    if (!subjectId || !batchId) {
      toast.error("Please select a subject and batch first");
      return;
    }
    const records = Object.entries(studentStatuses).map(([userId, status]) => ({
      userId,
      status,
    }));
    if (records.length === 0) {
      toast.error("No attendance records to submit");
      return;
    }
    submitAttendance.mutate({
      date: formatDateParam(selectedDate),
      subjectId,
      batchId,
      records,
    });
  };

  const subjects = subjectsQuery.data || [];
  const batches = batchesQuery.data || [];
  const filteredSubjects = isTeacher && !isAdmin ? subjects : subjects;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-teal-600" />
            Attendance
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? "Manage and overview attendance across batches"
              : "Mark and track student attendance"}
          </p>
        </div>
      </div>

      {/* Tab Switch for Admin */}
      {isAdmin && (
        <div className="flex gap-2">
          <Button
            variant={activeTab === "overview" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("overview")}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Overview
          </Button>
          <Button
            variant={activeTab === "mark" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("mark")}
          >
            <ClipboardCheck className="h-4 w-4 mr-1" />
            Mark Attendance
          </Button>
        </div>
      )}

      {/* ── OVERVIEW (Admin) ─────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {allAttendanceQuery.isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          )}

          {allAttendanceQuery.error && (
            <Card className="border-red-200">
              <CardContent className="flex items-center gap-3 p-6">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-600">{allAttendanceQuery.error}</p>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-teal-500/10 p-2.5">
                    <Users className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Records</p>
                    <p className="text-2xl font-bold">{daySummary.total}</p>
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
                    <p className="text-sm text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold text-emerald-600">{daySummary.present}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-500/10 p-2.5">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-red-600">{daySummary.absent}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2.5">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Late</p>
                    <p className="text-2xl font-bold text-amber-600">{daySummary.late}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Batch Overview Table */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance by Subject</CardTitle>
              <CardDescription>Overview of attendance rates across subjects</CardDescription>
            </CardHeader>
            <CardContent>
              {allAttendanceQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-md" />
                  ))}
                </div>
              ) : allAttendanceQuery.data && allAttendanceQuery.data.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Late</TableHead>
                        <TableHead className="text-center">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Group by subject
                        const grouped = new Map<string, AttendanceRecord[]>();
                        for (const rec of allAttendanceQuery.data) {
                          const key = rec.subject?.name || "Unknown";
                          if (!grouped.has(key)) grouped.set(key, []);
                          grouped.get(key)!.push(rec);
                        }
                        return Array.from(grouped.entries()).map(([subjectName, records]) => {
                          const total = records.length;
                          const present = records.filter((r) => r.status.toLowerCase() === "present").length;
                          const absent = records.filter((r) => r.status.toLowerCase() === "absent").length;
                          const late = records.filter((r) => r.status.toLowerCase() === "late").length;
                          const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                          return (
                            <TableRow key={subjectName}>
                              <TableCell className="font-medium">{subjectName}</TableCell>
                              <TableCell className="text-center">{total}</TableCell>
                              <TableCell className="text-center text-emerald-600">{present}</TableCell>
                              <TableCell className="text-center text-red-600">{absent}</TableCell>
                              <TableCell className="text-center text-amber-600">{late}</TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant="outline"
                                  className={
                                    rate >= 80
                                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      : rate >= 60
                                      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                      : "bg-red-500/10 text-red-600 border-red-500/20"
                                  }
                                >
                                  {rate}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardCheck className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">No attendance records found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MARK ATTENDANCE ──────────────────────────────────────────── */}
      {activeTab === "mark" && (
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Date picker */}
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => d && setSelectedDate(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Subject select */}
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.code ? ` (${s.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Batch select */}
                <div className="space-y-2">
                  <Label>Batch</Label>
                  <Select value={batchId} onValueChange={(val) => { setBatchId(val); setStudentStatuses({}); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select batch" />
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
              </div>
            </CardContent>
          </Card>

          {/* Day Summary */}
          {daySummary.total > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{daySummary.total}</p>
              </div>
              <div className="rounded-lg border bg-emerald-500/5 px-3 py-2 text-center">
                <p className="text-xs text-emerald-600">Present</p>
                <p className="text-lg font-bold text-emerald-600">
                  {daySummary.total > 0 ? Math.round((daySummary.present / daySummary.total) * 100) : 0}%
                </p>
              </div>
              <div className="rounded-lg border bg-red-500/5 px-3 py-2 text-center">
                <p className="text-xs text-red-600">Absent</p>
                <p className="text-lg font-bold text-red-600">
                  {daySummary.total > 0 ? Math.round((daySummary.absent / daySummary.total) * 100) : 0}%
                </p>
              </div>
              <div className="rounded-lg border bg-amber-500/5 px-3 py-2 text-center">
                <p className="text-xs text-amber-600">Late</p>
                <p className="text-lg font-bold text-amber-600">
                  {daySummary.total > 0 ? Math.round((daySummary.late / daySummary.total) * 100) : 0}%
                </p>
              </div>
            </div>
          )}

          {/* Students Table for Marking */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Mark Attendance</CardTitle>
                <CardDescription>
                  {studentsForBatch.length > 0
                    ? `${studentsForBatch.length} students in selected batch`
                    : "Select a batch to see students"}
                </CardDescription>
              </div>
              {studentsForBatch.length > 0 && (subjectId || batchId) && (
                <Button
                  onClick={handleSubmitAttendance}
                  disabled={submitAttendance.isLoading || Object.keys(studentStatuses).length === 0}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {submitAttendance.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Submit Attendance
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!batchId ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">Select a batch to load students</p>
                </div>
              ) : studentsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-md" />
                  ))}
                </div>
              ) : studentsForBatch.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">No students found in this batch</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead className="w-[180px] text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsForBatch.map((student, idx) => {
                        const currentStatus =
                          studentStatuses[student.id] ||
                          existingAttendanceMap.get(student.id) ||
                          "present";
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {student.studentProfile?.studentId || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center">
                                <Select
                                  value={currentStatus}
                                  onValueChange={(val) => handleStatusChange(student.id, val)}
                                >
                                  <SelectTrigger className={`w-[160px] ${
                                    currentStatus === "present"
                                      ? "border-emerald-500/30 bg-emerald-500/5"
                                      : currentStatus === "absent"
                                      ? "border-red-500/30 bg-red-500/5"
                                      : "border-amber-500/30 bg-amber-500/5"
                                  }`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="present">
                                      <span className="text-emerald-600">✓ Present</span>
                                    </SelectItem>
                                    <SelectItem value="absent">
                                      <span className="text-red-600">✗ Absent</span>
                                    </SelectItem>
                                    <SelectItem value="late">
                                      <span className="text-amber-600">◉ Late</span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Existing Records Table */}
          {attendanceQuery.data && attendanceQuery.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Existing Records for {format(selectedDate, "PPP")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Marked By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceQuery.data.map((rec) => (
                        <TableRow key={rec.id}>
                          <TableCell className="font-medium">{rec.user.name}</TableCell>
                          <TableCell>{rec.subject?.name || "—"}</TableCell>
                          <TableCell className="text-center">{statusBadge(rec.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {rec.markedBy || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {attendanceQuery.error && (
            <Card className="border-red-200">
              <CardContent className="flex items-center gap-3 p-6">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-600">{attendanceQuery.error}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
