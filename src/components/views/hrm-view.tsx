"use client";

import { useApiQuery } from "@/hooks/use-api-query";
import { useAppStore } from "@/stores/app-store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserCheck,
  UserX,
  Building2,
  Plus,
  Briefcase,
  CalendarOff,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeProfile: {
    id: string;
    employeeId: string;
    status: string;
    employmentType: string;
    department: { id: string; name: string } | null;
    designation: { id: string; title: string; level: number; baseSalary: number } | null;
  } | null;
}

interface DashboardSummary {
  totalEmployees: number;
  totalTeachers: number;
  totalDepartments: number;
  pendingLeaveRequests: number;
}

interface DepartmentItem {
  id: string;
  name: string;
  code: string | null;
  head: { id: string; name: string } | null;
  _count: { employees: number };
}

interface DesignationItem {
  id: string;
  title: string;
  level: number;
  baseSalary: number;
  isActive: boolean;
  _count: { employees: number };
}

function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  color,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{value}</div>
          {onClick && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function HrmSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HrmView() {
  const { setActiveView } = useAppStore();

  const { data: dashData, isLoading: dashLoading, error, refetch } =
    useApiQuery<DashboardSummary>("/api/dashboard");

  const { data: employees, isLoading: empLoading } =
    useApiQuery<EmployeeSummary[]>("/api/employees?limit=100");

  const { data: departments } =
    useApiQuery<DepartmentItem[]>("/api/departments");

  const { data: designations } =
    useApiQuery<DesignationItem[]>("/api/designations");

  if (dashLoading || empLoading) return <HrmSkeleton />;

  const totalEmployees = dashData?.totalEmployees ?? 0;
  const totalTeachers = dashData?.totalTeachers ?? 0;
  const totalDepts = dashData?.totalDepartments ?? 0;
  const pendingLeaves = dashData?.pendingLeaveRequests ?? 0;

  const activeCount = (employees || []).filter(
    (e) => e.employeeProfile?.status === "active"
  ).length;
  const onLeaveCount = (employees || []).filter(
    (e) => e.employeeProfile?.status === "on-leave"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR Management</h1>
          <p className="text-muted-foreground">
            Employee overview and HR operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setActiveView("employees")}>
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveView("leave")}
          >
            <CalendarOff className="h-4 w-4 mr-1" /> Manage Leave Types
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Employees"
          value={totalEmployees}
          icon={Users}
          description={`${totalTeachers} teachers`}
          color="bg-emerald-600"
          onClick={() => setActiveView("employees")}
        />
        <KpiCard
          title="Active"
          value={activeCount}
          icon={UserCheck}
          description="Currently active"
          color="bg-teal-600"
          onClick={() => setActiveView("employees")}
        />
        <KpiCard
          title="On Leave"
          value={onLeaveCount}
          icon={UserX}
          description={`${pendingLeaves} pending requests`}
          color="bg-amber-600"
          onClick={() => setActiveView("leave")}
        />
        <KpiCard
          title="Departments"
          value={totalDepts}
          icon={Building2}
          description="Organizational units"
          color="bg-green-600"
          onClick={() => setActiveView("departments")}
        />
      </div>

      {/* Quick Navigation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveView("employees")}
        >
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Employees</p>
              <p className="text-xs text-muted-foreground">Manage staff</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveView("departments")}
        >
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
              <Building2 className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Departments</p>
              <p className="text-xs text-muted-foreground">Organizational structure</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveView("leave")}
        >
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <CalendarOff className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Leave Management</p>
              <p className="text-xs text-muted-foreground">Requests & types</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setActiveView("salary")}
        >
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Briefcase className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Payroll</p>
              <p className="text-xs text-muted-foreground">Salary management</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardContent>
        </Card>
      </div>

      {/* Designation Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            <CardTitle>Designations</CardTitle>
          </div>
          <CardDescription>All designations and employee counts</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Failed to load data</p>
              <button
                onClick={refetch}
                className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline"
              >
                Retry
              </button>
            </div>
          ) : designations && designations.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell>{d.level}</TableCell>
                      <TableCell className="text-emerald-600 font-medium">
                        {new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(d.baseSalary)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{d._count?.employees ?? 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            d.isActive
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-red-500/10 text-red-600 border-red-500/20"
                          }
                        >
                          {d.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No designations configured yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
