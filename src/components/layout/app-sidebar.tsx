"use client";

import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/stores/app-store";
import type { ViewId } from "@/types";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  Clock,
  DollarSign,
  Receipt,
  CreditCard,
  Briefcase,
  PlaneTakeoff,
  Megaphone,
  MessageSquare,
  Handshake,
  Bot,
  Settings,
  Shield,
  School,
  Sparkles,
  Zap,
  Phone,
  GitBranch,
  Search,
  Activity,
  BarChart3,
  Boxes,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["*"] },
  { id: "free-ai-hub", label: "Free AI Agent Hub", icon: Zap, roles: ["*"] },
  { id: "knowledge-wiki", label: "Knowledge Wiki & RAG", icon: BookOpen, roles: ["*"] },
  { id: "marketing-studio", label: "Marketing Studio", icon: Sparkles, roles: ["*"] },
  { id: "crm", label: "CRM & Enrichment", icon: Users, roles: ["*"] },
  { id: "seo", label: "SEO & Live Crawler", icon: Search, roles: ["*"] },
  { id: "market-intelligence", label: "Market Intelligence", icon: Activity, roles: ["*"] },
  { id: "outreach-hub", label: "SMS, VoIP & Scraper", icon: Phone, roles: ["*"] },
  { id: "workflow-studio", label: "Workflow Studio", icon: GitBranch, roles: ["*"] },
  { id: "agency-console", label: "Agency Console", icon: Building2, roles: ["*"] },
  { id: "ecosystem", label: "Ecosystem Library", icon: Boxes, roles: ["*"] },
  { id: "analytics", label: "Analytics & UTM", icon: BarChart3, roles: ["*"] },
  { id: "ukvi-hub", label: "Study Abroad & UKVI", icon: GraduationCap, roles: ["*"] },
  { id: "students", label: "Students", icon: GraduationCap, roles: ["admin", "teacher"] },
  { id: "employees", label: "Employees", icon: Users, roles: ["admin"] },
  { id: "departments", label: "Departments", icon: School, roles: ["admin"] },
  { id: "programs", label: "Programs", icon: BookOpen, roles: ["admin", "teacher"] },
  { id: "attendance", label: "Attendance", icon: CalendarCheck, roles: ["admin", "teacher"] },
  { id: "assignments", label: "Assignments", icon: ClipboardList, roles: ["admin", "teacher", "student"] },
  { id: "exams", label: "Exams & Results", icon: FileText, roles: ["admin", "teacher", "student"] },
  { id: "schedule", label: "Class Schedule", icon: Clock, roles: ["admin", "teacher", "student"] },
  { id: "finance", label: "Finance", icon: DollarSign, roles: ["admin", "accountant"] },
  { id: "fees", label: "Fee Management", icon: Receipt, roles: ["admin", "accountant", "student"] },
  { id: "salary", label: "Payroll", icon: CreditCard, roles: ["admin", "accountant"] },
  { id: "hrm", label: "HR Management", icon: Briefcase, roles: ["admin"] },
  { id: "leave", label: "Leave Management", icon: PlaneTakeoff, roles: ["admin", "teacher", "employee"] },
  { id: "announcements", label: "Announcements", icon: Megaphone, roles: ["*"] },
  { id: "messages", label: "Messages", icon: MessageSquare, roles: ["*"] },
  { id: "partners", label: "Partners", icon: Handshake, roles: ["admin"] },
  { id: "ai-command", label: "AI Assistant", icon: Bot, roles: ["*"] },
  { id: "audit-logs", label: "Audit Logs", icon: Shield, roles: ["admin", "super_admin"] },
  { id: "settings", label: "Settings", icon: Settings, roles: ["admin", "super_admin"] },
];

export function AppSidebar() {
  const { user } = useAuth();
  const { activeView, setActiveView } = useAppStore();
  const userRole = user?.role || "";

  const filteredItems = NAV_ITEMS.filter(
    (item) => item.roles.includes("*") || item.roles.includes(userRole)
  );

  const sections = [
    { label: "Overview", items: filteredItems.filter((i) => ["dashboard", "agency-console", "free-ai-hub", "knowledge-wiki"].includes(i.id)) },
    { label: "Marketing & Outreach", items: filteredItems.filter((i) => ["marketing-studio", "crm", "seo", "market-intelligence", "outreach-hub", "workflow-studio", "ecosystem", "analytics"].includes(i.id)) },
    { label: "Academic & UKVI", items: filteredItems.filter((i) => ["ukvi-hub", "students", "employees", "departments", "programs", "attendance", "assignments", "exams", "schedule"].includes(i.id)) },
    { label: "Finance & HR", items: filteredItems.filter((i) => ["finance", "fees", "salary", "hrm", "leave"].includes(i.id)) },
    { label: "Communication", items: filteredItems.filter((i) => ["announcements", "messages", "partners"].includes(i.id)) },
    { label: "System", items: filteredItems.filter((i) => ["ai-command", "audit-logs", "settings"].includes(i.id)) },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0057B8] text-white font-bold text-sm">
            ALO
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">ALO Education</span>
            <span className="text-[10px] text-muted-foreground">Management System</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map(
          (section) =>
            section.items.length > 0 && (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
                  {section.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setActiveView(item.id)}
                            tooltip={item.label}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
        )}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF3FF] text-[#0057B8] text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="text-xs font-medium truncate">{user.name}</span>
              <span className="text-[10px] text-muted-foreground truncate capitalize">{user.role}</span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
