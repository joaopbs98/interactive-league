"use client";

import { useState, useEffect } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { getYoungsterUpgrade } from "@/lib/youngsterLogic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, TrendingUp, Users } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import Link from "next/link";
import { toast } from "sonner";
import { Toaster } from "sonner";

type YoungsterRow = {
  leaguePlayerId: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName?: string;
  teamAcronym?: string;
  positions: string;
  rating: number;
  baseRating: number;
  potential?: number | null;
  totalGames: number;
  computedAdjAvg: number;
  previewDelta: number;
  previewNewRating: number;
  performance: Record<string, number | null> | null;
};

export default function YoungsterUpgradesPage() {
  const { selectedLeagueId } = useLeague();
  const [youngsters, setYoungsters] = useState<YoungsterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [season, setSeason] = useState<number>(1);
  const [edits, setEdits] = useState<Record<string, { games?: number; domesticAvg?: number; uscAvg?: number; uclGsAvg?: number; uclKoAvg?: number; uelGsAvg?: number; uelKoAvg?: number; ueclGsAvg?: number; ueclKoAvg?: number }>>({});

  const leagueId = selectedLeagueId;

  useEffect(() => {
    if (!leagueId) {
      setLoading(false);
      return;
    }
    fetchYoungsters();
  }, [leagueId]);

  const fetchYoungsters = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/league/youngsters?leagueId=${leagueId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setYoungsters(data.data);
        setSeason(data.season ?? 1);
      } else {
        setYoungsters([]);
      }
    } catch (err) {
      console.error(err);
      setYoungsters([]);
    } finally {
      setLoading(false);
    }
  };

  const updateEdit = (leaguePlayerId: string, field: string, value: number | undefined) => {
    setEdits((prev) => ({
      ...prev,
      [leaguePlayerId]: {
        ...prev[leaguePlayerId],
        [field]: value === undefined || Number.isNaN(value) ? undefined : value,
      },
    }));
  };

  const getEffectiveGames = (row: YoungsterRow): number => {
    const e = edits[row.leaguePlayerId];
    if (e?.games !== undefined) return e.games;
    return row.totalGames;
  };

  const getEffectiveAdjAvg = (row: YoungsterRow): number => {
    const e = edits[row.leaguePlayerId];
    const avgs: number[] = [];
    if (e?.domesticAvg !== undefined) avgs.push(e.domesticAvg);
    if (e?.uscAvg !== undefined) avgs.push(e.uscAvg);
    if (e?.uclGsAvg !== undefined) avgs.push(e.uclGsAvg);
    if (e?.uclKoAvg !== undefined) avgs.push(e.uclKoAvg);
    if (e?.uelGsAvg !== undefined) avgs.push(e.uelGsAvg);
    if (e?.uelKoAvg !== undefined) avgs.push(e.uelKoAvg);
    if (e?.ueclGsAvg !== undefined) avgs.push(e.ueclGsAvg);
    if (e?.ueclKoAvg !== undefined) avgs.push(e.ueclKoAvg);
    if (avgs.length > 0) return avgs.reduce((a, b) => a + b, 0) / avgs.length;
    return row.computedAdjAvg;
  };

  const handleApplySingle = async (row: YoungsterRow) => {
    if (!leagueId) return;
    const games = getEffectiveGames(row);
    const adjAvg = getEffectiveAdjAvg(row);
    if (games >= 8 && adjAvg <= 0) {
      toast.error("Enter average ratings when games >= 8");
      return;
    }
    setActionLoading(row.leaguePlayerId);
    try {
      const res = await fetch("/api/league/youngsters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          season,
          updates: [{
            leaguePlayerId: row.leaguePlayerId,
            gamesPlayed: games,
            adjAvg,
            performance: edits[row.leaguePlayerId] ? {
              domestic_games: edits[row.leaguePlayerId]?.games,
              domestic_avg: edits[row.leaguePlayerId]?.domesticAvg,
              usc_avg: edits[row.leaguePlayerId]?.uscAvg,
              ucl_gs_avg: edits[row.leaguePlayerId]?.uclGsAvg,
              ucl_ko_avg: edits[row.leaguePlayerId]?.uclKoAvg,
              uel_gs_avg: edits[row.leaguePlayerId]?.uelGsAvg,
              uel_ko_avg: edits[row.leaguePlayerId]?.uelKoAvg,
              uecl_gs_avg: edits[row.leaguePlayerId]?.ueclGsAvg,
              uecl_ko_avg: edits[row.leaguePlayerId]?.ueclKoAvg,
            } : undefined,
          }],
        }),
      });
      const data = await res.json();
      if (data.success && data.results?.[0]) {
        toast.success(`${row.playerName}: ${data.results[0].delta >= 0 ? "+" : ""}${data.results[0].delta} OVR`);
        fetchYoungsters();
      } else {
        toast.error(data.error || data.results?.[0]?.error || "Apply failed");
      }
    } catch (err) {
      toast.error("Apply failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApplyAll = async () => {
    if (!leagueId || youngsters.length === 0) return;
    const valid = youngsters.filter((r) => {
      const g = getEffectiveGames(r);
      const a = getEffectiveAdjAvg(r);
      return g > 0 && (g < 8 || a > 0);
    });
    if (valid.length === 0) {
      toast.error("Enter games and (if >= 8) average ratings for at least one player");
      return;
    }
    setActionLoading("all");
    try {
      const res = await fetch("/api/league/youngsters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          season,
          updates: valid.map((r) => ({
            leaguePlayerId: r.leaguePlayerId,
            gamesPlayed: getEffectiveGames(r),
            adjAvg: getEffectiveAdjAvg(r),
            performance: edits[r.leaguePlayerId] ? {
              domestic_games: edits[r.leaguePlayerId]?.games,
              domestic_avg: edits[r.leaguePlayerId]?.domesticAvg,
              usc_avg: edits[r.leaguePlayerId]?.uscAvg,
              ucl_gs_avg: edits[r.leaguePlayerId]?.uclGsAvg,
              ucl_ko_avg: edits[r.leaguePlayerId]?.uclKoAvg,
              uel_gs_avg: edits[r.leaguePlayerId]?.uelGsAvg,
              uel_ko_avg: edits[r.leaguePlayerId]?.uelKoAvg,
              uecl_gs_avg: edits[r.leaguePlayerId]?.ueclGsAvg,
              uecl_ko_avg: edits[r.leaguePlayerId]?.ueclKoAvg,
            } : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        const applied = data.results?.filter((x: { error?: string }) => !x.error)?.length ?? 0;
        toast.success(`Applied upgrades for ${applied} player(s)`);
        fetchYoungsters();
      } else {
        toast.error(data.error || "Apply failed");
      }
    } catch (err) {
      toast.error("Apply failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (!leagueId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Select a league to manage youngster upgrades.</p>
        <Link href="/main/dashboard">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <Toaster position="top-center" richColors />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-7 w-7" /> Youngster Upgrades
          </h1>
          <p className="text-muted-foreground mt-1">
            Season {season} · Enter games played and average ratings per competition
          </p>
        </div>
        <Link href="/main/dashboard/host-controls">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
          </Button>
        </Link>
      </div>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Youngsters</CardTitle>
          <CardDescription>
            Host enters games and avg ratings (domestic, USC, UCL/UEL/UECL GS/KO). Adj. Avg = mean of entered avgs. Min 8 games for avg-based upgrade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {youngsters.length === 0 ? (
            <p className="text-muted-foreground">No youngsters in this league.</p>
          ) : (
            <>
              <Button
                onClick={handleApplyAll}
                disabled={!!actionLoading}
                className="mb-4"
              >
                {actionLoading === "all" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Apply All Upgrades
              </Button>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-700">
                      <th className="text-left p-2">Player</th>
                      <th className="text-left p-2">Team</th>
                      <th className="text-left p-2">Pos</th>
                      <th className="text-left p-2">OVR</th>
                      <th className="text-left p-2">Base</th>
                      <th className="text-left p-2">Pot</th>
                      <th className="text-left p-2">Games</th>
                      <th className="text-left p-2">Dom. Avg</th>
                      <th className="text-left p-2">Adj. Avg</th>
                      <th className="text-left p-2">Delta</th>
                      <th className="text-left p-2">New</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {youngsters.map((row) => {
                      const games = getEffectiveGames(row);
                      const adjAvg = getEffectiveAdjAvg(row);
                      const delta = getYoungsterUpgrade(row.baseRating, games, adjAvg);
                      const newRating = Math.min(99, Math.max(40, row.baseRating + delta));
                      return (
                        <tr key={row.leaguePlayerId} className="border-b border-neutral-800">
                          <td className="p-2 font-medium">{row.playerName}</td>
                          <td className="p-2">{row.teamAcronym || row.teamName || "—"}</td>
                          <td className="p-2">{row.positions}</td>
                          <td className="p-2">{row.rating}</td>
                          <td className="p-2">{row.baseRating}</td>
                          <td className="p-2">{row.potential ?? "—"}</td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              className="w-16 h-8 text-center"
                              value={(edits[row.leaguePlayerId]?.games ?? row.totalGames) || ""}
                              onChange={(e) => updateEdit(row.leaguePlayerId, "games", parseInt(e.target.value, 10))}
                              placeholder="0"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step={0.1}
                              min={0}
                              max={10}
                              className="w-16 h-8 text-center"
                              value={edits[row.leaguePlayerId]?.domesticAvg ?? row.performance?.domestic_avg ?? ""}
                              onChange={(e) => updateEdit(row.leaguePlayerId, "domesticAvg", parseFloat(e.target.value))}
                              placeholder="—"
                            />
                          </td>
                          <td className="p-2 text-muted-foreground">{adjAvg > 0 ? adjAvg.toFixed(2) : "—"}</td>
                          <td className="p-2">
                            <span className={delta >= 0 ? "text-green-500" : "text-red-500"}>
                              {delta >= 0 ? "+" : ""}{delta}
                            </span>
                          </td>
                          <td className="p-2">{newRating}</td>
                          <td className="p-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApplySingle(row)}
                              disabled={!!actionLoading}
                            >
                              {actionLoading === row.leaguePlayerId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
