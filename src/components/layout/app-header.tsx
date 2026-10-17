"use client";

import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/stores/app-store";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useEffect, useState } from "react";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { activeView } = useAppStore();
  const { setTheme, theme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get<{ data: number }>("/api/notifications?isRead=false&limit=1")
      .then((res) => {
        if (Array.isArray(res?.data)) setUnreadCount(res.data.length);
        else if (typeof res?.data === "number") setUnreadCount(res.data);
      })
      .catch(() => {});
  }, [user]);

  const viewLabels: Record<string, string> = {
    dashboard: "Dashboard",
    students: "Students",
    employees: "Employees",
    departments: "Departments",
    programs: "Programs",
    attendance: "Attendance",
    assignments: "Assignments",
    exams: "Exams & Results",
    schedule: "Class Schedule",
    finance: "Finance Overview",
    fees: "Fee Management",
    salary: "Payroll",
    hrm: "HR Management",
    leave: "Leave Management",
    announcements: "Announcements",
    messages: "Messages",
    partners: "Partners",
    "ai-command": "AI Assistant",
    "market-intelligence": "Market Intelligence",
    feeds: "News Feeds",
    "audit-logs": "Audit Logs",
    settings: "Settings",
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border px-4 bg-white">
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1">
        <h1 className="text-sm font-semibold">{viewLabels[activeView] || "Dashboard"}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative"
          onClick={() => useAppStore.getState().setActiveView("announcements")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0057B8] text-white text-[10px] font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-xs">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="mt-1 text-[10px] capitalize">
                {user?.role}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
