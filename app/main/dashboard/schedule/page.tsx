"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { ManualScheduleForm } from "@/components/schedule/ManualScheduleForm";
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Calendar, Shield, Trash2, Filter } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(() => {
    const value = Number(searchParams.get('season'));
    return value > 0 ? value : null;
  });

  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

  useEffect(() => {
    if (!selectedLeagueId) return;
    fetchAll(selectedSeason ?? undefined);
  }, [selectedLeagueId]);

  const fetchAll = async (seasonOverride?: number) => {
    if (!selectedLeagueId) return;
    setLoading(true);
    try {
      const [scheduleRes, leagueRes, teamsRes] = await Promise.all([
        fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=schedule${seasonOverride || selectedSeason ? `&season=${seasonOverride || selectedSeason}` : ''}`),
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
      if (leagueData.success) {
        setLeague(leagueData.data);
        setSelectedSeason((current) => current ?? leagueData.data.season);
      }
      if (teamsData.success || teamsData.data) setTeams(teamsData.data || []);
    } catch (err) {
      console.error("Failed to load schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  const changeSeason = async (value: string) => {
    const season = Number(value);
    setSelectedSeason(season);
    router.replace(`/main/dashboard/schedule?league=${selectedLeagueId}&season=${season}`);
    setViewRound(1);
    setLoading(true);
    try {
      const response = await fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=schedule&season=${season}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Could not load season schedule');
      setMatches(data.data || []);
      setCurrentRound(season === league?.season ? data.meta?.current_round || 1 : 1);
      setTotalRounds(data.meta?.total_rounds || 0);
    } catch (error: any) {
      toast.error(error.message || 'Could not load season schedule');
    } finally { setLoading(false); }
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
      else toast.error(data.error || "Failed to delete");
    } catch {
      toast.error("Failed to delete");
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

  const compLabelFor = (m: Match) =>
    m.competition_type === "ucl" ? "UCL" : m.competition_type === "uel" ? "UEL" : m.competition_type === "uecl" ? "UECL" : m.competition_type === "supercup" ? "Super Cup" : "Domestic";

  // "My Fixtures" — the whole season for the selected team in one chronological list,
  // instead of forcing round-by-round pagination just to see your own matches.
  const myFixtures = (selectedTeam?.id
    ? matches.filter((m) => (m.home_team?.id === selectedTeam.id || m.away_team?.id === selectedTeam.id) && matchesCompetition(m))
    : []
  ).slice().sort((a, b) => a.round - b.round);
  const nextFixtureIdx = myFixtures.findIndex((m) => m.match_status !== "simulated");

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
        <div className="rounded-lg border border-border-strong bg-surface p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2 text-foreground">Select a league</p>
          <p className="text-sm">Choose a league from the Saves page to view the schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader
        eyebrow="League"
        title="Schedule"
        stats={[
          {
            label: isInternationalComp && stageOptions.length > 0 ? "Stages" : "Rounds",
            value: isInternationalComp && stageOptions.length > 0 ? stageOptions.length : displayTotalRounds,
            emphasis: true,
          },
        ]}
      />

      {/* Season progress — at-a-glance sense of where the season stands */}
      {totalRounds > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Season progress</span>
            <span className="font-medium tabular-nums">Round {Math.min(currentRound, totalRounds)} of {totalRounds}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round(((currentRound - 1) / totalRounds) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Message banner */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            message.type === "success"
              ? "bg-status-positive/10 text-status-positive border-status-positive/30"
              : "bg-status-negative/10 text-status-negative border-status-negative/30"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Host: Manage Schedule — collapsed by default so admin tools don't dominate the page for everyone */}
      {isHost && selectedSeason === league?.season && (
        <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-3/60 transition-colors duration-150"
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-display text-2xl">Manage Schedule</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${manageOpen ? "rotate-180" : ""}`} />
          </button>
          {manageOpen && (
          <div className="px-6 pb-6 pt-1 flex flex-col gap-4 border-t border-border">
            <p className="text-sm text-muted-foreground mt-3">
              Validate registration, generate round-robin, or manually add fixtures.
            </p>
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
          </div>
          )}
        </div>
      )}

      {/* Round selector + matches */}
      {matches.length === 0 && !isHost ? (
        <div className="rounded-lg border border-border-strong bg-surface p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2 text-foreground">No schedule yet.</p>
          <p className="text-sm">Host must generate a schedule first.</p>
        </div>
      ) : (
        <>
          {/* Default to the team's own season at a glance; full round-by-round browsing is opt-in */}
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex self-start rounded-lg border border-border-strong bg-surface p-1 gap-1">
            <button
              type="button"
              onClick={() => setViewMode("mine")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                viewMode === "mine" ? "bg-accent-muted text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Fixtures
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                viewMode === "all" ? "bg-accent-muted text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Browse Rounds
            </button>
          </div>
          {league && league.season > 1 && <Select value={String(selectedSeason ?? league.season)} onValueChange={changeSeason}>
            <SelectTrigger className="w-36" aria-label="Season"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: league.season }, (_, index) => league.season - index).map((season) => <SelectItem key={season} value={String(season)}>Season {season}</SelectItem>)}</SelectContent>
          </Select>}
          </div>

          {viewMode === "mine" ? (
            <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
              {myFixtures.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {selectedTeam?.id ? "No fixtures found for your team." : "Select a team to see your fixtures."}
                </p>
              ) : (
                myFixtures.map((match, idx) => {
                  const isNext = idx === nextFixtureIdx;
                  const isHome = match.home_team?.id === selectedTeam?.id;
                  const opponent = isHome ? match.away_team : match.home_team;
                  const badge = getMatchResultBadge(match);
                  return (
                    <div
                      key={match.id}
                      className={`flex items-center justify-between p-4 ${idx > 0 ? "border-t border-border" : ""} ${
                        isNext ? "bg-accent-muted" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">R{match.round}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{compLabelFor(match)}</Badge>
                        <span className="text-xs text-faint-foreground shrink-0">{isHome ? "vs" : "@"}</span>
                        {opponent?.logo_url && <img src={opponent.logo_url} alt="" className="w-6 h-6 rounded shrink-0" />}
                        {opponent?.id && selectedLeagueId ? (
                          <Link
                            href={`/main/dashboard/team/${opponent.id}/squad?league=${selectedLeagueId}`}
                            className="font-medium truncate hover:text-accent hover:underline"
                          >
                            {opponent.name || "TBD"}
                          </Link>
                        ) : (
                          <span className="font-medium truncate">{opponent?.name || "TBD"}</span>
                        )}
                        {isNext && (
                          <Badge className="bg-accent text-accent-foreground text-xs shrink-0">Next</Badge>
                        )}
                      </div>
                      <div className="shrink-0">
                        {match.match_status === "simulated" ? (
                          <Link href={`/main/dashboard/matches/${match.id}?league=${selectedLeagueId}&season=${selectedSeason ?? league?.season ?? 1}`} className="text-lg font-bold flex items-center gap-1.5 tabular-nums rounded-md px-2 py-1 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`View ${match.home_team?.name} ${match.home_score} to ${match.away_score} ${match.away_team?.name} match detail`}>
                            {match.home_score} - {match.away_score}
                            {badge && (
                              <Badge
                                variant={badge.result === "W" ? "default" : badge.result === "L" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {badge.result}
                              </Badge>
                            )}
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-xs">Scheduled</Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
          <>
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
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

          <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
            {roundMatches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No matches in this round</p>
            ) : (
              roundMatches.map((match, idx) => {
                const isMyMatch = selectedTeam?.id && (match.home_team?.id === selectedTeam.id || match.away_team?.id === selectedTeam.id);
                const compLabel = match.competition_type === "ucl" ? "UCL" : match.competition_type === "uel" ? "UEL" : match.competition_type === "uecl" ? "UECL" : match.competition_type === "supercup" ? "Super Cup" : "Domestic";
                return (
                  <div
                    key={match.id}
                    className={`p-4 ${idx > 0 ? "border-t border-border" : ""} ${isMyMatch ? "bg-accent-muted" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        {match.competition_type && (
                          <Badge variant="outline" className="text-xs">
                            {compLabel}
                          </Badge>
                        )}
                        {match.home_team?.id && selectedLeagueId ? (
                          <Link
                            href={`/main/dashboard/team/${match.home_team.id}/squad?league=${selectedLeagueId}`}
                            className="font-medium text-right hover:text-accent hover:underline"
                          >
                            {match.home_team.name || "TBD"}
                          </Link>
                        ) : (
                          <span className="font-medium text-right">{match.home_team?.name || "TBD"}</span>
                        )}
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
                          <Link href={`/main/dashboard/matches/${match.id}?league=${selectedLeagueId}&season=${selectedSeason ?? league?.season ?? 1}`} className="text-2xl font-bold flex items-center gap-1.5 tabular-nums rounded-md px-2 py-1 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`View ${match.home_team?.name} ${match.home_score} to ${match.away_score} ${match.away_team?.name} match detail`}>
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
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Scheduled
                          </Badge>
                        )}
                        {isHost && match.match_status === "scheduled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-status-negative hover:text-status-negative"
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
                        {match.away_team?.id && selectedLeagueId ? (
                          <Link
                            href={`/main/dashboard/team/${match.away_team.id}/squad?league=${selectedLeagueId}`}
                            className="font-medium hover:text-accent hover:underline"
                          >
                            {match.away_team.name || "TBD"}
                          </Link>
                        ) : (
                          <span className="font-medium">{match.away_team?.name || "TBD"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
