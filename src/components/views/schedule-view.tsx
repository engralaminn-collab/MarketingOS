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
  CalendarClock,
  Plus,
  Loader2,
  AlertTriangle,
  Clock,
  BookOpen,
  MapPin,
  User,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScheduleRecord {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
  batchId: string | null;
  batch: { id: string; name: string; academicYear: string } | null;
  subjectId: string | null;
  subject: { id: string; name: string; code: string | null } | null;
  teacherId: string | null;
  teacher: { id: string; name: string; email: string; avatar: string | null } | null;
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

interface UserOption {
  id: string;
  name: string;
  role: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const TIME_SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
];

// Color palette for subjects (no indigo/blue)
const SUBJECT_COLORS = [
  { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/20" },
  { bg: "bg-teal-500/10", text: "text-teal-700 dark:text-teal-400", border: "border-teal-500/20" },
  { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-500/20" },
  { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-500/20" },
  { bg: "bg-cyan-500/10", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-500/20" },
  { bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-400", border: "border-orange-500/20" },
  { bg: "bg-lime-500/10", text: "text-lime-700 dark:text-lime-400", border: "border-lime-500/20" },
  { bg: "bg-fuchsia-500/10", text: "text-fuchsia-700 dark:text-fuchsia-400", border: "border-fuchsia-500/20" },
  { bg: "bg-violet-500/10", text: "text-violet-700 dark:text-violet-400", border: "border-violet-500/20" },
  { bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-500/20" },
];

// Map subjects to consistent colors
const subjectColorMap = new Map<string, typeof SUBJECT_COLORS[0]>();
let colorIndex = 0;

function getSubjectColor(subjectName: string | null): typeof SUBJECT_COLORS[0] {
  if (!subjectName) return SUBJECT_COLORS[0];
  if (!subjectColorMap.has(subjectName)) {
    subjectColorMap.set(subjectName, SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length]);
    colorIndex++;
  }
  return subjectColorMap.get(subjectName)!;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScheduleView() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher" || user?.role === "admin" || user?.isSuperAdmin;
  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "admin" || user?.isSuperAdmin;

  // Filters
  const [batchId, setBatchId] = useState<string>("");

  // Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createDay, setCreateDay] = useState("");
  const [createStartTime, setCreateStartTime] = useState("");
  const [createEndTime, setCreateEndTime] = useState("");
  const [createRoom, setCreateRoom] = useState("");
  const [createBatchId, setCreateBatchId] = useState("");
  const [createSubjectId, setCreateSubjectId] = useState("");
  const [createTeacherId, setCreateTeacherId] = useState("");

  // View mode: grid or list
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Queries
  const scheduleQuery = useApiQuery<ScheduleRecord[]>(
    `/api/schedule${batchId ? `?batchId=${batchId}` : ""}${isTeacher && !isAdmin && !batchId ? `?teacherId=${user?.id}` : ""}`
  );

  const subjectsQuery = useApiQuery<SubjectOption[]>("/api/subjects");

  const batchesQuery = useApiQuery<BatchOption[]>("/api/batches");

  const teachersQuery = useApiQuery<UserOption[]>("/api/users?role=teacher");

  // Mutations
  const createMutation = useApiMutation<
    {
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      room?: string;
      batchId?: string;
      subjectId?: string;
      teacherId?: string;
    },
    ScheduleRecord
  >({
    method: "POST",
    path: "/api/schedule",
    onSuccess: () => {
      toast.success("Schedule created successfully");
      setCreateOpen(false);
      resetCreateForm();
      scheduleQuery.refetch();
    },
    onError: (err) => toast.error(err || "Failed to create schedule"),
  });

  // Helpers
  function resetCreateForm() {
    setCreateDay("");
    setCreateStartTime("");
    setCreateEndTime("");
    setCreateRoom("");
    setCreateBatchId("");
    setCreateSubjectId("");
    setCreateTeacherId("");
  }

  const handleCreate = () => {
    if (!createDay || !createStartTime || !createEndTime) {
      toast.error("Day, start time, and end time are required");
      return;
    }
    createMutation.mutate({
      dayOfWeek: createDay,
      startTime: createStartTime,
      endTime: createEndTime,
      room: createRoom || undefined,
      batchId: createBatchId || undefined,
      subjectId: createSubjectId || undefined,
      teacherId: createTeacherId || undefined,
    });
  };

  const subjects = subjectsQuery.data || [];
  const batches = batchesQuery.data || [];
  const teachers = teachersQuery.data || [];
  const schedules = scheduleQuery.data || [];

  // Build grid data: Map<dayOfWeek, Map<startTimeSlot, ScheduleRecord[]>>
  const gridData = useMemo(() => {
    const grid = new Map<string, Map<string, ScheduleRecord[]>>();

    // Initialize all days and slots
    for (const day of DAYS_OF_WEEK) {
      const dayMap = new Map<string, ScheduleRecord[]>();
      for (const slot of TIME_SLOTS) {
        dayMap.set(slot, []);
      }
      grid.set(day, dayMap);
    }

    // Populate with schedule data
    for (const record of schedules) {
      if (!grid.has(record.dayOfWeek)) continue;
      const dayMap = grid.get(record.dayOfWeek)!;
      if (dayMap.has(record.startTime)) {
        dayMap.get(record.startTime)!.push(record);
      }
    }

    return grid;
  }, [schedules]);

  // Computed stats
  const scheduleStats = useMemo(() => {
    const totalClasses = schedules.length;
    const uniqueSubjects = new Set(schedules.map((s) => s.subject?.name).filter(Boolean)).size;
    const uniqueRooms = new Set(schedules.map((s) => s.room).filter(Boolean)).size;
    return { totalClasses, uniqueSubjects, uniqueRooms };
  }, [schedules]);

  // Filter out time slots that have no classes (for cleaner grid display)
  const activeTimeSlots = useMemo(() => {
    const active = new Set<string>();
    for (const record of schedules) {
      active.add(record.startTime);
      // Also add surrounding 30-min markers
      const idx = TIME_SLOTS.indexOf(record.startTime);
      if (idx > 0) active.add(TIME_SLOTS[idx - 1]);
      if (idx < TIME_SLOTS.length - 1) active.add(TIME_SLOTS[idx + 1]);
    }
    return active.size > 0
      ? TIME_SLOTS.filter((slot) => active.has(slot))
      : TIME_SLOTS.slice(0, 10); // Show first 10 if no data
  }, [schedules]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-teal-600" />
            Class Schedule
          </h1>
          <p className="text-muted-foreground text-sm">
            {isTeacher
              ? "View and manage class timetables"
              : "View your weekly class schedule"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 rounded-lg border p-0.5">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-7 text-xs"
            >
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-7 text-xs"
            >
              List
            </Button>
          </div>

          {isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Class
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Class to Schedule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select value={createDay} onValueChange={setCreateDay}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={createStartTime}
                        onChange={(e) => setCreateStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={createEndTime}
                        onChange={(e) => setCreateEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Room</Label>
                    <Input
                      placeholder="e.g., Room 101"
                      value={createRoom}
                      onChange={(e) => setCreateRoom(e.target.value)}
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
                      <Label>Batch</Label>
                      <Select value={createBatchId} onValueChange={setCreateBatchId}>
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
                  {isAdmin && (
                    <div className="space-y-2">
                      <Label>Teacher</Label>
                      <Select value={createTeacherId} onValueChange={setCreateTeacherId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Assign teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.filter((t) => t.role === "teacher").map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-500/10 p-2.5">
                <CalendarClock className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{scheduleStats.totalClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <BookOpen className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subjects</p>
                <p className="text-2xl font-bold">{scheduleStats.uniqueSubjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <MapPin className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rooms</p>
                <p className="text-2xl font-bold">{scheduleStats.uniqueRooms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Filter */}
      {(isAdmin || isTeacher) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="space-y-2 w-full sm:w-auto">
                <Label>Batch</Label>
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="All batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
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
      )}

      {/* Error */}
      {scheduleQuery.error && (
        <Card className="border-red-200">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-600">{scheduleQuery.error}</p>
          </CardContent>
        </Card>
      )}

      {/* ── GRID VIEW ─────────────────────────────────────────────────── */}
      {viewMode === "grid" && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Timetable</CardTitle>
            <CardDescription>
              {batchId ? `Showing schedule for selected batch` : isTeacher ? "Your teaching schedule" : "All classes"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduleQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-md" />
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No classes scheduled</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-10">
                      <TableHead className="w-[80px] text-center bg-background">Time</TableHead>
                      {DAYS_OF_WEEK.map((day) => (
                        <TableHead key={day} className="text-center min-w-[140px] bg-background">
                          <span className="text-xs font-semibold">{day.slice(0, 3)}</span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTimeSlots.map((slot) => {
                      // Only show rows that have at least one class in any day
                      const hasClassesInRow = DAYS_OF_WEEK.some(
                        (day) => (gridData.get(day)?.get(slot)?.length ?? 0) > 0
                      );

                      if (!hasClassesInRow) return null;

                      return (
                        <TableRow key={slot}>
                          <TableCell className="text-center text-xs text-muted-foreground font-mono whitespace-nowrap bg-muted/20">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3" />
                              {slot}
                            </div>
                          </TableCell>
                          {DAYS_OF_WEEK.map((day) => {
                            const classes = gridData.get(day)?.get(slot) || [];
                            return (
                              <TableCell key={`${day}-${slot}`} className="p-1 align-top">
                                {classes.length > 0
                                  ? classes.map((cls) => {
                                      const color = getSubjectColor(cls.subject?.name || null);
                                      return (
                                        <div
                                          key={cls.id}
                                          className={`rounded-md border p-2 mb-1 ${color.bg} ${color.border}`}
                                        >
                                          <p className={`text-xs font-semibold leading-tight ${color.text}`}>
                                            {cls.subject?.name || "Unknown"}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {cls.startTime} - {cls.endTime}
                                          </p>
                                          {cls.teacher && (
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                              <User className="h-2.5 w-2.5" />
                                              {cls.teacher.name}
                                            </p>
                                          )}
                                          {cls.room && (
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                              <MapPin className="h-2.5 w-2.5" />
                                              {cls.room}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })
                                  : null}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── LIST VIEW ─────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>All Classes</CardTitle>
            <CardDescription>List view of all scheduled classes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {scheduleQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-md" />
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No classes scheduled</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Batch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((record) => {
                      const color = getSubjectColor(record.subject?.name || null);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {record.dayOfWeek.slice(0, 3)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {record.startTime} - {record.endTime}
                          </TableCell>
                          <TableCell>
                            <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${color.bg} ${color.border}`}>
                              <BookOpen className={`h-3.5 w-3.5 ${color.text}`} />
                              <span className={`text-sm font-medium ${color.text}`}>
                                {record.subject?.name || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.teacher?.name || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.room ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                {record.room}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.batch?.name || "—"}
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
      )}

      {/* Color Legend */}
      {schedules.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Subject Color Legend</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(subjectColorMap.entries()).map(([name, color]) => (
                <div
                  key={name}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${color.bg} ${color.border}`}
                >
                  <div className={`h-2 w-2 rounded-full ${color.bg.replace("/10", "/50")}`} />
                  <span className={color.text}>{name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
