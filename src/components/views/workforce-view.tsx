"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserCheck,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  Building2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Play,
  Star,
  TrendingUp,
  Zap,
  Brain,
  Target,
  BarChart3,
  ChevronDown,
  Briefcase,
  Cpu,
  Wrench,
  Shield,
  ArrowUpRight,
  Circle,
  Sparkles,
  Hash,
  Award,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DepartmentDist {
  department: string;
  code: string;
  count: number;
  color: string | null;
  icon: string | null;
}

interface LevelDist {
  level: string;
  count: number;
}

interface TopPerformer {
  id: string;
  employeeId: string;
  name: string;
  title: string;
  avatar: string | null;
  level: string;
  successRate: number;
  completedTasks: number;
  avgLatencyMs: number;
  department: { name: string; code: string; color: string | null };
}

interface RecentActivityItem {
  id: string;
  title: string;
  status: string;
  taskType: string;
  complexity: string;
  assignedEmployee: { name: string; title: string } | null;
  createdAt: string;
  modelUsed: string | null;
  latencyMs: number;
}

interface WorkforceStats {
  employees: {
    total: number;
    active: number;
    working: number;
    busy: number;
    offline: number;
    disabled: number;
  };
  employeesByLevel: LevelDist[];
  employeesByDepartment: DepartmentDist[];
  tasks: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    running: number;
    successRate: number;
  };
  avgLatencyMs: number;
  departments: { total: number };
  conversations: { total: number };
  knowledge: { nodes: number; sops: number; memories: number };
  topPerformers: TopPerformer[];
  recentActivity: RecentActivityItem[];
}

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  title: string;
  level: string;
  status: string;
  mission: string;
  skills: string;
  capabilities: string;
  tools: string;
  modelTier: string;
  preferredModel: string | null;
  kpis: string;
  currentKpis: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  avgLatencyMs: number;
  lastActiveAt: string | null;
  canDelegate: boolean;
  canConsult: boolean;
  canReview: boolean;
  canEscalate: boolean;
  isEnabled: boolean;
  isAvailable: boolean;
  department: {
    id: string;
    name: string;
    code: string;
    description?: string;
    parentId?: string | null;
    level?: number;
    icon?: string | null;
    color?: string | null;
  };
  reportsTo: {
    id: string;
    employeeId: string;
    name: string;
    title: string;
  } | null;
}

interface EmployeeDetail extends Employee {
 recentExecutions: {
    id: string;
    taskId: string;
    title: string;
    taskType: string;
    status: string;
    complexity: string;
    modelUsed: string | null;
    latencyMs: number;
    completedAt: string | null;
    createdAt: string;
  }[];
  kpisParsed: KpiItem[];
  currentKpisParsed: Record<string, number>;
  memorySummary: { type: string; count: number }[];
}

interface KpiItem {
  name: string;
  target: number;
  unit?: string;
}

interface DeptNode {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId: string | null;
  level: number;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  employeeCount: number;
  totalTasks: number;
  avgSuccessRate: number;
  children?: DeptNode[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('mos_token') || '';
};

const apiFetch = async (url: string, options?: RequestInit) => {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
};

const parseJsonSafe = <T,>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const statusColors: Record<string, string> = {
  idle: 'bg-emerald-500',
  working: 'bg-amber-500',
  busy: 'bg-rose-500',
  offline: 'bg-slate-500',
  training: 'bg-violet-500',
};

const statusLabelColors: Record<string, string> = {
  idle: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  working: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  busy: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  offline: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  training: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

const levelBadgeColors: Record<string, string> = {
  executive: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  director: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  manager: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  supervisor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  specialist: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  worker: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const taskStatusColors: Record<string, string> = {
  completed: 'text-emerald-400',
  failed: 'text-rose-400',
  pending: 'text-amber-400',
  running: 'text-cyan-400',
 escalated: 'text-violet-400',
};

const LEVEL_COLORS = ['#f59e0b', '#a78bfa', '#22d3ee', '#34d399', '#f97316', '#94a3b8'];
const LEVEL_ORDER = ['executive', 'director', 'manager', 'supervisor', 'specialist', 'worker'];

const TASK_TYPES = [
  'content_creation', 'seo_analysis', 'lead_qualification', 'campaign_planning',
  'social_posting', 'email_campaign', 'data_analysis', 'financial_report',
  'code_review', 'customer_support', 'strategy_planning', 'general',
];

const COMPLEXITY_OPTIONS = ['simple', 'standard', 'complex', 'enterprise'];

const LEVEL_OPTIONS = ['executive', 'director', 'manager', 'supervisor', 'specialist', 'worker'];

const STATUS_OPTIONS = ['idle', 'working', 'busy', 'offline'];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created' },
  { value: 'name', label: 'Name' },
  { value: 'completedTasks', label: 'Tasks Completed' },
  { value: 'successRate', label: 'Success Rate' },
  { value: 'avgLatencyMs', label: 'Avg Latency' },
  { value: 'totalTasks', label: 'Total Tasks' },
];

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function WorkforceView() {
  const [activeTab, setActiveTab] = useState('overview');

  // Stats (overview)
  const [stats, setStats] = useState<WorkforceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Employees list
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [empPage, setEmpPage] = useState(1);
  const [empLimit] = useState(20);
  const [empFilters, setEmpFilters] = useState({
    department: '',
    level: '',
    status: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
  });
  const [empLoading, setEmpLoading] = useState(true);

  // Departments (org)
  const [departments, setDepartments] = useState<DeptNode[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);

  // Employee detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponses, setChatResponses] = useState<{ role: string; content: string }[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Task execution
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskType, setTaskType] = useState('general');
  const [taskComplexity, setTaskComplexity] = useState('standard');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskResult, setTaskResult] = useState<Record<string, unknown> | null>(null);

  // Expanded depts
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await apiFetch('/api/workforce/stats');
      setStats(data);
    } catch (e) {
      toast.error('Failed to load workforce stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    try {
      setEmpLoading(true);
      const params = new URLSearchParams({
        page: String(empPage),
        limit: String(empLimit),
        sortBy: empFilters.sortBy,
        sortOrder: empFilters.sortOrder,
      });
      if (empFilters.department) params.set('department', empFilters.department);
      if (empFilters.level) params.set('level', empFilters.level);
      if (empFilters.status) params.set('status', empFilters.status);
      if (empFilters.search) params.set('search', empFilters.search);

      const data = await apiFetch(`/api/workforce/employees?${params.toString()}`);
      setEmployees(data.employees);
      setEmployeeTotal(data.total);
    } catch (e) {
      toast.error('Failed to load employees');
    } finally {
      setEmpLoading(false);
    }
  }, [empPage, empLimit, empFilters]);

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    try {
      setDeptLoading(true);
      const data = await apiFetch('/api/workforce/departments');
      setDepartments(data.departments);
    } catch (e) {
      toast.error('Failed to load departments');
    } finally {
      setDeptLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'employees') fetchEmployees();
  }, [activeTab, fetchEmployees]);

  useEffect(() => {
    if (activeTab === 'organization') fetchDepartments();
  }, [activeTab, fetchDepartments]);

  // Open employee detail
  const openEmployeeDetail = async (emp: Employee) => {
    setSelectedEmployee(null);
    setDetailOpen(true);
    setChatResponses([]);
    setConversationId(null);
    setChatMessage('');
    try {
      setDetailLoading(true);
      const data = await apiFetch(`/api/workforce/employees/${emp.id}`);
      setSelectedEmployee({
        ...data.employee,
        ...emp,
        recentExecutions: data.recentExecutions || [],
        kpisParsed: data.kpis || [],
        currentKpisParsed: data.currentKpis || {},
        memorySummary: data.memorySummary || [],
      });
    } catch {
      toast.error('Failed to load employee details');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Toggle employee fields
  const toggleEmployeeField = async (empId: string, field: 'isEnabled' | 'isAvailable', value: boolean) => {
    try {
      await apiFetch(`/api/workforce/employees/${empId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
      setSelectedEmployee((prev) => (prev ? { ...prev, [field]: value } : prev));
      fetchEmployees();
      fetchStats();
      toast.success(`${field === 'isEnabled' ? 'Enabled' : 'Available'} status updated`);
    } catch {
      toast.error('Failed to update employee');
    }
  };

  // Chat with employee
  const sendChat = async () => {
    if (!selectedEmployee || !chatMessage.trim()) return;
    const msg = chatMessage.trim();
    setChatMessage('');
    setChatLoading(true);
    setChatResponses((prev) => [...prev, { role: 'user', content: msg }]);
    try {
      const data = await apiFetch('/api/workforce/chat', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          message: msg,
          conversationId,
        }),
      });
      setChatResponses((prev) => [
        ...prev,
        { role: 'assistant', content: data.response },
      ]);
      if (data.conversationId) setConversationId(data.conversationId);
    } catch (e) {
      toast.error('Chat failed');
      setChatResponses((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // Submit task
  const submitTask = async () => {
    if (!taskTitle.trim() || !taskDesc.trim()) {
      toast.error('Title and description are required');
      return;
    }
    setTaskSubmitting(true);
    setTaskResult(null);
    try {
      const data = await apiFetch('/api/workforce/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          type: taskType,
          complexity: taskComplexity,
        }),
      });
      setTaskResult(data);
      toast.success('Task submitted and assigned');
      fetchStats();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Task submission failed';
      toast.error(msg);
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Build department tree
  const buildDeptTree = (flat: DeptNode[]): DeptNode[] => {
    const map = new Map<string, DeptNode>();
    const roots: DeptNode[] = [];
    for (const d of flat) {
      map.set(d.id, { ...d, children: [] });
    }
    for (const d of map.values()) {
      if (d.parentId && map.has(d.parentId)) {
        map.get(d.parentId)!.children!.push(d);
      } else {
        roots.push(d);
      }
    }
    return roots;
  };

  // Navigate from org tab to employees tab with dept filter
  const filterByDepartment = (deptId: string) => {
    setEmpFilters((prev) => ({ ...prev, department: deptId }));
    setEmpPage(1);
    setActiveTab('employees');
  };

  // Total pages
  const totalPages = Math.ceil(employeeTotal / empLimit);

  // ─── Chart data ──────────────────────────────────────────────────────────────

  const deptChartData = (() => {
    if (!stats?.employeesByDepartment) return [];
    const sorted = [...stats.employeesByDepartment].sort((a, b) => b.count - a.count);
    if (sorted.length <= 12) return sorted;
    const top = sorted.slice(0, 12);
    const otherCount = sorted.slice(12).reduce((sum, d) => sum + d.count, 0);
    return [...top, { department: 'Other', code: 'OTH', count: otherCount, color: '#64748b', icon: null }];
  })();

  const levelChartData = (() => {
    if (!stats?.employeesByLevel) return [];
    return LEVEL_ORDER.map((lvl, i) => {
      const found = stats.employeesByLevel.find((l) => l.level === lvl);
      return { name: lvl.charAt(0).toUpperCase() + lvl.slice(1), value: found?.count || 0, color: LEVEL_COLORS[i] };
    }).filter((d) => d.value > 0);
  })();

  // ─── Render: Overview ────────────────────────────────────────────────────────

  const renderOverview = () => {
    if (statsLoading) return <OverviewSkeleton />;
    if (!stats) return <p className="text-muted-foreground">No data available</p>;

    const statCards = [
      { label: 'Total Employees', value: stats.employees.total, icon: <Users className="w-5 h-5" />, gradient: 'from-violet-500/20 to-violet-600/5', iconColor: 'text-violet-400', border: 'border-violet-500/20' },
      { label: 'Active / Idle', value: stats.employees.active, icon: <UserCheck className="w-5 h-5" />, gradient: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400', border: 'border-emerald-500/20' },
      { label: 'Working', value: stats.employees.working, icon: <Loader2 className="w-5 h-5" />, gradient: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400', border: 'border-amber-500/20' },
      { label: 'Busy', value: stats.employees.busy, icon: <Wifi className="w-5 h-5" />, gradient: 'from-rose-500/20 to-rose-600/5', iconColor: 'text-rose-400', border: 'border-rose-500/20' },
      { label: 'Offline', value: stats.employees.offline, icon: <WifiOff className="w-5 h-5" />, gradient: 'from-slate-500/20 to-slate-600/5', iconColor: 'text-slate-400', border: 'border-slate-500/20' },
      { label: 'Departments', value: stats.departments.total, icon: <Building2 className="w-5 h-5" />, gradient: 'from-cyan-500/20 to-cyan-600/5', iconColor: 'text-cyan-400', border: 'border-cyan-500/20' },
    ];

    return (
      <motion.div {...stagger} className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((card) => (
            <motion.div key={card.label} {...fadeIn}>
              <Card className={`border ${card.border} bg-gradient-to-br ${card.gradient} backdrop-blur-sm`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={card.iconColor}>{card.icon}</span>
                  </div>
                  <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Distribution */}
          <motion.div {...fadeIn}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-violet-400" />
                  Department Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptChartData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="code" width={36} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                        {deptChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color || '#94a3b8'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Level Distribution */}
          <motion.div {...fadeIn}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Level Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="h-[300px] flex items-center justify-center">
                  {levelChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={levelChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none">
                          {levelChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm">No employee data</p>
                  )}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {levelChartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-muted-foreground">{d.name}</span>
                      <span className="text-xs font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Row: Top Performers + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <motion.div {...fadeIn}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {stats.topPerformers.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topPerformers.slice(0, 5).map((perf, i) => (
                      <div key={perf.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-5">#{i + 1}</span>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className="text-xs font-bold text-white"
                            style={{ backgroundColor: perf.department?.color || '#94a3b8' }}
                          >
                            {getInitials(perf.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{perf.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{perf.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-emerald-400">{perf.completedTasks}</p>
                          <p className="text-xs text-muted-foreground">{perf.successRate}% success</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No performance data yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div {...fadeIn}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {stats.recentActivity.length > 0 ? (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-3">
                      {stats.recentActivity.slice(0, 10).map((act) => (
                        <div key={act.id} className="flex items-start gap-3">
                          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColors[act.status] || 'bg-slate-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{act.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs ${taskStatusColors[act.status] || 'text-muted-foreground'}`}>{act.status}</span>
                              {act.assignedEmployee && (
                                <span className="text-xs text-muted-foreground">· {act.assignedEmployee.name}</span>
                              )}
                              <span className="text-xs text-muted-foreground">· {new Date(act.createdAt).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Knowledge & Tasks Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Tasks Completed', value: stats.tasks.completed, icon: <Target className="w-4 h-4" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Success Rate', value: `${stats.tasks.successRate}%`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
            { label: 'Knowledge Nodes', value: stats.knowledge.nodes, icon: <Brain className="w-4 h-4" />, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { label: 'Conversations', value: stats.conversations.total, icon: <MessageSquare className="w-4 h-4" />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          ].map((item) => (
            <motion.div key={item.label} {...fadeIn}>
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`${item.bg} p-2 rounded-lg`}>{<span className={item.color}>{item.icon}</span>}</div>
                  <div>
                    <p className="text-lg font-bold">{item.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  };

  // ─── Render: Employees ───────────────────────────────────────────────────────

  const renderEmployees = () => (
    <motion.div {...fadeIn} className="space-y-4">
      {/* Filters */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-9 h-9 bg-background/50"
                value={empFilters.search}
                onChange={(e) => {
                  setEmpFilters((p) => ({ ...p, search: e.target.value }));
                  setEmpPage(1);
                }}
              />
            </div>
            <Select value={empFilters.department} onValueChange={(v) => { setEmpFilters((p) => ({ ...p, department: v === '__all__' ? '' : v })); setEmpPage(1); }}>
              <SelectTrigger className="w-[160px] h-9 bg-background/50"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Departments</SelectItem>
                {stats?.employeesByDepartment.map((d) => (
                  <SelectItem key={d.code} value={d.department}>{d.code} — {d.department}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={empFilters.level} onValueChange={(v) => { setEmpFilters((p) => ({ ...p, level: v === '__all__' ? '' : v })); setEmpPage(1); }}>
              <SelectTrigger className="w-[140px] h-9 bg-background/50"><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Levels</SelectItem>
                {LEVEL_OPTIONS.map((l) => (
                  <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={empFilters.status} onValueChange={(v) => { setEmpFilters((p) => ({ ...p, status: v === '__all__' ? '' : v })); setEmpPage(1); }}>
              <SelectTrigger className="w-[130px] h-9 bg-background/50"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={empFilters.sortBy} onValueChange={(v) => setEmpFilters((p) => ({ ...p, sortBy: v }))}>
              <SelectTrigger className="w-[150px] h-9 bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setEmpFilters((p) => ({ ...p, sortOrder: p.sortOrder === 'asc' ? 'desc' : 'asc' }))}
            >
              {empFilters.sortOrder === 'asc' ? <ArrowUpRight className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {empFilters.sortOrder === 'asc' ? 'ASC' : 'DESC'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{Math.min((empPage - 1) * empLimit + 1, employeeTotal)}</span>
          {' '}-{' '}
          <span className="font-medium text-foreground">{Math.min(empPage * empLimit, employeeTotal)}</span>
          {' '}of <span className="font-medium text-foreground">{employeeTotal.toLocaleString()}</span> employees
        </p>
      </div>

      {/* Employee Grid */}
      {empLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50"><CardContent className="p-4 space-y-3"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></CardContent></Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No employees match your filters</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setEmpFilters({ department: '', level: '', status: '', search: '', sortBy: 'createdAt', sortOrder: 'desc' })}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div {...stagger} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const skills = parseJsonSafe<string[]>(emp.skills, []);
            const deptColor = emp.department?.color || '#94a3b8';
            return (
              <motion.div key={emp.id} {...fadeIn}>
                <Card
                  className="border-border/50 bg-card/80 backdrop-blur-sm cursor-pointer hover:border-border transition-colors group"
                  onClick={() => openEmployeeDetail(emp)}
                >
                  <CardContent className="p-4">
                    {/* Header: avatar + name + status */}
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-11 w-11">
                          <AvatarFallback
                            className="text-sm font-bold text-white"
                            style={{ backgroundColor: deptColor }}
                          >
                            {getInitials(emp.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${statusColors[emp.status] || 'bg-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{emp.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.title}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{emp.employeeId}</p>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-medium" style={{ borderColor: deptColor + '60', color: deptColor }}>
                        {emp.department?.code}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${levelBadgeColors[emp.level] || ''}`}>
                        {emp.level}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${statusLabelColors[emp.status] || ''}`}>
                        {emp.status}
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center">
                        <p className="text-sm font-bold">{emp.completedTasks}</p>
                        <p className="text-[10px] text-muted-foreground">Completed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-emerald-400">{emp.successRate}%</p>
                        <p className="text-[10px] text-muted-foreground">Success</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-cyan-400">{emp.avgLatencyMs > 0 ? `${(emp.avgLatencyMs / 1000).toFixed(1)}s` : '—'}</p>
                        <p className="text-[10px] text-muted-foreground">Avg Latency</p>
                      </div>
                    </div>

                    {/* Skills */}
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {skills.slice(0, 4).map((skill) => (
                          <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/50">
                            {skill}
                          </span>
                        ))}
                        {skills.length > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">+{skills.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* Model tier */}
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/30">
                      <Cpu className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{emp.modelTier || 'balanced'}</span>
                      {emp.preferredModel && (
                        <span className="text-[10px] text-muted-foreground/60 ml-auto truncate max-w-[120px]">{emp.preferredModel}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" className="h-8" disabled={empPage <= 1} onClick={() => setEmpPage(1)}>
            First
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={empPage <= 1} onClick={() => setEmpPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page {empPage} of {totalPages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={empPage >= totalPages} onClick={() => setEmpPage((p) => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" disabled={empPage >= totalPages} onClick={() => setEmpPage(totalPages)}>
            Last
          </Button>
        </div>
      )}
    </motion.div>
  );

  // ─── Render: Employee Detail Sheet ───────────────────────────────────────────

  const renderDetailSheet = () => (
    <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
      <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 bg-background border-border/50 overflow-hidden flex flex-col">
        {detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : selectedEmployee ? (
          <>
            <SheetHeader className="p-5 pb-3 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback
                    className="text-base font-bold text-white"
                    style={{ backgroundColor: selectedEmployee.department?.color || '#94a3b8' }}
                  >
                    {getInitials(selectedEmployee.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-base truncate">{selectedEmployee.name}</SheetTitle>
                  <SheetDescription className="truncate">{selectedEmployee.title}</SheetDescription>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusLabelColors[selectedEmployee.status] || ''}`}>
                  <div className={`w-2 h-2 rounded-full ${statusColors[selectedEmployee.status] || 'bg-slate-500'}`} />
                  {selectedEmployee.status}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono" style={{ borderColor: (selectedEmployee.department?.color || '#94a3b8') + '60', color: selectedEmployee.department?.color }}>
                  {selectedEmployee.department?.code} — {selectedEmployee.department?.name}
                </Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${levelBadgeColors[selectedEmployee.level] || ''}`}>
                  {selectedEmployee.level}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono text-muted-foreground">
                  {selectedEmployee.employeeId}
                </Badge>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">
                {/* Toggles */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedEmployee.isEnabled}
                      onCheckedChange={(v) => toggleEmployeeField(selectedEmployee.id, 'isEnabled', v)}
                    />
                    <Label className="text-xs text-muted-foreground">Enabled</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedEmployee.isAvailable}
                      onCheckedChange={(v) => toggleEmployeeField(selectedEmployee.id, 'isAvailable', v)}
                    />
                    <Label className="text-xs text-muted-foreground">Available</Label>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Mission */}
                {selectedEmployee.mission && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Mission</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedEmployee.mission}</p>
                  </div>
                )}

                {/* KPIs */}
                {selectedEmployee.kpisParsed.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">KPIs</h4>
                    <div className="space-y-2.5">
                      {selectedEmployee.kpisParsed.map((kpi) => {
                        const current = selectedEmployee.currentKpisParsed[kpi.name] ?? 0;
                        const pct = kpi.target > 0 ? Math.min(100, Math.round((current / kpi.target) * 100)) : 0;
                        return (
                          <div key={kpi.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">{kpi.name}</span>
                              <span className="text-xs text-muted-foreground">{current} / {kpi.target}{kpi.unit || ''}</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Total Tasks', value: selectedEmployee.totalTasks, icon: <Target className="w-3.5 h-3.5" />, color: 'text-violet-400' },
                    { label: 'Completed', value: selectedEmployee.completedTasks, icon: <Star className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
                    { label: 'Failed', value: selectedEmployee.failedTasks, icon: <Circle className="w-3.5 h-3.5" />, color: 'text-rose-400' },
                    { label: 'Success', value: `${selectedEmployee.successRate}%`, icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-cyan-400' },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-card/50 border border-border/30">
                      <span className={`${s.color} flex justify-center mb-1`}>{s.icon}</span>
                      <p className="text-sm font-bold">{s.value.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Reports To */}
                {selectedEmployee.reportsTo && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Reports To</h4>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border/30">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] font-bold bg-slate-600 text-white">
                          {getInitials(selectedEmployee.reportsTo.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{selectedEmployee.reportsTo.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{selectedEmployee.reportsTo.title}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Skills */}
                {(() => {
                  const skills = parseJsonSafe<string[]>(selectedEmployee.skills, []);
                  if (skills.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs font-normal bg-background/80">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Capabilities */}
                {(() => {
                  const caps = parseJsonSafe<string[]>(selectedEmployee.capabilities, []);
                  if (caps.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Capabilities</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {caps.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs font-normal border-violet-500/30 text-violet-300">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Tools */}
                {(() => {
                  const tools = parseJsonSafe<string[]>(selectedEmployee.tools, []);
                  if (tools.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Tools</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {tools.map((t) => (
                          <Badge key={t} variant="outline" className="text-xs font-normal border-cyan-500/30 text-cyan-300">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Collaboration */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Collaboration</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Delegate', active: selectedEmployee.canDelegate },
                      { label: 'Consult', active: selectedEmployee.canConsult },
                      { label: 'Review', active: selectedEmployee.canReview },
                      { label: 'Escalate', active: selectedEmployee.canEscalate },
                    ].map((c) => (
                      <Badge key={c.label} variant="outline" className={`text-xs ${c.active ? 'border-emerald-500/30 text-emerald-400' : 'border-border/30 text-muted-foreground/50'}`}>
                        {c.active ? '✓' : '—'} {c.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Memory Summary */}
                {selectedEmployee.memorySummary.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Memory</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedEmployee.memorySummary.map((m) => (
                        <div key={m.type} className="text-center p-2 rounded-lg bg-card/50 border border-border/30">
                          <p className="text-sm font-bold">{m.count}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{m.type}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="bg-border/50" />

                {/* Recent Executions */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Task Executions</h4>
                  {selectedEmployee.recentExecutions.length > 0 ? (
                    <div className="space-y-2">
                      {selectedEmployee.recentExecutions.map((ex) => (
                        <div key={ex.id} className="p-2.5 rounded-lg bg-card/50 border border-border/30">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{ex.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] ${taskStatusColors[ex.status] || 'text-muted-foreground'}`}>{ex.status}</span>
                                <span className="text-[10px] text-muted-foreground">{ex.taskType}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-muted-foreground">{ex.latencyMs > 0 ? `${(ex.latencyMs / 1000).toFixed(1)}s` : '—'}</p>
                              <p className="text-[10px] text-muted-foreground/60">{new Date(ex.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No recent executions</p>
                  )}
                </div>

                <Separator className="bg-border/50" />

                {/* Chat */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chat with {selectedEmployee.name.split(' ')[0]}
                  </h4>
                  <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
                    <ScrollArea className="max-h-[300px] p-3">
                      {chatResponses.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Start a conversation...</p>
                      ) : (
                        <div className="space-y-3">
                          {chatResponses.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                                  msg.role === 'user'
                                    ? 'bg-primary/15 text-foreground'
                                    : 'bg-background/80 text-muted-foreground border border-border/30'
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {chatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-background/80 border border-border/30 rounded-lg px-3 py-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                    <div className="flex items-center gap-2 p-3 border-t border-border/30">
                      <Input
                        placeholder={`Ask ${selectedEmployee.name.split(' ')[0]}...`}
                        className="h-8 text-xs bg-background/50"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChat();
                          }
                        }}
                        disabled={chatLoading}
                      />
                      <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendChat} disabled={chatLoading || !chatMessage.trim()}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );

  // ─── Render: Organization ────────────────────────────────────────────────────

  const renderDeptNode = (node: DeptNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedDepts.has(node.id);
    const color = node.color || '#94a3b8';

    return (
      <div key={node.id}>
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-accent/30 transition-colors text-left group"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => {
            if (hasChildren) {
              setExpandedDepts((prev) => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
            }
            filterByDepartment(node.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{node.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{node.code}</span>
            </div>
            {node.description && (
              <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{node.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-background/80">
              <Users className="w-2.5 h-2.5 mr-1" />{node.employeeCount}
            </Badge>
            {node.totalTasks > 0 && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{node.avgSuccessRate}%</span>
            )}
          </div>
        </button>
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {node.children!.map((child) => renderDeptNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderOrganization = () => {
    if (deptLoading) {
      return (
        <div className="space-y-4">
          <Card className="border-border/50"><CardContent className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</CardContent></Card>
        </div>
      );
    }

    const tree = buildDeptTree(departments);
    const totalEmps = departments.reduce((sum, d) => sum + d.employeeCount, 0);

    return (
      <motion.div {...fadeIn} className="space-y-6">
        {/* Level Hierarchy Summary */}
        {stats && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Organizational Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                {LEVEL_ORDER.map((lvl, i) => {
                  const found = stats.employeesByLevel.find((l) => l.level === lvl);
                  const count = found?.count || 0;
                  return (
                    <React.Fragment key={lvl}>
                      {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/30">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[i] }} />
                        <div>
                          <p className="text-xs font-semibold capitalize">{lvl}</p>
                          <p className="text-[10px] text-muted-foreground">{count} employees</p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Department Tree */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-400" />
                Department Tree
              </CardTitle>
              <span className="text-xs text-muted-foreground">{departments.length} departments · {totalEmps} employees</span>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-0.5">
                {tree.map((node) => renderDeptNode(node))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ─── Render: Execute ─────────────────────────────────────────────────────────

  const renderExecute = () => (
    <motion.div {...fadeIn} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Form */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Submit Task
            </CardTitle>
            <CardDescription>Create a new task for the AI workforce to execute</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Task Title</Label>
              <Input
                placeholder="e.g., Write Q4 marketing strategy"
                className="bg-background/50"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Describe what you need in detail..."
                className="min-h-[120px] bg-background/50 resize-none"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Task Type</Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Complexity</Label>
                <Select value={taskComplexity} onValueChange={setTaskComplexity}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPLEXITY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={submitTask} disabled={taskSubmitting || !taskTitle.trim() || !taskDesc.trim()}>
              {taskSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing Task...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Submit & Execute</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Task Result */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Task Result
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {taskSubmitting ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-violet-500/20 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-amber-400 animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Routing task to best employee...</p>
                  <p className="text-xs text-muted-foreground mt-1">Analyzing requirements, selecting model, executing</p>
                </div>
                <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-violet-500 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
                </div>
              </div>
            ) : taskResult ? (
              (() => {
                const exec = taskResult.execution as Record<string, unknown> | undefined;
                const assigned = exec?.assignedEmployee as Record<string, unknown> | undefined;
                const resultVal = taskResult.result;
                return (
                  <div className="space-y-4">
                    {/* Execution Info */}
                    {exec && (
                      <div className="p-3 rounded-lg bg-background/50 border border-border/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[(exec.status as string) || 'idle'] || 'bg-slate-500'}`} />
                          <span className="text-xs font-medium">Status: {exec.status as string}</span>
                        </div>
                        {assigned && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[9px] font-bold bg-violet-600 text-white">
                                {getInitials(assigned.name as string)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium">{assigned.name as string}</p>
                              <p className="text-[10px] text-muted-foreground">{assigned.title as string}</p>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                          {exec.modelUsed && <span>Model: {exec.modelUsed as string}</span>}
                          {exec.latencyMs && <span>Latency: {((exec.latencyMs as number) / 1000).toFixed(1)}s</span>}
                        </div>
                      </div>
                    )}

                    {/* Result Content */}
                    {resultVal && typeof resultVal === 'string' ? (
                      <ScrollArea className="max-h-[400px]">
                        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{resultVal}</pre>
                        </div>
                      </ScrollArea>
                    ) : resultVal && typeof resultVal === 'object' ? (
                      <ScrollArea className="max-h-[400px]">
                        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{JSON.stringify(resultVal, null, 2)}</pre>
                        </div>
                      </ScrollArea>
                    ) : null}

                    <Button variant="outline" size="sm" className="w-full" onClick={() => setTaskResult(null)}>
                      Clear Result
                    </Button>
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                  <Play className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Submit a task to see results</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tasks are automatically routed to the best employee</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );

  // ─── Skeleton ────────────────────────────────────────────────────────────────

  const OverviewSkeleton = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/50"><CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-5" /><Skeleton className="h-7 w-16" /><Skeleton className="h-3 w-20" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50"><CardContent className="p-5"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-5"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
      </div>
    </div>
  );

  // ─── Main Render ─────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/80 backdrop-blur-sm border border-border/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Overview
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Users className="w-3.5 h-3.5 mr-1.5" />Employees
            </TabsTrigger>
            <TabsTrigger value="organization" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />Organization
            </TabsTrigger>
            <TabsTrigger value="execute" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Zap className="w-3.5 h-3.5 mr-1.5" />Execute
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {renderOverview()}
          </TabsContent>

          <TabsContent value="employees" className="mt-4">
            {renderEmployees()}
          </TabsContent>

          <TabsContent value="organization" className="mt-4">
            {renderOrganization()}
          </TabsContent>

          <TabsContent value="execute" className="mt-4">
            {renderExecute()}
          </TabsContent>
        </Tabs>

        {renderDetailSheet()}
      </div>
    </TooltipProvider>
  );
}

export default WorkforceView;
