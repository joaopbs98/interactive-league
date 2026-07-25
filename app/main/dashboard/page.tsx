"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  Trophy, Users, Calendar, DollarSign, Swords,
  AlertTriangle, ArrowRight, Bell, CheckCircle,
  Wallet,
} from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { FormStrip, FormRoundData } from "@/components/dashboard/FormStrip";
import { NextMatchHero } from "@/components/dashboard/NextMatchHero";
import { SquadHealthChart, SquadHealthGroup } from "@/components/dashboard/charts/SquadHealthChart";
import { FinanceTrendChart, FinancePoint } from "@/components/dashboard/charts/FinanceTrendChart";
import { LeaguePositionChart, PositionPoint } from "@/components/dashboard/charts/LeaguePositionChart";

const ordinal = (n: number): string => {
  if (n <= 0) return "-";
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

type Standing = {
  team_id: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goal_diff: number;
  team: { id: string; name: string; acronym: string; logo_url: string | null };
};

type Match = {
  id: string;
  round: number;
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  home_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
  away_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
};

type LeagueInfo = {
  status: string;
  season: number;
  current_round: number;
  total_rounds: number;
  invite_code: string;
  name: string;
  transfer_window_open?: boolean;
};

type SquadPlayer = {
  player_id: string;
  positions: string;
  overall_rating: number;
};

const getPositionGroupShort = (positions: string): "GK" | "DEF" | "MID" | "FWD" | "Other" => {
  if (!positions) return "Other";
  const first = positions.split(",")[0].trim();
  if (first === "GK") return "GK";
  if (["CB", "LB", "RB", "WB", "LWB", "RWB"].includes(first)) return "DEF";
  if (["CDM", "CM", "CAM", "LM", "RM", "LW", "RW"].includes(first)) return "MID";
  if (["ST", "CF"].includes(first)) return "FWD";
  return "Other";
};

export default function DashboardPage() {
  const router = useRouter();
  const { selectedLeagueId, selectedTeam } = useLeague();
  const { refreshKey } = useRefresh();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [nextMatches, setNextMatches] = useState<Match[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [squadDetailed, setSquadDetailed] = useState<SquadPlayer[]>([]);
  const [financePoints, setFinancePoints] = useState<FinancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingTradesCount, setPendingTradesCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [hasRegistrationAlert, setHasRegistrationAlert] = useState(false);
  const [canPickSponsor, setCanPickSponsor] = useState(false);
  const [hasContractsEnding, setHasContractsEnding] = useState(false);

  const leagueId = selectedLeagueId;
  const team = selectedTeam;

  useEffect(() => {
    if (leagueId) fetchAll();
  }, [leagueId]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!selectedTeam?.id) {
        setBalance(null);
        return;
      }
      try {
        const res = await fetch(`/api/balance?teamId=${selectedTeam.id}`);
        if (res.ok) {
          const data = await res.json();
          setBalance(data.data?.totalBudget ?? data.data?.availableBalance ?? selectedTeam.budget ?? 0);
        } else {
          setBalance(selectedTeam.budget ?? 0);
        }
      } catch {
        setBalance(selectedTeam.budget ?? 0);
      }
    };
    fetchBalance();
  }, [selectedTeam?.id, selectedTeam?.budget, refreshKey]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchLeagueInfo(),
      fetchStandings(),
      fetchMatches(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedTeam?.id || !selectedLeagueId) return;
    const fetchActions = async () => {
      try {
        const [tradesRes, notifRes] = await Promise.all([
          fetch(`/api/trades?teamId=${selectedTeam.id}`),
          fetch(`/api/notifications?leagueId=${selectedLeagueId}`),
        ]);
        if (tradesRes.ok) {
          const td = await tradesRes.json();
          setPendingTradesCount(td.pendingCount ?? 0);
        }
        if (notifRes.ok) {
          const nd = await notifRes.json();
          setUnreadNotifications(nd.unreadCount ?? 0);
          const notifs = nd.notifications || [];
          setHasRegistrationAlert(notifs.some((n: { type: string }) => n.type === "registration_required"));
          setHasContractsEnding(notifs.some((n: { type: string }) => n.type === "contract_ending"));
        }
      } catch {}
    };
    fetchActions();
  }, [selectedTeam?.id, selectedLeagueId, refreshKey]);

  useEffect(() => {
    if (leagueInfo?.status === "OFFSEASON" && leagueInfo?.season && !selectedTeam?.sponsor_id) {
      setCanPickSponsor([2, 5, 7, 9].includes(leagueInfo.season));
    } else {
      setCanPickSponsor(false);
    }
  }, [leagueInfo?.status, leagueInfo?.season, selectedTeam?.sponsor_id]);

  // Squad detail (positions + ratings) for the squad health chart
  useEffect(() => {
    if (!leagueId) return;
    fetch(`/api/user/team/${leagueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.team?.squad) setSquadDetailed(d.team.squad);
      })
      .catch(() => {});
  }, [leagueId, refreshKey]);

  // Finance history for the balance trend chart
  useEffect(() => {
    if (!team?.id) return;
    fetch(`/api/team/${team.id}/finances`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const txs = (d.data?.transactions || []).slice(0, 12);
        const current = d.data?.finances?.availableBalance ?? 0;
        let running = current;
        const points: FinancePoint[] = txs.map((t: { amount: number; date?: string; created_at?: string }) => {
          const dateStr = t.date || t.created_at;
          const point: FinancePoint = {
            label: dateStr
              ? new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
              : "",
            balance: running,
          };
          running -= t.amount;
          return point;
        });
        points.reverse();
        setFinancePoints(points);
      })
      .catch(() => {});
  }, [team?.id, refreshKey]);

  const fetchLeagueInfo = async () => {
    try {
      const res = await fetch(`/api/league/game?leagueId=${leagueId}&type=league_info`);
      const data = await res.json();
      if (data.success) setLeagueInfo(data.data);
    } catch {}
  };

  const fetchStandings = async () => {
    try {
      const res = await fetch(`/api/league/game?leagueId=${leagueId}&type=standings`);
      const data = await res.json();
      if (data.success) setStandings(data.data || []);
    } catch {}
  };

  const fetchMatches = async () => {
    try {
      const res = await fetch(`/api/league/game?leagueId=${leagueId}&type=schedule&competition_type=domestic`);
      const data = await res.json();
      if (data.success) {
        const all = data.data || [];
        setAllMatches(all);
        const simulated = all.filter((m: Match) => m.match_status === 'simulated');
        const scheduled = all.filter((m: Match) => m.match_status === 'scheduled');
        setRecentMatches(simulated.slice(-6));
        setNextMatches(scheduled.slice(0, 4));
      }
    } catch {}
  };

  const formatMoney = (n: number) => {
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
    return `€${n}`;
  };

  const myPosition = standings.findIndex(s => s.team_id === team?.id) + 1;

  const nextMatch = team?.id
    ? nextMatches.find((m) => m.home_team?.id === team.id || m.away_team?.id === team.id)
    : null;
  const getMatchResult = (m: Match) => {
    if (m.match_status !== "simulated" || m.home_score == null || m.away_score == null) return null;
    const isHome = m.home_team?.id === team?.id;
    const our = isHome ? m.home_score : m.away_score;
    const opp = isHome ? m.away_score : m.home_score;
    if (our > opp) return "W";
    if (our < opp) return "L";
    return "D";
  };

  const phaseHint =
    leagueInfo?.status === "OFFSEASON"
      ? "Pick a sponsor and prepare for next season."
      : leagueInfo?.status === "IN_SEASON" && leagueInfo?.transfer_window_open
        ? "Transfer window is open — buy, sell, or trade."
        : leagueInfo?.status === "IN_SEASON" && !leagueInfo?.transfer_window_open
          ? "Transfer window is closed."
          : leagueInfo?.status === "PRESEASON_SETUP"
            ? "Register your squad (21–23 players) before the season starts."
            : null;

  const statusColor: Record<string, string> = {
    PRESEASON_SETUP: 'bg-accent-muted text-accent border-accent/30',
    IN_SEASON: 'bg-status-positive/15 text-status-positive border-status-positive/30',
    OFFSEASON: 'bg-status-warning/15 text-status-warning border-status-warning/30',
    SEASON_END_PROCESSING: 'bg-surface-3 text-muted-foreground border-border-strong',
  };

  // --- Chart data derivations ---

  const simulatedMatches = useMemo(
    () => allMatches.filter((m) => m.match_status === "simulated" && m.home_score != null && m.away_score != null),
    [allMatches]
  );

  const formChartData: FormRoundData[] = useMemo(() => {
    if (!team?.id) return [];
    return simulatedMatches
      .filter((m) => m.home_team?.id === team.id || m.away_team?.id === team.id)
      .map((m) => {
        const isHome = m.home_team?.id === team.id;
        const our = (isHome ? m.home_score : m.away_score) as number;
        const opp = (isHome ? m.away_score : m.home_score) as number;
        const result: "W" | "D" | "L" = our > opp ? "W" : our < opp ? "L" : "D";
        const points = result === "W" ? 3 : result === "D" ? 1 : 0;
        return {
          round: m.round,
          points,
          result,
          scoreLine: `${m.home_score}-${m.away_score}`,
        };
      })
      .sort((a, b) => a.round - b.round)
      .slice(-8);
  }, [simulatedMatches, team?.id]);

  const { positionChartData, totalTeamsInTable } = useMemo(() => {
    if (!team?.id || simulatedMatches.length === 0) return { positionChartData: [] as PositionPoint[], totalTeamsInTable: 0 };

    const teamIds = new Set<string>();
    simulatedMatches.forEach((m) => {
      if (m.home_team?.id) teamIds.add(m.home_team.id);
      if (m.away_team?.id) teamIds.add(m.away_team.id);
    });

    const rounds = Array.from(new Set(simulatedMatches.map((m) => m.round))).sort((a, b) => a - b);
    const result: PositionPoint[] = [];

    for (const r of rounds) {
      const table = new Map<string, { points: number; gd: number; gf: number }>();
      teamIds.forEach((id) => table.set(id, { points: 0, gd: 0, gf: 0 }));

      simulatedMatches
        .filter((m) => m.round <= r)
        .forEach((m) => {
          const home = table.get(m.home_team!.id)!;
          const away = table.get(m.away_team!.id)!;
          const hs = m.home_score as number;
          const awayScore = m.away_score as number;
          home.gf += hs;
          home.gd += hs - awayScore;
          away.gf += awayScore;
          away.gd += awayScore - hs;
          if (hs > awayScore) home.points += 3;
          else if (hs < awayScore) away.points += 3;
          else {
            home.points += 1;
            away.points += 1;
          }
        });

      const sorted = Array.from(table.entries()).sort(
        (a, b) => b[1].points - a[1].points || b[1].gd - a[1].gd || b[1].gf - a[1].gf
      );
      const idx = sorted.findIndex(([id]) => id === team.id);
      if (idx >= 0) result.push({ round: r, position: idx + 1 });
    }

    return { positionChartData: result, totalTeamsInTable: teamIds.size };
  }, [simulatedMatches, team?.id]);

  const squadHealthData: SquadHealthGroup[] = useMemo(() => {
    const buckets: Record<"GK" | "DEF" | "MID" | "FWD", number[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    squadDetailed.forEach((p) => {
      const group = getPositionGroupShort(p.positions);
      if (group !== "Other") buckets[group].push(p.overall_rating);
    });
    return (["GK", "DEF", "MID", "FWD"] as const).map((group) => ({
      group,
      avgRating: buckets[group].length ? buckets[group].reduce((a, b) => a + b, 0) / buckets[group].length : 0,
      count: buckets[group].length,
    }));
  }, [squadDetailed]);

  if (loading) {
    return (
      <div className="p-6">
        <PageSkeleton variant="page" rows={4} />
      </div>
    );
  }

  const isHomeNext = nextMatch?.home_team?.id === team?.id;
  const usNext = nextMatch ? (isHomeNext ? nextMatch.home_team : nextMatch.away_team) : null;
  const oppNext = nextMatch ? (isHomeNext ? nextMatch.away_team : nextMatch.home_team) : null;

  const actionItems: { key: string; icon: typeof AlertTriangle; label: string; href: string; urgent?: boolean }[] = [
    hasRegistrationAlert && { key: "register", icon: AlertTriangle, label: "Register squad (21–23 players)", href: "/main/dashboard/squad", urgent: true },
    hasContractsEnding && { key: "contracts", icon: AlertTriangle, label: "Contracts ending soon", href: "/main/dashboard/contracts", urgent: true },
    pendingTradesCount > 0 && { key: "trades", icon: Swords, label: `${pendingTradesCount} pending trade${pendingTradesCount !== 1 ? "s" : ""}`, href: "/main/dashboard/trades" },
    canPickSponsor && { key: "sponsor", icon: DollarSign, label: "Sign a sponsor", href: "/main/dashboard/sponsors" },
    unreadNotifications > 0 && { key: "notif", icon: Bell, label: `${unreadNotifications} notification${unreadNotifications !== 1 ? "s" : ""}`, href: "/main/dashboard" },
    phaseHint && { key: "phase", icon: CheckCircle, label: phaseHint, href: "#" },
  ].filter(Boolean) as { key: string; icon: typeof AlertTriangle; label: string; href: string; urgent?: boolean }[];

  const hasUrgent = actionItems.some((a) => a.urgent);

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
      {/* Attention: the actual job of this page — "what needs me right now" — always visible, never buried */}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border p-4",
          hasUrgent ? "border-status-warning/30 glow-orange" : "border-border-strong"
        )}
      >
        <p className="relative text-sm font-semibold flex items-center gap-2 mb-3">
          <CheckCircle className={cn("h-4 w-4", hasUrgent ? "text-status-warning" : "text-status-positive")} />
          {actionItems.length > 0 ? "Needs Your Attention" : "You're All Caught Up"}
        </p>
        {actionItems.length > 0 ? (
          <div className="relative flex flex-wrap gap-2">
            {actionItems.map((a) => (
              <Link key={a.key} href={a.href}>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 bg-surface-2 border-border hover:bg-surface-3 transition-colors duration-150",
                    a.urgent ? "hover:border-status-warning/50" : "hover:border-accent/40"
                  )}
                >
                  <a.icon className="h-3.5 w-3.5" /> {a.label}
                </Button>
              </Link>
            ))}
          </div>
        ) : (
          <p className="relative text-sm text-muted-foreground">
            No pending registrations, trades, or contract issues. Check back before your next match.
          </p>
        )}
      </div>

      {/* Hero: club identity + next match — trimmed to the 3 facts that aren't repeated elsewhere */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="relative overflow-hidden rounded-lg border border-border-strong bg-surface p-6 sm:p-8 flex flex-col gap-8 glow-blue">
          <div className="relative flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                {leagueInfo?.name || "League"} · Season {leagueInfo?.season || "?"}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-balance">{team?.name || "Your Club"}</h1>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge className={`text-[10px] uppercase tracking-wider font-semibold border ${statusColor[leagueInfo?.status || ''] || 'bg-surface-3 text-muted-foreground border-border-strong'}`}>
                  {leagueInfo?.status?.replace(/_/g, ' ') || 'Loading'}
                </Badge>
                {leagueInfo?.current_round ? (
                  <span className="text-sm text-muted-foreground">
                    Round {leagueInfo.current_round - 1}/{leagueInfo.total_rounds}
                  </span>
                ) : null}
              </div>
            </div>
            {leagueInfo?.invite_code && (
              <div className="shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Invite Code</p>
                <p className="font-mono font-bold text-lg text-accent tabular-nums">{leagueInfo.invite_code}</p>
              </div>
            )}
          </div>

          <div className="relative flex flex-wrap items-end gap-x-10 gap-y-5 mt-auto">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">League Position</p>
              <p className="font-display text-6xl text-accent tabular-nums leading-none">{ordinal(myPosition)}</p>
              {standings.length > 0 && <p className="text-xs text-muted-foreground mt-1.5">of {standings.length} clubs</p>}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Balance</p>
              <p className="text-2xl font-bold tabular-nums">{formatMoney(balance ?? team?.budget ?? 0)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Squad</p>
              <p className="text-2xl font-bold tabular-nums">
                {team?.squad?.length || 0}<span className="text-base font-medium text-muted-foreground"> / 23</span>
              </p>
            </div>
          </div>
        </div>

        {/* Next match — the one CTA that belongs here is tactics prep for it, not a generic nav dock */}
        <NextMatchHero round={nextMatch?.round} homeTeam={usNext} awayTeam={oppNext} />
      </div>

      {/* Recent form — the one place "how are we doing" is answered, in full (not repeated as a flat W/D/L stat elsewhere) */}
      <FormStrip data={formChartData} />

      {/* Performance: one panel, two charts sharing a frame — not two identical boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-1">
            <h2 className="font-display text-2xl">Performance</h2>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Season {leagueInfo?.season || "?"}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-6 pt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> League Position
              </p>
              <LeaguePositionChart data={positionChartData} totalTeams={totalTeamsInTable || standings.length} />
            </div>
            <div className="p-6 pt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Finance Trend
              </p>
              <FinanceTrendChart data={financePoints} />
            </div>
          </div>
        </div>

        {/* Right rail: squad health only — Quick Actions removed, it just duplicated the sidebar nav */}
        <div className="rounded-lg border border-border-strong bg-surface p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Squad Health
          </p>
          <SquadHealthChart data={squadHealthData} />
        </div>
      </div>

      {/* Table + Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Standings */}
        <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <h2 className="font-display text-2xl">Table</h2>
            <Link href="/main/dashboard/standings" className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {standings.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No standings yet. Generate a schedule first.</p>
          ) : (
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-[11px] uppercase tracking-wider">
                  <th className="p-2 pl-5 w-8 text-center font-medium">#</th>
                  <th className="p-2 text-left font-medium">Team</th>
                  <th className="p-2 pr-5 text-center font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.slice(0, 6).map((s, i) => (
                  <tr
                    key={s.team_id}
                    className={cn(
                      "border-b border-border/60 transition-colors duration-150 hover:bg-surface-3/60",
                      s.team_id === team?.id && "bg-accent-muted hover:bg-accent-muted"
                    )}
                  >
                    <td className="p-2 pl-5 text-center text-xs tabular-nums">{i + 1}</td>
                    <td className="p-2 flex items-center gap-2">
                      {s.team?.logo_url && <img src={s.team.logo_url} alt="" className="w-5 h-5 rounded" />}
                      <span className={`text-xs ${s.team_id === team?.id ? 'font-bold text-accent' : ''}`}>
                        {s.team?.acronym || s.team?.name}
                      </span>
                    </td>
                    <td className="p-2 pr-5 text-center text-xs font-bold tabular-nums">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Matches: results + fixtures as one panel, two columns — not two duplicate cards */}
        <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <h2 className="font-display text-2xl">Matches</h2>
            <Link href="/main/dashboard/schedule" className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1">
              Full schedule <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border mt-3">
            <div className="p-4 pt-0 flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wider text-faint-foreground mb-1">Recent Results</p>
              {recentMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No matches played yet</p>
              ) : (
                recentMatches.slice(-4).map(m => {
                  const result = getMatchResult(m);
                  const scoreStr = m.match_status === "simulated" && m.home_score != null && m.away_score != null
                    ? `${m.home_score}-${m.away_score}`
                    : "—";
                  const resultStyle =
                    result === "W"
                      ? "bg-status-positive/15 text-status-positive"
                      : result === "L"
                        ? "bg-status-negative/15 text-status-negative"
                        : "bg-status-neutral/15 text-status-neutral";
                  return (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-surface-2 text-sm">
                      <span className="flex-1 text-right text-xs truncate">{m.home_team?.acronym || "?"}</span>
                      <span className="mx-2 font-bold tabular-nums flex items-center">
                        {scoreStr}
                        {result && (
                          <span className={cn("ml-1.5 text-[10px] font-semibold rounded px-1.5 py-0.5", resultStyle)}>
                            {result}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 text-left text-xs truncate">{m.away_team?.acronym || "?"}</span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 pt-0 flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wider text-faint-foreground mb-1">Upcoming Fixtures</p>
              {nextMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No upcoming matches</p>
              ) : (
                nextMatches.slice(0, 4).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-surface-2 text-sm">
                    <span className="flex-1 text-right text-xs truncate">{m.home_team?.acronym || '?'}</span>
                    <span className="mx-2 text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">R{m.round}</span>
                    <span className="flex-1 text-left text-xs truncate">{m.away_team?.acronym || '?'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
