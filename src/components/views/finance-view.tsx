"use client";

import { useApiQuery } from "@/hooks/use-api-query";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";

interface DashboardFinance {
  totalRevenue: number;
  totalExpenses: number;
  pendingFees: number;
  pendingFeesAmount: number;
  totalSalariesThisMonth: number;
  revenueData: { month: string; amount: number }[];
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  transactionId: string | null;
  status: string;
  receiptNo: string | null;
  remarks: string | null;
  paidAt: string;
  user: { id: string; name: string; email: string } | null;
  fee: { id: string } | null;
}

interface ExpenseRecord {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  expenseDate: string;
  approvedBy: string | null;
}

function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  color: string;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && (
              <ArrowUpRight className="h-3 w-3 text-emerald-600" />
            )}
            {trend === "down" && (
              <ArrowDownRight className="h-3 w-3 text-red-500" />
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function FinanceSkeleton() {
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
              <Skeleton className="h-8 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function methodColor(method: string) {
  switch (method) {
    case "cash":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "bank":
      return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    case "mobile":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    default:
      return "";
  }
}

export default function FinanceView() {
  const { user } = useAuth();
  const isAdmin =
    user?.role === "admin" ||
    user?.role === "accountant" ||
    user?.isSuperAdmin;

  const { data: dashboardData, isLoading: dashLoading, error: dashError, refetch: refetchDash } =
    useApiQuery<DashboardFinance>("/api/dashboard", { enabled: isAdmin });

  const { data: recentPayments, isLoading: payLoading } =
    useApiQuery<PaymentRecord[]>("/api/payments?limit=10", { enabled: isAdmin });

  const { data: recentExpenses, isLoading: expLoading } =
    useApiQuery<ExpenseRecord[]>("/api/expenses?limit=10", { enabled: isAdmin });

  const isLoading = dashLoading || payLoading || expLoading;
  const error = dashError;

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Financial overview</p>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm text-destructive font-medium">Access Denied</p>
            <p className="text-xs text-muted-foreground mt-1">
              Only administrators and accountants can view finance data.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) return <FinanceSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Financial overview</p>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm text-destructive font-medium">
              Failed to load finance data
            </p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button
              onClick={refetchDash}
              className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRevenue = dashboardData?.totalRevenue ?? 0;
  const totalExpenses = dashboardData?.totalExpenses ?? 0;
  const pendingFees = dashboardData?.pendingFeesAmount ?? 0;
  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">
          Financial overview and transaction history
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={TrendingUp}
          description="All time"
          color="bg-emerald-600"
          trend="up"
        />
        <KpiCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={TrendingDown}
          description="All time"
          color="bg-red-500"
          trend="down"
        />
        <KpiCard
          title="Net Income"
          value={formatCurrency(netIncome)}
          icon={DollarSign}
          description={netIncome >= 0 ? "Profitable" : "Loss"}
          color={netIncome >= 0 ? "bg-teal-600" : "bg-red-600"}
          trend={netIncome >= 0 ? "up" : "down"}
        />
        <KpiCard
          title="Pending Fees"
          value={formatCurrency(pendingFees)}
          icon={Clock}
          description={`${dashboardData?.pendingFees ?? 0} students`}
          color="bg-amber-600"
        />
      </div>

      {/* Monthly Summary */}
      {dashboardData?.revenueData && dashboardData.revenueData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              <CardTitle>Monthly Revenue Summary</CardTitle>
            </div>
            <CardDescription>Revenue breakdown by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              {dashboardData.revenueData.map((item, idx) => (
                <div key={item.month}>
                  {idx > 0 && <Separator className="my-2" />}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">{item.month}</span>
                    <span className="text-sm font-bold text-emerald-600">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <CardTitle>Recent Payments</CardTitle>
            </div>
            <CardDescription>Latest fee payments received</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments && recentPayments.length > 0 ? (
                    recentPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {p.user?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.receiptNo || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="font-medium text-emerald-600">
                          {formatCurrency(p.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={methodColor(p.method)}
                          >
                            {p.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(p.paidAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No recent payments
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <CardTitle>Recent Expenses</CardTitle>
            </div>
            <CardDescription>Latest expense records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExpenses && recentExpenses.length > 0 ? (
                    recentExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          {e.description}
                        </TableCell>
                        <TableCell>
                          {e.category ? (
                            <Badge variant="outline">{e.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-red-500">
                          -{formatCurrency(e.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(
                            new Date(e.expenseDate),
                            "MMM d, yyyy"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No recent expenses
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
