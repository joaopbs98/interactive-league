"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import {
  Trophy, Users, Calendar, DollarSign, Shield, Swords,
  TrendingUp, AlertTriangle, Loader2, ArrowRight, Star
} from "lucide-react";
import Link from "next/link";

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
};

export default function DashboardPage() {
  const router = useRouter();
  const { selectedLeagueId, selectedTeam } = useLeague();
  const { refreshKey } = useRefresh();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [nextMatches, setNextMatches] = useState<Match[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [rosterCount, setRosterCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
          setBalance(data.data?.availableBalance ?? selectedTeam.budget ?? 0);
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
      const res = await fetch(`/api/league/game?leagueId=${leagueId}&type=schedule`);
      const data = await res.json();
      if (data.success) {
        const all = data.data || [];
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
  const myStanding = standings.find(s => s.team_id === team?.id);

  const statusColor: Record<string, string> = {
    PRESEASON_SETUP: 'bg-blue-600',
    IN_SEASON: 'bg-green-600',
    OFFSEASON: 'bg-yellow-600',
    SEASON_END_PROCESSING: 'bg-orange-600',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{leagueInfo?.name || "Dashboard"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`${statusColor[leagueInfo?.status || ''] || 'bg-neutral-600'} text-white text-xs`}>
              {leagueInfo?.status?.replace(/_/g, ' ') || 'Loading'}
            </Badge>
            <span className="text-sm text-muted-foreground">Season {leagueInfo?.season || '?'}</span>
            {leagueInfo?.current_round ? (
              <span className="text-sm text-muted-foreground">
                Round {leagueInfo.current_round - 1}/{leagueInfo.total_rounds}
              </span>
            ) : null}
          </div>
        </div>
        {leagueInfo?.invite_code && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Invite Code</p>
            <p className="font-mono font-bold text-lg text-blue-400">{leagueInfo.invite_code}</p>
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-900/30">
              <DollarSign className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-lg font-bold text-green-400">{formatMoney(balance ?? team?.budget ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-900/30">
              <Trophy className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Position</p>
              <p className="text-lg font-bold">{myPosition > 0 ? `#${myPosition}` : '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Squad</p>
              <p className="text-lg font-bold">{team?.squad?.length || 0} / 23</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-900/30">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Record</p>
              <p className="text-lg font-bold">
                {myStanding ? `${myStanding.wins}W ${myStanding.draws}D ${myStanding.losses}L` : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Standings Mini Table */}
        <Card className="bg-neutral-900 border-neutral-800 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Standings
            </CardTitle>
            <Link href={`/main/dashboard/standings`}>
              <Button variant="ghost" size="sm">View All <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {standings.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No standings yet. Generate a schedule first.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-muted-foreground text-xs">
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2 text-left">Team</th>
                    <th className="p-2 text-center">P</th>
                    <th className="p-2 text-center">GD</th>
                    <th className="p-2 text-center font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.slice(0, 8).map((s, i) => (
                    <tr
                      key={s.team_id}
                      className={`border-b border-neutral-800/30 ${s.team_id === team?.id ? 'bg-blue-900/10' : ''}`}
                    >
                      <td className="p-2 text-center text-xs">{i + 1}</td>
                      <td className="p-2 flex items-center gap-2">
                        {s.team?.logo_url && <img src={s.team.logo_url} alt="" className="w-5 h-5 rounded" />}
                        <span className={`text-xs ${s.team_id === team?.id ? 'font-bold' : ''}`}>
                          {s.team?.acronym || s.team?.name}
                        </span>
                      </td>
                      <td className="p-2 text-center text-xs">{s.played}</td>
                      <td className="p-2 text-center text-xs">{s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}</td>
                      <td className="p-2 text-center text-xs font-bold">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="h-4 w-4" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/main/dashboard/tactics">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" /> Tactics & Formation
              </Button>
            </Link>
            <Link href="/main/dashboard/squad">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" /> Manage Squad
              </Button>
            </Link>
            <Link href="/main/dashboard/packs">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Star className="h-4 w-4 mr-2" /> Open Packs
              </Button>
            </Link>
            <Link href="/main/dashboard/freeagents">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" /> Free Agents
              </Button>
            </Link>
            <Link href="/main/dashboard/trades">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Swords className="h-4 w-4 mr-2" /> Trade Centre
              </Button>
            </Link>
            <Link href="/main/dashboard/contracts">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <DollarSign className="h-4 w-4 mr-2" /> Contracts
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent + Upcoming Matches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Results */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Recent Results
            </CardTitle>
            <Link href="/main/dashboard/schedule">
              <Button variant="ghost" size="sm">All <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No matches played yet</p>
            ) : (
              <div className="space-y-2">
                {recentMatches.slice(-4).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded bg-neutral-800/30 text-sm">
                    <span className="flex-1 text-right text-xs truncate">{m.home_team?.acronym || '?'}</span>
                    <span className="mx-3 font-bold">{m.home_score} - {m.away_score}</span>
                    <span className="flex-1 text-left text-xs truncate">{m.away_team?.acronym || '?'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Upcoming Fixtures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming matches</p>
            ) : (
              <div className="space-y-2">
                {nextMatches.slice(0, 4).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded bg-neutral-800/30 text-sm">
                    <span className="flex-1 text-right text-xs truncate">{m.home_team?.acronym || '?'}</span>
                    <Badge variant="outline" className="mx-3 text-xs">R{m.round}</Badge>
                    <span className="flex-1 text-left text-xs truncate">{m.away_team?.acronym || '?'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
