"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, Loader2, Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mos_token");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function typeIcon(type: string): string {
  if (type.startsWith("deal.won")) return "🎉";
  if (type.startsWith("deal.")) return "🤝";
  if (type.startsWith("lead.")) return "👤";
  if (type.startsWith("ticket.")) return "🎫";
  if (type.startsWith("campaign.")) return "📣";
  if (type.startsWith("content.")) return "📝";
  if (type.startsWith("message.")) return "💬";
  if (type.startsWith("announcement.")) return "📢";
  if (type.startsWith("seo.")) return "🔍";
  return "🔔";
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Starts true because the first request is issued on mount — this replaces the
  // old synchronous `setIsLoading(true)` that ran while the effect was executing.
  const [isLoading, setIsLoading] = useState(true);
  // Guards against overlapping polls when a request outlives the 30s interval.
  const inFlightRef = useRef(false);

  /**
   * Loads notifications. Every state update happens after an `await`, so this
   * is safe to call directly from an effect. Responses belonging to an aborted
   * request are discarded, which also covers unmount.
   */
  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/notifications?limit=20", {
        headers: authHeaders(),
        signal,
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      if (signal?.aborted) return;
      setItems(json.data || []);
      setUnreadCount(json.unreadCount || 0);
    } catch {
      // Silent fail — notifications are not critical
    } finally {
      inFlightRef.current = false;
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  /** Manual refresh from an event handler — shows the spinner immediately. */
  const refreshNotifications = useCallback(() => {
    setIsLoading(true);
    void loadNotifications();
  }, [loadNotifications]);

  // Fetch on mount + poll every 30 seconds
  useEffect(() => {
    const controller = new AbortController();
    // Dispatched inside an async scope so the effect body itself performs no
    // state update; every setState in the loader runs after the response awaits.
    void (async () => {
      await loadNotifications(controller.signal);
    })();
    const interval = setInterval(() => {
      void loadNotifications(controller.signal);
    }, 30000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [loadNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notifications-dropdown]")) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Marked all as read");
      refreshNotifications();
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      refreshNotifications();
    } catch {
      // Silent
    }
  };

  const handleClick = async (item: NotificationItem) => {
    if (!item.isRead) await handleMarkOneRead(item.id);
    setOpen(false);
    if (item.link) {
      // Navigate via window.location since we use a single-page view-switcher
      // For now, route to the link if it's a separate page (rare)
      // Most internal links are view names so we just close
    }
  };

  return (
    <div className="relative" data-notifications-dropdown>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refreshNotifications();
        }}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>

            <ScrollArea className="max-h-[400px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">No notifications yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">You&apos;ll see updates here when leads, deals, or tickets change</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleClick(item)}
                      className={`w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors flex gap-3 items-start ${
                        !item.isRead ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="text-lg shrink-0">{typeIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium leading-tight">{item.title}</p>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {item.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {items.length > 0 && (
              <div className="border-t border-border px-4 py-2 text-center bg-muted/20">
                <p className="text-[10px] text-muted-foreground">Polling every 30s · {items.length} total</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
