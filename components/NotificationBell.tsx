"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type Notification = {
  id: string;
  league_id: string | null;
  team_id: string | null;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
  link?: string | null;
};

export function NotificationBell() {
  const { selectedLeagueId } = useLeague();
  const { refreshKey } = useRefresh();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const url = selectedLeagueId
        ? `/api/notifications?leagueId=${selectedLeagueId}`
        : "/api/notifications";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const visibleInterval = 30000;
    const hiddenInterval = 60000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const schedulePoll = () => {
      if (intervalId) clearInterval(intervalId);
      const ms = typeof document !== "undefined" && document.visibilityState === "visible"
        ? visibleInterval
        : hiddenInterval;
      intervalId = setInterval(fetchNotifications, ms);
    };

    schedulePoll();
    const handleVisibility = () => {
      fetchNotifications();
      schedulePoll();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [selectedLeagueId, refreshKey]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const groupedByType = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    for (const n of notifications) {
      const key = n.type || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    }
    const order = ["trade", "matchday", "registration", "draft", "auction", "other"];
    const sorted: { type: string; items: Notification[] }[] = [];
    for (const t of order) {
      if (groups[t]?.length) sorted.push({ type: t, items: groups[t] });
    }
    for (const t of Object.keys(groups)) {
      if (!order.includes(t)) sorted.push({ type: t, items: groups[t] });
    }
    return sorted;
  }, [notifications]);

  const typeLabel = (t: string) => {
    const labels: Record<string, string> = {
      trade: "Trades",
      matchday: "Matchday",
      registration: "Registration",
      draft: "Draft",
      auction: "Auctions",
      other: "Other",
    };
    return labels[t] || t.charAt(0).toUpperCase() + t.slice(1);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5 border-b">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-[280px]">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">You&apos;ll see trades, matchday updates, and more here.</p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                <Link href="/main/dashboard/trades" className="text-xs text-primary hover:underline">Trades</Link>
                <span className="text-muted-foreground">·</span>
                <Link href="/main/dashboard/schedule" className="text-xs text-primary hover:underline">Schedule</Link>
              </div>
            </div>
          ) : (
            <div className="py-1">
              {groupedByType.map(({ type, items }) => (
                <div key={type} className="py-1">
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {typeLabel(type)}
                  </p>
                  {items.map((n) => {
                const content = (
                  <>
                    <div className="flex w-full justify-between gap-2">
                      <span className="font-medium text-sm">{n.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                    {n.message && (
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {n.message}
                      </span>
                    )}
                  </>
                );
                return n.link ? (
                  <DropdownMenuItem key={n.id} asChild>
                    <Link
                      href={n.link}
                      className={`flex flex-col items-start gap-0.5 cursor-pointer py-3 ${!n.read ? "bg-muted/50" : ""}`}
                      onClick={() => {
                        setOpen(false);
                        if (!n.read) handleMarkRead(n.id);
                      }}
                    >
                      {content}
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={n.id}
                    className={`flex flex-col items-start gap-0.5 cursor-pointer py-3 ${!n.read ? "bg-muted/50" : ""}`}
                    onClick={() => !n.read && handleMarkRead(n.id)}
                  >
                    {content}
                  </DropdownMenuItem>
                );
              })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
