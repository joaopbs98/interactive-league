"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

interface Player {
  player_id: string;
  name: string;
  positions?: string;
  overall_rating: number;
  club_name?: string;
  image?: string;
  wage?: string;
  value?: string;
  isInjured?: boolean;
  injuryType?: string;
  gamesRemaining?: number;
}

interface Team {
  id: string;
  name: string;
  acronym: string;
  logo_url?: string;
  budget: number;
  squad: Player[];
  league_id: string;
}

interface League {
  id: string;
  name: string;
  season: number;
}

const POSITION_GROUPS = ["Goalkeeper", "Defender", "Midfielder", "Attacker", "Other"] as const;

const TeamDashboardPage: React.FC = () => {
  const params = useParams();
  const teamId = params.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchTeamData = async () => {
    try {
      const teamResponse = await fetch(`/api/team/${teamId}`);

      if (!teamResponse.ok) {
        const errorData = await teamResponse.json();
        setError(errorData.error || "Failed to fetch team data");
        return;
      }

      const teamData = await teamResponse.json();
      const leagueId = teamData.team?.league_id;

      if (!leagueId) {
        setError("Team has no associated league");
        return;
      }

      const userTeamResponse = await fetch(`/api/user/team/${leagueId}`);

      if (userTeamResponse.ok) {
        const data = await userTeamResponse.json();
        const transformedTeam = {
          ...data.team,
          squad: data.team?.squad || [],
        };
        setTeam(transformedTeam);
        setLeague(data.league);
      } else {
        const errorData = await userTeamResponse.json();
        setError(errorData.error || "Failed to fetch user team data");
      }
    } catch {
      setError("An error occurred while fetching team data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (teamId) {
      fetchTeamData();
    }
  }, [teamId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTeamData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPositionGroup = (positions: string | undefined | null) => {
    if (!positions) return "Other";
    if (positions.includes("GK")) return "Goalkeeper";
    if (positions.includes("LB") || positions.includes("CB") || positions.includes("RB")) return "Defender";
    if (
      positions.includes("LM") ||
      positions.includes("RM") ||
      positions.includes("CM") ||
      positions.includes("CDM") ||
      positions.includes("CAM")
    )
      return "Midfielder";
    if (positions.includes("LW") || positions.includes("RW") || positions.includes("ST") || positions.includes("CF"))
      return "Attacker";
    return "Other";
  };

  const groupPlayersByPosition = (players: Player[]) => {
    const grouped: Record<(typeof POSITION_GROUPS)[number], Player[]> = {
      Goalkeeper: [],
      Defender: [],
      Midfielder: [],
      Attacker: [],
      Other: [],
    };

    players.forEach((player) => {
      if (player.isInjured) return;
      const group = getPositionGroup(player.positions);
      grouped[group as (typeof POSITION_GROUPS)[number]].push(player);
    });

    return grouped;
  };

  const getInjuredPlayers = (players: Player[]) => players.filter((player) => player.isInjured);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <PageSkeleton variant="page" rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description={error}
          action={{ label: "Back to Dashboard", href: "/main/dashboard" }}
        />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Team not found"
          description="This team could not be located."
          action={{ label: "Back to Dashboard", href: "/main/dashboard" }}
        />
      </div>
    );
  }

  const groupedPlayers = groupPlayersByPosition(team.squad || []);
  const injuredPlayers = getInjuredPlayers(team.squad || []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {team.logo_url && (
              <img src={team.logo_url} alt={`${team.name} logo`} className="h-12 w-12 rounded-full object-cover" />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
              <p className="text-sm text-muted-foreground">
                {league?.name} · Season {league?.season}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Budget</div>
              <div className="text-xl font-bold text-status-positive">{formatCurrency(team.budget)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Squad overview */}
        <Card className="bg-surface border-border">
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">Squad Overview</h2>
            <p className="text-sm text-muted-foreground">
              {team.squad.length} players in squad
              {injuredPlayers.length > 0 && (
                <span className="ml-2 text-status-negative">({injuredPlayers.length} injured)</span>
              )}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {POSITION_GROUPS.map((position) => {
                const players = groupedPlayers[position];
                return (
                  <div key={position} className="rounded-lg border border-border bg-surface-2 p-3">
                    <h3 className="text-xs font-medium text-muted-foreground mb-1">{position}s</h3>
                    <div className="text-xl font-bold text-accent">{players.length}</div>
                    {players.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Avg {Math.round(players.reduce((sum, p) => sum + p.overall_rating, 0) / players.length)}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="rounded-lg border border-status-negative/30 bg-status-negative/10 p-3">
                <h3 className="text-xs font-medium text-status-negative mb-1">Unavailable</h3>
                <div className="text-xl font-bold text-status-negative">{injuredPlayers.length}</div>
                {injuredPlayers.length > 0 && (
                  <div className="text-xs text-status-negative/80 mt-0.5">Injured/Suspended</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available squad table */}
        <Card className="bg-surface border-border">
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">Available Squad</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-3 text-left font-medium">Player</th>
                    <th className="px-6 py-3 text-left font-medium">Position</th>
                    <th className="px-6 py-3 text-left font-medium">Rating</th>
                    <th className="px-6 py-3 text-left font-medium">Club</th>
                    <th className="px-6 py-3 text-left font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {team.squad
                    .filter((player) => !player.isInjured)
                    .map((player) => (
                      <tr key={player.player_id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {player.image ? (
                              <img
                                className="h-9 w-9 rounded-full object-cover"
                                src={player.image}
                                alt={player.name}
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-surface-3 flex items-center justify-center text-[10px] text-muted-foreground">
                                N/A
                              </div>
                            )}
                            <span className="font-medium">{player.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">{player.positions}</td>
                        <td className="px-6 py-3 whitespace-nowrap font-medium">{player.overall_rating}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                          {player.club_name || "—"}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">{player.value || "N/A"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Unavailable squad table */}
        {injuredPlayers.length > 0 && (
          <Card className="bg-surface border-status-negative/30">
            <CardHeader className="pb-3 border-b border-status-negative/20">
              <h2 className="text-base font-semibold text-status-negative">Unavailable Players</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-status-negative">
                      <th className="px-6 py-3 text-left font-medium">Player</th>
                      <th className="px-6 py-3 text-left font-medium">Position</th>
                      <th className="px-6 py-3 text-left font-medium">Rating</th>
                      <th className="px-6 py-3 text-left font-medium">Status</th>
                      <th className="px-6 py-3 text-left font-medium">Games Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {injuredPlayers.map((player) => (
                      <tr key={player.player_id} className="bg-status-negative/5">
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {player.image ? (
                              <img
                                className="h-9 w-9 rounded-full object-cover opacity-50"
                                src={player.image}
                                alt={player.name}
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-surface-3 opacity-50 flex items-center justify-center text-[10px] text-muted-foreground">
                                N/A
                              </div>
                            )}
                            <span className="font-medium">{player.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">{player.positions}</td>
                        <td className="px-6 py-3 whitespace-nowrap font-medium">{player.overall_rating}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-status-negative font-medium">
                          {player.injuryType || "Injured"}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-status-negative font-medium">
                          {player.gamesRemaining} games
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Link href="/main/dashboard" className="text-sm font-medium text-accent hover:text-accent-hover">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TeamDashboardPage;
