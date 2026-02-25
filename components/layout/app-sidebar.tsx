"use client";

import {
  Shield,
  Users,
  Trophy,
  Banknote,
  Shuffle,
  LogOut,
  Settings,
  Gamepad2,
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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { signOut } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { useEffect, useState } from "react";

const sidebarSections = [
  {
    section: "Overview",
    items: [
      { title: "Season Overview", icon: Shield, url: "/main/dashboard" },
      { title: "CompIndex", icon: Shield, url: "/main/dashboard/compindex" },
    ],
  },
  {
    section: "Team Management",
    items: [
      {
        title: "Tactics & Formation",
        icon: Users,
        url: "/main/dashboard/tactics",
      },
      { title: "Squad", icon: Users, url: "/main/dashboard/squad" },
      { title: "Contracts", icon: Users, url: "/main/dashboard/contracts" },
      {
        title: "Injuries & Suspensions",
        icon: Users,
        url: "/main/dashboard/injuries",
      },
    ],
  },
  {
    section: "League",
    items: [
      { title: "Standings", icon: Trophy, url: "/main/dashboard/standings" },
      { title: "Schedule", icon: Trophy, url: "/main/dashboard/schedule" },
      { title: "Hall of Fame", icon: Trophy, url: "/main/dashboard/hof" },
      { title: "History & Stats", icon: Trophy, url: "/main/dashboard/stats" },
      { title: "Insert Results", icon: Trophy, url: "/main/dashboard/insert-results" },
      { title: "Add Player", icon: Users, url: "/main/dashboard/add-player" },
      { title: "Host Controls", icon: Settings, url: "/main/dashboard/host-controls" },
      { title: "EAFC Setup", icon: Gamepad2, url: "/main/dashboard/eafc-setup" },
    ],
  },
  {
    section: "Bank & Balance",
    items: [
      {
        title: "Transactions",
        icon: Banknote,
        url: "/main/dashboard/transactions",
      },
      { title: "Sponsors", icon: Banknote, url: "/main/dashboard/sponsors" },
      { title: "Stadium", icon: Banknote, url: "/main/dashboard/stadium" },
      { title: "Loans", icon: Banknote, url: "/main/dashboard/loans" },
    ],
  },
  {
    section: "Transfer Hub",
    items: [
      { title: "Players Database", icon: Shuffle, url: "/main/dashboard/players-database" },
      { title: "Packs", icon: Shuffle, url: "/main/dashboard/packs" },
      { title: "Draft", icon: Shuffle, url: "/main/dashboard/draft" },
      {
        title: "Free Agents",
        icon: Shuffle,
        url: "/main/dashboard/freeagents",
      },
      { title: "Transfer List", icon: Shuffle, url: "/main/dashboard/transfer-list" },
      { title: "Auctions", icon: Shuffle, url: "/main/dashboard/auctions" },
      { title: "Trades", icon: Shuffle, url: "/main/dashboard/trades" },
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
    <div className="flex flex-col items-center align-center mt-2">
      <Avatar className="w-8 h-8 rounded-full" />
      <span className="h-8 text-sm font-medium truncate max-w-full">
        {userName || "User"}
      </span>
    </div>
  );
}

export function AppSidebar() {
  const router = useRouter();
  const { selectedLeagueId, selectedTeam } = useLeague();
  const { refreshKey } = useRefresh();
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [rank, setRank] = useState<number | null>(null);

  // Fetch balance when team is selected or refresh triggered
  useEffect(() => {
    const fetchBalance = async () => {
      if (!selectedTeam?.id) {
        setBalance(null);
        return;
      }

      setBalanceLoading(true);
      try {
        const response = await fetch(`/api/balance?teamId=${selectedTeam.id}`);
        if (response.ok) {
          const data = await response.json();
          setBalance(data.data?.availableBalance || selectedTeam.budget || 0);
        } else {
          setBalance(selectedTeam.budget || 0);
        }
      } catch (error) {
        setBalance(selectedTeam.budget || 0);
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

  return (
    <Sidebar className="flex flex-col">
      <div className="flex flex-col gap-4 p-4 border-b border-sidebar-border text-sidebar-foreground">
        <div className="mt-3 flex flex-col items-center gap-2">
          <Button 
            onClick={() => router.push('/saves')}
            variant="outline" 
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
          >
            Back to Saves
          </Button>
        </div>
        <div className="flex items-center justify-between px-6 gap-2">
          <NotificationBell />
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm">Balance</span>
            <Badge variant={"secondary"} className="text-green-600">
              {balanceLoading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
              ) : balance !== null ? (
                `${(balance / 1000000).toFixed(1)}M`
              ) : (
                '0.0M'
              )}
            </Badge>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm">Rank</span>
            <Badge>{rank != null ? `#${rank}` : "—"}</Badge>
          </div>
        </div>
      </div>
      <SidebarContent className="flex-1 text-sidebar-foreground">
        <ScrollArea className="h-full">
          {sidebarSections.map((section) => (
            <SidebarGroup key={section.section}>
              <SidebarGroupLabel className="text-sidebar-foreground text-sm">
                {section.section}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <button
                          onClick={() => {
                            const url = `${item.url}${selectedLeagueId ? `?league=${selectedLeagueId}` : ''}`;
                            console.log('Sidebar: Navigating to:', url);
                            router.push(url);
                          }}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-sidebar-accent rounded w-full text-left"
                        >
                          <span className="text-sidebar-foreground/80">{item.title}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>

      <div className="p-4 border-t border-sidebar-border text-sidebar-foreground">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/main/dashboard/settings")}
            className="flex items-center gap-1 hover:text-sidebar-foreground/80"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </button>
        </div>
        <SidebarUser />
        <div className="mt-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="w-full bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </Sidebar>
  );
}
