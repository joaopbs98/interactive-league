"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { ManualScheduleForm } from "@/components/schedule/ManualScheduleForm";
import { Loader2, ChevronLeft, ChevronRight, Calendar, Shield, Trash2 } from "lucide-react";

type Match = {
  id: string;
  round: number;
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  played_at: string | null;
  competition_type?: string;
  home_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
  away_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
};

type LeagueInfo = {
  id: string;
  season: number;
  total_rounds?: number;
  status?: string;
};

type TeamInfo = { id: string; name: string; acronym: string };

export default function SchedulePage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [matches, setMatches] = useState<Match[]>([]);
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(0);
  const [viewRound, setViewRound] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

  useEffect(() => {
    if (!selectedLeagueId) return;
    fetchAll();
  }, [selectedLeagueId]);

  const fetchAll = async () => {
    if (!selectedLeagueId) return;
    setLoading(true);
    try {
      const [scheduleRes, leagueRes, teamsRes] = await Promise.all([
        fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=schedule`),
        fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=league_info`),
        fetch(`/api/league/teams?leagueId=${selectedLeagueId}`),
      ]);
      const scheduleData = await scheduleRes.json();
      const leagueData = await leagueRes.json();
      const teamsData = await teamsRes.json();

      if (scheduleData.success) {
        setMatches(scheduleData.data || []);
        setCurrentRound(scheduleData.meta?.current_round || 1);
        setTotalRounds(scheduleData.meta?.total_rounds || 0);
        setViewRound((v) => Math.max(1, Math.min(v, scheduleData.meta?.total_rounds || 1)));
      }
      if (leagueData.success) setLeague(leagueData.data);
      if (teamsData.success || teamsData.data) setTeams(teamsData.data || []);
    } catch (err) {
      console.error("Failed to load schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: string) => {
    if (!selectedLeagueId) return;
    setActionLoading(action);
    setMessage(null);
    try {
      const res = await fetch("/api/league/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, leagueId: selectedLeagueId }),
      });
      const data = await res.json();
      if (data.success) {
        if (action === "validate_registration" && data.data) {
          if (data.data.valid) {
            setMessage({ type: "success", text: "All teams pass registration (21-23 players, max 3 GKs)" });
          } else {
            const invalid = data.data.invalid_teams || [];
            const msg = invalid
              .map((t: { team_name: string; errors: string[] }) => `${t.team_name}: ${(t.errors || []).join(", ")}`)
              .join("; ");
            setMessage({ type: "error", text: `Registration invalid: ${msg}` });
          }
        } else if (action !== "validate_registration") {
          setMessage({ type: "success", text: `${action.replace(/_/g, " ")} completed successfully` });
        }
        await fetchAll();
      } else {
        setMessage({ type: "error", text: data.error || "Action failed" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (matchId: string) => {
    setDeleteLoading(matchId);
    try {
      const res = await fetch(`/api/league/schedule/${matchId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) await fetchAll();
      else alert(data.error || "Failed to delete");
    } catch {
      alert("Failed to delete");
    } finally {
      setDeleteLoading(null);
    }
  };

  const roundMatches = matches.filter((m) => m.round === viewRound);
  const displayTotalRounds = totalRounds > 0 ? totalRounds : Math.max(2, (teams.length - 1) * 2);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedLeagueId) {
    return (
      <div className="p-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Select a league</p>
            <p className="text-sm">Choose a league from the Saves page to view the schedule.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Schedule</h2>
        <Badge variant="outline" className="text-sm">
          {displayTotalRounds} Rounds
        </Badge>
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-900/30 text-green-300 border border-green-800"
              : "bg-red-900/30 text-red-300 border border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Host: Manage Schedule */}
      {isHost && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Manage Schedule
            </CardTitle>
            <CardDescription>
              Validate registration, generate round-robin, or manually add fixtures.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => performAction("validate_registration")}
                disabled={actionLoading === "validate_registration" || teams.length < 2}
              >
                {actionLoading === "validate_registration" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Validate Registration
              </Button>
              <Button
                size="sm"
                onClick={() => performAction("generate_schedule")}
                disabled={actionLoading === "generate_schedule" || teams.length < 2}
              >
                {actionLoading === "generate_schedule" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Generate Round-Robin
              </Button>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Manual Schedule</p>
              <ManualScheduleForm
                leagueId={selectedLeagueId}
                league={league}
                teams={teams}
                onSuccess={fetchAll}
              />
            </div>
            {teams.length < 2 && (
              <p className="text-xs text-muted-foreground">Need at least 2 teams</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Round selector + matches */}
      {matches.length === 0 && !isHost ? (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">No schedule yet</p>
            <p className="text-sm">
              The host needs to generate a schedule or add matches manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              disabled={viewRound <= 1}
              onClick={() => setViewRound((v) => v - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <span className="text-lg font-bold min-w-[140px] text-center">
              Round {viewRound}
              {viewRound === currentRound - 1 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Latest
                </Badge>
              )}
              {viewRound >= currentRound && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Upcoming
                </Badge>
              )}
            </span>

            <Button
              variant="ghost"
              size="icon"
              disabled={viewRound >= displayTotalRounds}
              onClick={() => setViewRound((v) => v + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {roundMatches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No matches in this round</p>
            ) : (
              roundMatches.map((match) => (
                <Card key={match.id} className="bg-neutral-900 border-neutral-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        {match.competition_type && match.competition_type !== "domestic" && (
                          <Badge variant="outline" className="text-xs">
                            {match.competition_type.toUpperCase()}
                          </Badge>
                        )}
                        <span className="font-medium text-right">
                          {match.home_team?.name || "TBD"}
                        </span>
                        {match.home_team?.logo_url && (
                          <img
                            src={match.home_team.logo_url}
                            alt=""
                            className="w-8 h-8 rounded"
                          />
                        )}
                      </div>

                      <div className="mx-6 min-w-[80px] text-center flex items-center gap-2">
                        {match.match_status === "simulated" ? (
                          <span className="text-2xl font-bold">
                            {match.home_score} - {match.away_score}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Scheduled
                          </Badge>
                        )}
                        {isHost && match.match_status === "scheduled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(match.id)}
                            disabled={deleteLoading === match.id}
                          >
                            {deleteLoading === match.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-1">
                        {match.away_team?.logo_url && (
                          <img
                            src={match.away_team.logo_url}
                            alt=""
                            className="w-8 h-8 rounded"
                          />
                        )}
                        <span className="font-medium">
                          {match.away_team?.name || "TBD"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
