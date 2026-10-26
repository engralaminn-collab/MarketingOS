'use client';

import React, { lazy, Suspense, useEffect } from 'react';
import Image from 'next/image';
import { ThemeProvider } from 'next-themes';
import { useAppStore, type ViewId } from '@/stores/app-store';
import { LoginView } from '@/components/views/login-view';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationsBell } from '@/components/notifications-bell';
import { CommandPalette } from '@/components/command-palette';
import {
  LayoutDashboard,
  Link2,
  Bot,
  Palette,
  Users,
  Search,
  Megaphone,
  FileText,
  BarChart3,
  UserCog,
  Cpu,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  Zap,
  Menu,
  X,
  Bell,
  Network,
  Plug,
  Sparkles,
  Rss,
  Activity,
  BookOpen,
  Phone,
  GitBranch,
  GraduationCap,
  School,
  CalendarCheck,
  ClipboardList,
  Clock,
  DollarSign,
  Receipt,
  Briefcase,
  PlaneTakeoff,
  Handshake,
  Boxes,
  Building2,
} from 'lucide-react';

// Lazy load views
const DashboardView = lazy(() => import('@/components/views/dashboard-view').then(m => ({ default: m.DashboardView })));
const SocialAccountsView = lazy(() => import('@/components/views/social-accounts-view').then(m => ({ default: m.SocialAccountsView })));
const AiCommandView = lazy(() => import('@/components/views/ai-command-view').then(m => ({ default: m.AiCommandView })));
const MediaStudioView = lazy(() => import('@/components/views/media-studio-view').then(m => ({ default: m.MediaStudioView })));
const CrmView = lazy(() => import('@/components/views/crm-view').then(m => ({ default: m.CrmView })));
const SeoView = lazy(() => import('@/components/views/seo-view').then(m => ({ default: m.SeoView })));
const MarketIntelligenceView = lazy(() => import('@/components/views/market-intelligence-view'));
const CampaignsView = lazy(() => import('@/components/views/campaigns-view').then(m => ({ default: m.CampaignsView })));
const ContentView = lazy(() => import('@/components/views/content-view').then(m => ({ default: m.ContentView })));
const FeedsView = lazy(() => import('@/components/views/feeds-view'));
const MarketingStudioView = lazy(() => import('@/components/views/marketing-studio-view').then(m => ({ default: m.MarketingStudioView })));
const AnalyticsView = lazy(() => import('@/components/views/analytics-view').then(m => ({ default: m.AnalyticsView })));
const TeamView = lazy(() => import('@/components/views/team-view').then(m => ({ default: m.TeamView })));
const WorkforceView = lazy(() => import('@/components/views/workforce-view').then(m => ({ default: m.WorkforceView })));
const AiAgentsView = lazy(() => import('@/components/views/ai-agents-view').then(m => ({ default: m.AiAgentsView })));
const SettingsView = lazy(() => import('@/components/views/settings-view').then(m => ({ default: m.SettingsView })));
const IntegrationsView = lazy(() => import('@/components/views/integrations-view').then(m => ({ default: m.IntegrationsView })));
const MessagesView = lazy(() => import('@/components/views/messages-view'));
const AnnouncementsView = lazy(() => import('@/components/views/announcements-view'));
const AuditLogsView = lazy(() => import('@/components/views/audit-logs-view'));
const StudentsView = lazy(() => import('@/components/views/students-view'));
const EmployeesView = lazy(() => import('@/components/views/employees-view'));
const DepartmentsView = lazy(() => import('@/components/views/departments-view'));
const ProgramsView = lazy(() => import('@/components/views/programs-view'));
const AttendanceView = lazy(() => import('@/components/views/attendance-view'));
const AssignmentsView = lazy(() => import('@/components/views/assignments-view'));
const ExamsView = lazy(() => import('@/components/views/exams-view'));
const ScheduleView = lazy(() => import('@/components/views/schedule-view'));
const FinanceView = lazy(() => import('@/components/views/finance-view'));
const FeesView = lazy(() => import('@/components/views/fees-view'));
const SalaryView = lazy(() => import('@/components/views/salary-view'));
const HrmView = lazy(() => import('@/components/views/hrm-view'));
const LeaveView = lazy(() => import('@/components/views/leave-view'));
const PartnersView = lazy(() => import('@/components/views/partners-view'));
const FreeAiHubView = lazy(() => import('@/components/views/free-ai-hub-view'));
const KnowledgeWikiView = lazy(() => import('@/components/views/knowledge-wiki-view'));
const OutreachHubView = lazy(() => import('@/components/views/outreach-hub-view'));
const WorkflowStudioView = lazy(() => import('@/components/views/workflow-studio-view'));
const UkviHubView = lazy(() => import('@/components/views/ukvi-hub-view'));
const EcosystemView = lazy(() => import('@/components/views/ecosystem-view').then(m => ({ default: m.EcosystemView })));
const AgencyConsoleView = lazy(() => import('@/components/views/agency-console-view').then(m => ({ default: m.AgencyConsoleView })));

const views: Record<ViewId, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: DashboardView,
  workforce: WorkforceView,
  'social-accounts': SocialAccountsView,
  'ai-command': AiCommandView,
  'media-studio': MediaStudioView,
  crm: CrmView,
  seo: SeoView,
  'market-intelligence': MarketIntelligenceView,
  campaigns: CampaignsView,
  content: ContentView,
  feeds: FeedsView,
  'marketing-studio': MarketingStudioView,
  analytics: AnalyticsView,
  team: TeamView,
  messages: MessagesView,
  announcements: AnnouncementsView,
  'audit-logs': AuditLogsView,
  'ai-agents': AiAgentsView,
  'free-ai-hub': FreeAiHubView,
  'knowledge-wiki': KnowledgeWikiView,
  'outreach-hub': OutreachHubView,
  'workflow-studio': WorkflowStudioView,
  'ukvi-hub': UkviHubView,
  ecosystem: EcosystemView,
  'agency-console': AgencyConsoleView,
  integrations: IntegrationsView,
  subscriptions: SettingsView,
  settings: SettingsView,
  students: StudentsView,
  employees: EmployeesView,
  departments: DepartmentsView,
  programs: ProgramsView,
  attendance: AttendanceView,
  assignments: AssignmentsView,
  exams: ExamsView,
  schedule: ScheduleView,
  finance: FinanceView,
  fees: FeesView,
  salary: SalaryView,
  hrm: HrmView,
  leave: LeaveView,
  partners: PartnersView,
};

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'CEO Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, section: 'Main' },
  { id: 'workforce', label: 'AI Workforce', icon: <Network className="w-4 h-4" />, badge: '2,000', section: 'Workforce' },
  { id: 'workflow-studio', label: 'Workflow Studio', icon: <GitBranch className="w-4 h-4" />, badge: 'n8n', section: 'Workforce' },
  { id: 'agency-console', label: 'Agency Console', icon: <Building2 className="w-4 h-4" />, badge: '100·2K', section: 'Workforce' },
  { id: 'ecosystem', label: 'Ecosystem Library', icon: <Boxes className="w-4 h-4" />, badge: '190', section: 'Connect' },
  { id: 'integrations', label: 'Integrations', icon: <Plug className="w-4 h-4" />, badge: '116', section: 'Connect' },
  { id: 'social-accounts', label: 'Social Accounts', icon: <Link2 className="w-4 h-4" />, badge: 'OAuth', section: 'Connect' },
  { id: 'outreach-hub', label: 'SMS, VoIP & Scraper', icon: <Phone className="w-4 h-4" />, badge: 'Live', section: 'Connect' },
  { id: 'free-ai-hub', label: 'Free AI Agent Hub', icon: <Zap className="w-4 h-4" />, badge: '17 Free', section: 'AI' },
  { id: 'ai-command', label: 'AI Command', icon: <Bot className="w-4 h-4" />, section: 'AI' },
  { id: 'knowledge-wiki', label: 'Knowledge Wiki & RAG', icon: <BookOpen className="w-4 h-4" />, badge: 'Wiki', section: 'AI' },
  { id: 'media-studio', label: 'Media Studio', icon: <Palette className="w-4 h-4" />, section: 'AI' },
  { id: 'ai-agents', label: 'AI Agents', icon: <Cpu className="w-4 h-4" />, section: 'AI' },
  { id: 'marketing-studio', label: 'Marketing Studio', icon: <Sparkles className="w-4 h-4" />, badge: '61 Kits', section: 'Marketing' },
  { id: 'crm', label: 'CRM & Enrichment', icon: <Users className="w-4 h-4" />, section: 'Marketing' },
  { id: 'seo', label: 'SEO & Live Crawler', icon: <Search className="w-4 h-4" />, section: 'Marketing' },
  { id: 'market-intelligence', label: 'Market Intelligence', icon: <Activity className="w-4 h-4" />, section: 'Marketing' },
  { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="w-4 h-4" />, section: 'Marketing' },
  { id: 'content', label: 'Content & Queue', icon: <FileText className="w-4 h-4" />, section: 'Marketing' },
  { id: 'feeds', label: 'News Feeds', icon: <Rss className="w-4 h-4" />, section: 'Marketing' },
  { id: 'ukvi-hub', label: 'Study Abroad & UKVI', icon: <GraduationCap className="w-4 h-4" />, badge: 'CAS', section: 'Academic & UKVI' },
  { id: 'students', label: 'Students', icon: <GraduationCap className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'programs', label: 'Programs & Courses', icon: <BookOpen className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'departments', label: 'Departments', icon: <School className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'assignments', label: 'Assignments', icon: <ClipboardList className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'exams', label: 'Exams & Results', icon: <FileText className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'schedule', label: 'Class Schedule', icon: <Clock className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'partners', label: 'University Partners', icon: <Handshake className="w-4 h-4" />, section: 'Academic & UKVI' },
  { id: 'finance', label: 'Finance & Ledger', icon: <DollarSign className="w-4 h-4" />, section: 'ERP, Finance & HR' },
  { id: 'fees', label: 'Fee Management', icon: <Receipt className="w-4 h-4" />, section: 'ERP, Finance & HR' },
  { id: 'salary', label: 'Payroll & Salary', icon: <CreditCard className="w-4 h-4" />, section: 'ERP, Finance & HR' },
  { id: 'employees', label: 'Employees', icon: <Users className="w-4 h-4" />, section: 'ERP, Finance & HR' },
  { id: 'hrm', label: 'HR Management', icon: <Briefcase className="w-4 h-4" />, section: 'ERP, Finance & HR' },
  { id: 'leave', label: 'Leave Requests', icon: <PlaneTakeoff className="w-4 h-4" />, section: 'ERP, Finance & HR' },
  { id: 'analytics', label: 'Analytics & UTM', icon: <BarChart3 className="w-4 h-4" />, section: 'Reports' },
  { id: 'messages', label: 'Messages', icon: <Bell className="w-4 h-4" />, section: 'Reports' },
  { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" />, section: 'Reports' },
  { id: 'audit-logs', label: 'Audit Logs', icon: <FileText className="w-4 h-4" />, section: 'Reports' },
  { id: 'team', label: 'Team', icon: <UserCog className="w-4 h-4" />, section: 'Management' },
  { id: 'subscriptions', label: 'Subscription', icon: <CreditCard className="w-4 h-4" />, section: 'Management' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, section: 'Management' },
];

const sections = ['Main', 'Workforce', 'Connect', 'AI', 'Marketing', 'Academic & UKVI', 'ERP, Finance & HR', 'Reports', 'Management'];

function ViewFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading view...</p>
      </div>
    </div>
  );
}

function Sidebar() {
  const { user, activeView, setActiveView, isSidebarOpen, toggleSidebar, setSidebarOpen, logout } = useAppStore();

  const handleNavClick = (id: ViewId) => {
    setActiveView(id);
    // Close sidebar on mobile
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-full flex flex-col
        bg-card border-r border-border/50
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'w-64' : 'w-[70px]'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border/50 shrink-0">
          <Image
            src="/kexsio-logo.png"
            alt="Kexsio MarketingOS"
            width={36}
            height={36}
            className="rounded-lg shrink-0"
            priority
          />
          {isSidebarOpen && (
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent whitespace-nowrap">
              Kexsio MarketingOS
            </span>
          )}
          <Button variant="ghost" size="icon" className="ml-auto md:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3 px-2">
          <div className="space-y-1">
            {sections.map((section) => {
              const sectionItems = navItems.filter(n => n.section === section);
              if (sectionItems.length === 0) return null;
              return (
                <div key={section} className="mb-3">
                  {isSidebarOpen && (
                    <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {section}
                    </p>
                  )}
                  {sectionItems.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <Tooltip key={item.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleNavClick(item.id)}
                            className={`
                              w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                              transition-all duration-200 group relative
                              ${isActive
                                ? 'bg-gradient-to-r from-primary/15 to-chart-2/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                              }
                              ${!isSidebarOpen ? 'justify-center px-0' : ''}
                            `}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                            )}
                            <span className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                              {item.icon}
                            </span>
                            {isSidebarOpen && (
                              <span className="flex-1 text-left truncate">{item.label}</span>
                            )}
                            {isSidebarOpen && item.badge && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                                {item.badge}
                              </Badge>
                            )}
                          </button>
                        </TooltipTrigger>
                        {!isSidebarOpen && (
                          <TooltipContent side="right" className="font-medium">
                            {item.label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Collapse button */}
        <div className="hidden md:flex px-2 py-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={toggleSidebar}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${!isSidebarOpen ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </aside>
    </>
  );
}

function AppHeader() {
  const { user, activeView, setSidebarOpen, logout } = useAppStore();
  const currentNav = navItems.find(n => n.id === activeView);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 border-b border-border/50 bg-background ">
      <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setSidebarOpen(true)}>
        <Menu className="w-5 h-5" />
      </Button>

      {currentNav && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{currentNav.icon}</span>
          <h1 className="font-semibold text-lg">{currentNav.label}</h1>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Cmd+K command palette trigger */}
        <CommandPalette />

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <NotificationsBell />
            </div>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-to-br from-primary to-chart-2 text-white text-xs font-bold">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign Out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function AppContent() {
  const { activeView, isSidebarOpen } = useAppStore();
  const ActiveComponent = views[activeView];

  return (
    <div className={`flex h-screen bg-background transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-[70px]'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <ScrollArea className="flex-1">
          <main className="p-4 md:p-6">
            <Suspense fallback={<ViewFallback />}>
              {ActiveComponent ? <ActiveComponent /> : <p className="text-muted-foreground">View not found</p>}
            </Suspense>
          </main>
        </ScrollArea>
        <footer className="mt-auto shrink-0 border-t px-4 py-2 text-center text-[10px] text-muted-foreground bg-card">
          Kexsio MarketingOS — AI-Powered Marketing Operating System
        </footer>
      </div>
    </div>
  );
}

function AppShell() {
  const { isAuthenticated, isLoading, setUser, setInstitution } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem('mos_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser({ ...data.user, token });
          } else {
            localStorage.removeItem('mos_token');
            setUser(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('mos_token');
          setUser(null);
        });
    } else {
      setUser(null);
    }
  }, [setUser]);

  // Load the active institution once authenticated. The Academic & HRM views
  // read institution.id when creating records, so without this they cannot
  // submit. A 404 simply means no institution has been set up yet, which the
  // views already handle by prompting the user.
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('mos_token');
    if (!token) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/institution', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        if (controller.signal.aborted) return;
        const inst = json?.data;
        if (inst?.id) {
          setInstitution({
            id: inst.id,
            name: inst.name ?? '',
            shortName: inst.shortName ?? inst.name ?? '',
          });
        }
      } catch {
        // Offline or not configured — the views handle a null institution.
      }
    })();
    return () => controller.abort();
  }, [isAuthenticated, setInstitution]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/kexsio-logo.png"
            alt="Kexsio MarketingOS"
            width={64}
            height={64}
            className="rounded-xl animate-pulse"
            priority
          />
          <p className="text-sm text-muted-foreground">Loading Kexsio MarketingOS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginView />;
  return <AppContent />;
}

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AppShell />
    </ThemeProvider>
  );
}
