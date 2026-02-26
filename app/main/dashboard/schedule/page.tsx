"use client";

import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { ManualScheduleForm } from "@/components/schedule/ManualScheduleForm";
import { Loader2, ChevronLeft, ChevronRight, Calendar, Shield, Trash2, Filter } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Match = {
  id: string;
  round: number;
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  played_at: string | null;
  competition_type?: string;
  group_name?: string | null;
  home_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
  away_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
};

type StageOption = { round: number; label: string };

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
  const [myMatchesOnly, setMyMatchesOnly] = useState(false);
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");

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
            toast.success("All teams pass registration");
          } else {
            const invalid = data.data.invalid_teams || [];
            const msg = invalid
              .map((t: { team_name: string; errors: string[] }) => `${t.team_name}: ${(t.errors || []).join(", ")}`)
              .join("; ");
            setMessage({ type: "error", text: `Registration invalid: ${msg}` });
            toast.error(`Registration invalid: ${msg}`);
          }
        } else if (action !== "validate_registration") {
          setMessage({ type: "success", text: `${action.replace(/_/g, " ")} completed successfully` });
          if (action === "generate_schedule") toast.success("Schedule generated");
        }
        await fetchAll();
      } else {
        setMessage({ type: "error", text: data.error || "Action failed" });
        toast.error(data.error || "Action failed");
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

  const matchesCompetition = (m: Match) => {
    const ct = m.competition_type ?? "domestic";
    if (competitionFilter === "all") return true;
    if (competitionFilter === "domestic") return ct === "domestic" || !m.competition_type;
    return ct === competitionFilter;
  };

  const matchesForCompetition = matches.filter(matchesCompetition);
  const maxRoundForFilter =
    matchesForCompetition.length > 0
      ? Math.max(...matchesForCompetition.map((m) => m.round))
      : competitionFilter === "domestic" || competitionFilter === "all"
        ? totalRounds
        : 1;

  const isInternationalComp = ["ucl", "uel", "uecl", "supercup"].includes(competitionFilter);
  const stageOptions: StageOption[] = isInternationalComp
    ? (() => {
        const rounds = [...new Set(matchesForCompetition.map((m) => m.round))].sort((a, b) => a - b);
        return rounds.map((r) => {
          const roundMatches = matchesForCompetition.filter((m) => m.round === r);
          const hasGroup = roundMatches.some((m) => m.group_name);
          if (hasGroup) {
            return { round: r, label: `Group Stage R${r}` };
          }
          const cnt = roundMatches.length;
          const knockoutLabel =
            cnt >= 8 ? "Round of 16" : cnt >= 4 ? "Quarter-finals" : cnt >= 2 ? "Semifinals" : "Final";
          return { round: r, label: knockoutLabel };
        });
      })()
    : [];

  const effectiveViewRound =
    isInternationalComp && stageOptions.length > 0 && !stageOptions.some((s) => s.round === viewRound)
      ? (stageOptions[0]?.round ?? 1)
      : viewRound;

  const currentStageLabel =
    isInternationalComp && stageOptions.length > 0
      ? stageOptions.find((s) => s.round === effectiveViewRound)?.label ?? `Round ${effectiveViewRound}`
      : `Round ${effectiveViewRound}`;

  const roundMatchesRaw = matches
    .filter((m) => m.round === effectiveViewRound)
    .filter(matchesCompetition);
  const roundMatches = myMatchesOnly && selectedTeam?.id
    ? roundMatchesRaw.filter((m) => m.home_team?.id === selectedTeam.id || m.away_team?.id === selectedTeam.id)
    : roundMatchesRaw;
  const displayTotalRounds =
    competitionFilter === "all"
      ? Math.max(
          totalRounds > 0 ? totalRounds : Math.max(2, (teams.length - 1) * 2),
          matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 1
        )
      : Math.max(1, maxRoundForFilter);

  const getMatchResultBadge = (match: Match) => {
    if (match.match_status !== "simulated" || match.home_score == null || match.away_score == null || !selectedTeam?.id) return null;
    const isHome = match.home_team?.id === selectedTeam.id;
    const our = isHome ? match.home_score : match.away_score;
    const opp = isHome ? match.away_score : match.home_score;
    const result = our > opp ? "W" : our < opp ? "L" : "D";
    const scoreStr = `${match.home_score}-${match.away_score}`;
    return { scoreStr, result };
  };

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={8} />
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
      <Toaster position="top-center" richColors />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Schedule</h2>
        <Badge variant="outline" className="text-sm">
          {isInternationalComp && stageOptions.length > 0
            ? `${stageOptions.length} Stage${stageOptions.length !== 1 ? "s" : ""}`
            : `${displayTotalRounds} Rounds`}
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
              <p className="text-xs text-muted-foreground mb-2">
                For international: use Populate International (Host Controls) to auto-generate the full round-robin (each team plays each other twice). This form is for adding individual matches or corrections.
              </p>
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
            <p className="text-lg font-medium mb-2">No schedule yet.</p>
            <p className="text-sm">Host must generate a schedule first.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
            <Select
              value={competitionFilter}
              onValueChange={(v) => {
                setCompetitionFilter(v);
                setViewRound(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Competition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All competitions</SelectItem>
                <SelectItem value="domestic">Domestic</SelectItem>
                <SelectItem value="ucl">UCL</SelectItem>
                <SelectItem value="uecl">UECL</SelectItem>
                <SelectItem value="uel">UEL</SelectItem>
                <SelectItem value="supercup">Super Cup</SelectItem>
              </SelectContent>
            </Select>
            {isInternationalComp && stageOptions.length > 0 ? (
              <Select
                value={String(effectiveViewRound)}
                onValueChange={(v) => setViewRound(Number(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((s) => (
                    <SelectItem key={s.round} value={String(s.round)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={viewRound <= 1}
                  onClick={() => setViewRound((v) => v - 1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <span className="text-lg font-bold min-w-[140px] text-center">
                  {currentStageLabel}
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
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={myMatchesOnly}
                onCheckedChange={(c) => setMyMatchesOnly(!!c)}
              />
              <Filter className="h-4 w-4 text-muted-foreground" />
              My matches only
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {roundMatches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No matches in this round</p>
            ) : (
              roundMatches.map((match) => {
                const isMyMatch = selectedTeam?.id && (match.home_team?.id === selectedTeam.id || match.away_team?.id === selectedTeam.id);
                const compLabel = match.competition_type === "ucl" ? "UCL" : match.competition_type === "uel" ? "UEL" : match.competition_type === "uecl" ? "UECL" : match.competition_type === "supercup" ? "Super Cup" : "Domestic";
                return (
                <Card
                  key={match.id}
                  className={`bg-neutral-900 border-neutral-800 ${isMyMatch ? "ring-2 ring-blue-500/60 border-blue-500/40" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        {match.competition_type && (
                          <Badge variant="outline" className="text-xs">
                            {compLabel}
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
                          <span className="text-2xl font-bold flex items-center gap-1.5">
                            {match.home_score} - {match.away_score}
                            {(() => {
                              const badge = getMatchResultBadge(match);
                              return badge ? (
                                <Badge
                                  variant={badge.result === "W" ? "default" : badge.result === "L" ? "destructive" : "secondary"}
                                  className="text-xs"
                                >
                                  {badge.result}
                                </Badge>
                              ) : null;
                            })()}
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
              );})
            )}
          </div>
        </>
      )}
    </div>
  );
}
