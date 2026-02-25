"use client";

import { useState, useEffect } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Play, ArrowLeft, Check } from "lucide-react";
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
  match_mode?: "SIMULATED" | "MANUAL";
};

export default function InsertResultsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [league, setLeague] = useState<LeagueInfo | null>(null);
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

        const round = leagueInfo?.current_round ?? 1;
        const scheduleRes = await fetch(
          `/api/league/game?leagueId=${leagueId}&type=schedule&season=${leagueInfo?.season ?? 1}&round=${round}`
        );
        const scheduleData = await scheduleRes.json();

        if (scheduleData.success && scheduleData.data) {
          const matches = (scheduleData.data as MatchRow[]).filter(
            (m) => m.match_status === "scheduled"
          );
          setScheduledMatches(matches);
          if (matches.length > 0) {
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
  }, [leagueId, isHost, refreshKey]);

  const selectedMatch = scheduledMatches.find((m) => m.id === selMatchId);

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
        setRefreshKey((k) => k + 1);
        const nextIdx = scheduledMatches.findIndex((m) => m.id === selMatchId) + 1;
        if (nextIdx < scheduledMatches.length) {
          setSelMatchId(scheduledMatches[nextIdx].id);
        }
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
        <Card className="bg-neutral-900 border-neutral-800">
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
        <Card className="bg-neutral-900 border-neutral-800">
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <Toaster position="top-center" richColors />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Play className="h-7 w-7" /> Insert Match Results
          </h1>
          <p className="text-muted-foreground mt-1">
            Round {league?.current_round ?? "?"} of {league?.total_rounds ?? "?"} · {league?.name || selectedTeam?.leagues?.name || "League"}
          </p>
        </div>
        <Link href="/main/dashboard/host-controls">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
          </Button>
        </Link>
      </div>

      {scheduledMatches.length === 0 ? (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No scheduled matches in round {league?.current_round}. Generate schedule first or all results may be entered.
            </p>
            <Link href="/main/dashboard/host-controls">
              <Button variant="outline" className="mt-4">Host Controls</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Match list */}
          <Card className="bg-neutral-900 border-neutral-800 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Matches</CardTitle>
              <CardDescription>
                {scheduledMatches.length} match(es) in this round
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scheduledMatches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelMatchId(m.id);
                      setHomeScore("");
                      setAwayScore("");
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selMatchId === m.id
                        ? "border-primary bg-primary/10"
                        : "border-neutral-700 hover:border-neutral-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {m.home_team?.name ?? "Home"} vs {m.away_team?.name ?? "Away"}
                      </span>
                      {m.match_status !== "scheduled" && (
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right: Score entry */}
          <Card className="bg-neutral-900 border-neutral-800 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Enter Result</CardTitle>
              <CardDescription>
                {selectedMatch
                  ? `${selectedMatch.home_team?.name ?? "Home"} vs ${selectedMatch.away_team?.name ?? "Away"}`
                  : "Select a match"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedMatch && (
                <>
                  <div className="flex items-center justify-center gap-8">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg font-medium">{selectedMatch.home_team?.name ?? "Home"}</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        className="w-24 h-16 text-center text-2xl"
                      />
                    </div>
                    <span className="text-2xl text-muted-foreground">–</span>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-lg font-medium">{selectedMatch.away_team?.name ?? "Away"}</span>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        className="w-24 h-16 text-center text-2xl"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleInsert}
                    disabled={actionLoading || homeScore === "" || awayScore === ""}
                    className="w-full"
                    size="lg"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Save Result
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
