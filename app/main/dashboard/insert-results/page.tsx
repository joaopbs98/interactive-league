"use client";

import { useState, useEffect } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Play, ArrowLeft, Check } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Link from "next/link";
import { toast } from "sonner";
import { Toaster } from "sonner";

type MatchRow = {
  id: string;
  round: number;
  home_team_id: string;
  away_team_id: string;
  match_status: string;
  home_score?: number | null;
  away_score?: number | null;
  home_team?: { id: string; name: string; acronym?: string };
  away_team?: { id: string; name: string; acronym?: string };
};

type LeagueInfo = {
  id: string;
  name: string;
  season: number;
  status: string;
  current_round: number;
  total_rounds: number;
  current_round_ucl?: number;
  current_round_uel?: number;
  current_round_uecl?: number;
  match_mode?: "SIMULATED" | "MANUAL";
};

type CompetitionType = "domestic" | "ucl" | "uel" | "uecl" | "supercup";

export default function InsertResultsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [competitionType, setCompetitionType] = useState<CompetitionType>("domestic");
  const [scheduledMatches, setScheduledMatches] = useState<MatchRow[]>([]);
  const [selMatchId, setSelMatchId] = useState<string>("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const leagueId = selectedLeagueId;
  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

  useEffect(() => {
    if (!leagueId || !isHost) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        const leagueRes = await fetch(`/api/league/game?leagueId=${leagueId}&type=league_info`);
        const leagueData = await leagueRes.json();
        const leagueInfo = leagueData.success ? leagueData.data : null;
        if (leagueInfo) setLeague(leagueInfo);

        const round =
          competitionType === "domestic"
            ? Math.max(1, leagueInfo?.current_round ?? 1)
            : competitionType === "ucl"
              ? Math.max(1, leagueInfo?.current_round_ucl ?? 1)
              : competitionType === "uel"
                ? Math.max(1, leagueInfo?.current_round_uel ?? 1)
                : competitionType === "uecl"
                  ? Math.max(1, leagueInfo?.current_round_uecl ?? 1)
                  : 1; /* supercup always round 1 */
        const scheduleRes = await fetch(
          `/api/league/game?leagueId=${leagueId}&type=schedule&season=${leagueInfo?.season ?? 1}&round=${round}&competition_type=${competitionType}`
        );
        const scheduleData = await scheduleRes.json();

        if (scheduleData.success && scheduleData.data) {
          // Keep the whole round (not just unfilled matches) so completed ones stay visible
          // as a checklist — previously this filtered to "scheduled" only, which meant a
          // match vanished the instant its result was entered, with no completion feedback.
          const matches = scheduleData.data as MatchRow[];
          setScheduledMatches(matches);
          const stillOpen = matches.filter((m) => m.match_status === "scheduled");
          if (stillOpen.length > 0) {
            setSelMatchId((prev) => (stillOpen.some((m) => m.id === prev) ? prev : stillOpen[0].id));
          } else if (matches.length > 0) {
            setSelMatchId((prev) => (matches.some((m) => m.id === prev) ? prev : matches[0].id));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [leagueId, isHost, refreshKey, competitionType]);

  const selectedMatch = scheduledMatches.find((m) => m.id === selMatchId);

  const currentRound =
    competitionType === "domestic"
      ? Math.max(1, league?.current_round ?? 1)
      : competitionType === "ucl"
        ? Math.max(1, league?.current_round_ucl ?? 1)
        : competitionType === "uel"
          ? Math.max(1, league?.current_round_uel ?? 1)
          : competitionType === "uecl"
            ? Math.max(1, league?.current_round_uecl ?? 1)
            : 1; /* supercup */

  const roundLabel =
    competitionType === "domestic"
      ? `Round ${currentRound} of ${league?.total_rounds ?? "?"}`
      : competitionType === "supercup"
        ? "Super Cup"
        : `${competitionType.toUpperCase()} Matchday ${currentRound}`;

  const handleInsert = async () => {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error("Enter valid scores");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "insert_result",
          leagueId,
          matchId: selMatchId,
          homeScore: h,
          awayScore: a,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Result saved");
        setHomeScore("");
        setAwayScore("");
        // The refetch below re-selects the next still-open match automatically
        setRefreshKey((k) => k + 1);
      } else {
        toast.error(data.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isHost) {
    return (
      <div className="p-8">
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium">Host Only</p>
            <p className="text-sm text-muted-foreground mt-2">
              Only the league commissioner can insert match results.
            </p>
            <Link href="/main/dashboard">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!leagueId || !selectedTeam) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Select a league and team to continue.</p>
        <Link href="/saves">
          <Button variant="outline" className="mt-4">Go to Saves</Button>
        </Link>
      </div>
    );
  }

  if (league?.match_mode !== "MANUAL") {
    return (
      <div className="p-8">
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium">Manual Mode Only</p>
            <p className="text-sm text-muted-foreground mt-2">
              Insert Results is available when the league uses MANUAL match mode.
            </p>
            <Link href="/main/dashboard/host-controls">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  const enteredCount = scheduledMatches.filter((m) => m.match_status !== "scheduled").length;

  return (
    <div className="p-8 flex flex-col gap-6">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader
        eyebrow="League"
        title="Insert Match Results"
        subtitle={`${roundLabel} · ${league?.name || selectedTeam?.leagues?.name || "League"}`}
        stats={
          scheduledMatches.length > 0
            ? [{ label: "Entered", value: `${enteredCount}/${scheduledMatches.length}`, emphasis: true }]
            : undefined
        }
        actions={
          <Link href="/main/dashboard/host-controls">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
            </Button>
          </Link>
        }
      />

      <Tabs value={competitionType} onValueChange={(v) => setCompetitionType(v as CompetitionType)}>
        <TabsList className="mb-4">
          <TabsTrigger value="domestic">Domestic</TabsTrigger>
          <TabsTrigger value="ucl">UCL</TabsTrigger>
          <TabsTrigger value="uel">UEL</TabsTrigger>
          <TabsTrigger value="uecl">UECL</TabsTrigger>
          <TabsTrigger value="supercup">Super Cup</TabsTrigger>
        </TabsList>
        {(["domestic", "ucl", "uel", "uecl", "supercup"] as const).map((comp) => (
          <TabsContent key={comp} value={comp} className="mt-0">
            {scheduledMatches.length === 0 ? (
              <Card className="bg-surface border-border">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No scheduled matches in {comp === "domestic" ? "domestic" : comp === "supercup" ? "Super Cup" : comp.toUpperCase()} round {currentRound}. Generate schedule first or all results may be entered.
                  </p>
                  <Link href="/main/dashboard/host-controls">
                    <Button variant="outline" className="mt-4">Host Controls</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-lg border border-border-strong bg-surface overflow-hidden lg:col-span-1">
                  <div className="px-5 pt-4 pb-1">
                    <h2 className="font-display text-xl">Matches</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{enteredCount} of {scheduledMatches.length} entered</p>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    {scheduledMatches.map((m) => {
                      const isDone = m.match_status !== "scheduled";
                      return (
                        <button
                          key={m.id}
                          onClick={() => { setSelMatchId(m.id); setHomeScore(""); setAwayScore(""); }}
                          className={`w-full text-left p-3 rounded-lg border transition-colors duration-150 ${
                            selMatchId === m.id
                              ? "border-accent bg-accent-muted"
                              : isDone
                                ? "border-border bg-surface-2 opacity-70"
                                : "border-border hover:border-border-strong"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{m.home_team?.name ?? "Home"} vs {m.away_team?.name ?? "Away"}</span>
                            {isDone ? (
                              <span className="flex items-center gap-1.5 text-status-positive shrink-0">
                                <span className="text-xs font-bold tabular-nums">{m.home_score}-{m.away_score}</span>
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground shrink-0">Pending</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-lg border border-border-strong bg-surface overflow-hidden lg:col-span-2">
                  <div className="px-6 pt-5 pb-1">
                    <h2 className="font-display text-xl">Enter Result</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedMatch ? `${selectedMatch.home_team?.name ?? "Home"} vs ${selectedMatch.away_team?.name ?? "Away"}` : "Select a match"}
                    </p>
                  </div>
                  <div className="p-6 pt-4 flex flex-col gap-6">
                    {selectedMatch && selectedMatch.match_status === "scheduled" ? (
                      <>
                        <div className="flex items-center justify-center gap-8">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-lg font-medium">{selectedMatch.home_team?.name ?? "Home"}</span>
                            <Input type="number" min={0} placeholder="0" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className="w-24 h-16 text-center text-2xl" />
                          </div>
                          <span className="text-2xl text-muted-foreground">–</span>
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-lg font-medium">{selectedMatch.away_team?.name ?? "Away"}</span>
                            <Input type="number" min={0} placeholder="0" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className="w-24 h-16 text-center text-2xl" />
                          </div>
                        </div>
                        <Button onClick={handleInsert} disabled={actionLoading || homeScore === "" || awayScore === ""} className="w-full" size="lg">
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                          Save Result
                        </Button>
                      </>
                    ) : selectedMatch ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <span className="flex items-center gap-1.5 text-status-positive text-sm font-medium">
                          <Check className="h-4 w-4" /> Result already entered
                        </span>
                        <span className="text-3xl font-bold tabular-nums">{selectedMatch.home_score} - {selectedMatch.away_score}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
