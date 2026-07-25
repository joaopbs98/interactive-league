"use client";

import {
  LayoutDashboard,
  Target,
  BarChart3,
  Grid3X3,
  Users,
  FileText,
  HeartPulse,
  GitCompare,
  Trophy,
  Calendar,
  Award,
  History,
  PenSquare,
  UserPlus,
  ShieldCheck,
  Gamepad2,
  Wallet,
  ArrowLeftRight,
  Handshake,
  Building2,
  Banknote,
  Database,
  Package,
  List,
  Gavel,
  ArrowRightLeft,
  ScrollText,
  LogOut,
  Settings,
  Shield,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { signOut } from "@/actions/auth";
import { useRouter, usePathname } from "next/navigation";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const sidebarSections = [
  {
    section: "Overview",
    items: [
      { title: "Season Overview", icon: LayoutDashboard, url: "/main/dashboard" },
      { title: "Objectives", icon: Target, url: "/main/dashboard/objectives" },
      { title: "CompIndex", icon: BarChart3, url: "/main/dashboard/compindex" },
    ],
  },
  {
    section: "Team Management",
    items: [
      { title: "Tactics & Formation", icon: Grid3X3, url: "/main/dashboard/tactics" },
      { title: "Squad", icon: Users, url: "/main/dashboard/squad" },
      { title: "Contracts", icon: FileText, url: "/main/dashboard/contracts" },
      { title: "Injuries & Suspensions", icon: HeartPulse, url: "/main/dashboard/injuries" },
    ],
  },
  {
    section: "League",
    items: [
      { title: "Team Comparison", icon: GitCompare, url: "/main/dashboard/team-comparison" },
      { title: "Standings", icon: Trophy, url: "/main/dashboard/standings" },
      { title: "Schedule", icon: Calendar, url: "/main/dashboard/schedule" },
      { title: "Hall of Fame", icon: Award, url: "/main/dashboard/hof" },
      { title: "History & Stats", icon: History, url: "/main/dashboard/stats" },
      { title: "Insert Results", icon: PenSquare, url: "/main/dashboard/insert-results" },
      { title: "Add Player", icon: UserPlus, url: "/main/dashboard/add-player" },
      { title: "Host Controls", icon: ShieldCheck, url: "/main/dashboard/host-controls" },
      { title: "EAFC Setup", icon: Gamepad2, url: "/main/dashboard/eafc-setup" },
    ],
  },
  {
    section: "Bank & Balance",
    items: [
      { title: "Financial Overview", icon: Wallet, url: "/main/dashboard/finances" },
      { title: "Transactions", icon: ArrowLeftRight, url: "/main/dashboard/transactions" },
      { title: "Sponsors", icon: Handshake, url: "/main/dashboard/sponsors" },
      { title: "Stadium", icon: Building2, url: "/main/dashboard/stadium" },
      { title: "Loans", icon: Banknote, url: "/main/dashboard/loans" },
    ],
  },
  {
    section: "Transfer Hub",
    items: [
      { title: "Transfer History", icon: ScrollText, url: "/main/dashboard/transfer-history" },
      { title: "Players Database", icon: Database, url: "/main/dashboard/players-database" },
      { title: "Packs", icon: Package, url: "/main/dashboard/packs" },
      { title: "Draft", icon: Users, url: "/main/dashboard/draft" },
      { title: "Free Agents", icon: UserPlus, url: "/main/dashboard/freeagents" },
      { title: "Transfer List", icon: List, url: "/main/dashboard/transfer-list" },
      { title: "Auctions", icon: Gavel, url: "/main/dashboard/auctions" },
      { title: "Trades", icon: ArrowRightLeft, url: "/main/dashboard/trades" },
    ],
  },
];

function SidebarUser() {
  const [userName, setUserName] = useState<string>("");
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json();
        if (data.success && data.profile) {
          const name =
            data.profile.full_name || data.profile.username || "User";
          setUserName(name);
        }
      } catch {
        setUserName("User");
      }
    };
    load();
  }, []);
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <Avatar className="w-7 h-7 rounded-full border border-border" />
      <span className="text-sm font-medium text-foreground truncate">
        {userName || "User"}
      </span>
    </div>
  );
}

/** Small stat chip used for balance / rank, with a brief accent flash on change */
function StatChip({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const prevValue = useRef<string | null>(null);

  useEffect(() => {
    if (prevValue.current !== null && prevValue.current !== value && !loading) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
    prevValue.current = value;
  }, [value, loading]);

  return (
    <div className="flex-1 rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <div className="h-3.5 w-10 mt-1 rounded bg-surface-3 animate-pulse" />
      ) : (
        <p className={cn("text-sm font-semibold tabular-nums text-foreground", flash && "value-flash")}>
          {value}
        </p>
      )}
    </div>
  );
}

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedLeagueId, selectedTeam } = useLeague();
  const { refreshKey } = useRefresh();
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [pendingTradesCount, setPendingTradesCount] = useState(0);

  // Fetch pending trades count when team is selected or refresh triggered
  useEffect(() => {
    const fetchPendingTrades = async () => {
      if (!selectedTeam?.id) {
        setPendingTradesCount(0);
        return;
      }
      try {
        const res = await fetch(`/api/trades?teamId=${selectedTeam.id}`);
        const data = await res.json();
        setPendingTradesCount(data.pendingCount ?? 0);
      } catch {
        setPendingTradesCount(0);
      }
    };
    fetchPendingTrades();
  }, [selectedTeam?.id, refreshKey]);

  // Fetch balance when team is selected or refresh triggered
  useEffect(() => {
    const fetchBalance = async () => {
      if (!selectedTeam?.id) {
        setBalance(null);
        return;
      }

      setBalanceLoading(true);
      try {
        const response = await fetch(
          `/api/balance?teamId=${selectedTeam.id}&_t=${refreshKey}`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          setBalance(data.data?.availableBalance ?? data.data?.totalBudget ?? selectedTeam.budget ?? 0);
        } else {
          setBalance(selectedTeam.budget ?? 0);
        }
      } catch (error) {
        setBalance(selectedTeam.budget ?? 0);
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [selectedTeam?.id, refreshKey]);

  // Fetch rank when team/league selected or refresh triggered
  useEffect(() => {
    const fetchRank = async () => {
      if (!selectedTeam?.id || !selectedLeagueId) {
        setRank(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/league/standings/rank?leagueId=${selectedLeagueId}&teamId=${selectedTeam.id}`
        );
        const data = await res.json();
        setRank(data.rank ?? null);
      } catch {
        setRank(null);
      }
    };
    fetchRank();
  }, [selectedTeam?.id, selectedLeagueId, refreshKey]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const balanceDisplay =
    balance !== null ? `${(balance / 1000000).toFixed(1)}M` : "—";
  const rankDisplay = rank != null ? `#${rank}` : "—";

  return (
    <Sidebar collapsible="icon" className="flex flex-col">
      <div className="flex flex-col gap-3 p-3 border-b border-sidebar-border text-sidebar-foreground group-data-[collapsible=icon]:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => router.push("/saves")}
            className="group/identity flex items-center gap-2 min-w-0 text-left"
          >
            <div className="h-8 w-8 rounded-md overflow-hidden bg-surface-2 border border-border-strong flex items-center justify-center shrink-0">
              {selectedTeam?.logo_url ? (
                <img src={selectedTeam.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Shield className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-display text-base leading-tight truncate group-hover/identity:text-accent transition-colors duration-150">
                {selectedTeam?.name || "Your Club"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {selectedTeam?.leagues?.name || "Switch save"}
              </p>
            </div>
          </button>
          <div className="shrink-0">
            <NotificationBell />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatChip label="Balance" value={balanceDisplay} loading={balanceLoading} />
          <StatChip label="Rank" value={rankDisplay} />
        </div>
      </div>
      <SidebarContent className="flex-1 text-sidebar-foreground">
        <ScrollArea className="h-full">
          {sidebarSections.map((section) => (
            <SidebarGroup key={section.section}>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                {section.section}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const isActive = pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <button
                            onClick={() => {
                              const url = `${item.url}${selectedLeagueId ? `?league=${selectedLeagueId}` : ''}`;
                              router.push(url);
                            }}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md w-full text-left transition-colors duration-150",
                              "hover:bg-surface-2",
                              isActive
                                ? "edge-bar [--edge-color:var(--accent)] bg-accent-muted text-accent"
                                : "text-muted-foreground"
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.title}</span>
                            {item.title === "Trades" && pendingTradesCount > 0 && (
                              <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-status-negative text-[10px] font-medium text-background">
                                {pendingTradesCount > 9 ? "9+" : pendingTradesCount}
                              </span>
                            )}
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>

      <div className="p-3 border-t border-sidebar-border text-sidebar-foreground group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
        <div className="flex items-center justify-between mb-3 group-data-[collapsible=icon]:hidden">
          <SidebarUser />
          <button
            onClick={() => router.push("/main/dashboard/settings")}
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors duration-150"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="group-data-[collapsible=icon]:mt-0">
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="w-full justify-center border-border bg-surface-2 text-muted-foreground hover:bg-status-negative/15 hover:text-status-negative hover:border-status-negative/40 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </Sidebar>
  );
}
