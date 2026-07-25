"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";
import { ArrowRightLeft, Trophy } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Team = { id: string; name: string; acronym: string };
type SquadPlayer = { id: string; name: string; position: string; rating?: number };

function formatMoney(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export default function TeamComparisonPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [teams, setTeams] = useState<Team[]>([]);
  const [opponentId, setOpponentId] = useState<string>("");
  const [ourSquad, setOurSquad] = useState<SquadPlayer[]>([]);
  const [theirSquad, setTheirSquad] = useState<SquadPlayer[]>([]);
  const [ourWage, setOurWage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedLeagueId) {
      setTeams([]);
      setLoading(false);
      return;
    }
    fetch(`/api/league/teams?leagueId=${selectedLeagueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) setTeams(d.data);
        else setTeams([]);
      })
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, [selectedLeagueId]);

  useEffect(() => {
    if (!selectedLeagueId || !selectedTeam?.id) return;
    setOpponentId("");
    fetch(`/api/user/team/${selectedLeagueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.team?.squad) {
          const squad = d.team.squad as { player_id: string; full_name?: string; player_name?: string; positions?: string; rating?: number; overall_rating?: number; wage?: number }[];
          setOurSquad(
            squad
              .map((p) => ({
                id: p.player_id,
                name: p.full_name || p.player_name || p.player_id,
                position: (p.positions || "").split(",")[0]?.trim() || "",
                rating: p.rating ?? p.overall_rating,
              }))
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          );
          setOurWage(squad.reduce((sum, p) => sum + (p.wage ?? 0), 0));
        } else {
          setOurSquad([]);
          setOurWage(0);
        }
      })
      .catch(() => {
        setOurSquad([]);
        setOurWage(0);
      });
  }, [selectedLeagueId, selectedTeam?.id]);

  useEffect(() => {
    if (!selectedLeagueId || !opponentId) {
      setTheirSquad([]);
      return;
    }
    fetch(`/api/league/team-squad?leagueId=${selectedLeagueId}&teamId=${opponentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.squad) {
          const sq = (d.squad as { id: string; name: string; position: string; rating?: number }[]).map((p) => ({
            ...p,
            rating: p.rating,
          }));
          setTheirSquad(sq.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)));
        } else {
          setTheirSquad([]);
        }
      })
      .catch(() => setTheirSquad([]));
  }, [selectedLeagueId, opponentId]);

  const ourAvg = ourSquad.length > 0
    ? Math.round(ourSquad.reduce((s, p) => s + (p.rating ?? 0), 0) / ourSquad.length)
    : 0;
  const theirAvg = theirSquad.length > 0
    ? Math.round(theirSquad.reduce((s, p) => s + (p.rating ?? 0), 0) / theirSquad.length)
    : 0;
  const ourTop14 = ourSquad.slice(0, 14);
  const theirTop14 = theirSquad.slice(0, 14);
  const maxRows = Math.max(ourTop14.length, theirTop14.length);

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  if (!selectedTeam || !selectedLeagueId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Select a league and team to compare.</p>
      </div>
    );
  }

  const opponents = teams.filter((t) => t.id !== selectedTeam.id);
  const opponentName = opponents.find((t) => t.id === opponentId)?.name ?? "Opponent";

  return (
    <div className="p-8 flex flex-col gap-6">
      <Breadcrumbs />
      <PageHeader eyebrow="League" title="Team Comparison" subtitle="Compare squad strength head-to-head" />

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Compare with:</span>
        <Select value={opponentId} onValueChange={setOpponentId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select opponent" />
          </SelectTrigger>
          <SelectContent>
            {opponents.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.acronym})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!opponentId ? (
        <div className="rounded-lg border border-border-strong bg-surface p-8 text-center text-muted-foreground">
          Select an opponent to compare squads.
        </div>
      ) : (
        <>
          {/* Head-to-head — one panel, two sides, differences highlighted instead of two duplicate cards */}
          <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="p-6 flex flex-col gap-3">
                <p className="font-display text-xl truncate">{selectedTeam.name}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg rating</span>
                  <span className={`font-bold tabular-nums ${ourAvg >= theirAvg ? "text-status-positive" : ""}`}>{ourAvg}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wage bill</span>
                  <span className="font-bold tabular-nums">{formatMoney(ourWage)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Squad size</span>
                  <span className="font-bold tabular-nums">{ourSquad.length}</span>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-xl truncate">{opponentName}</p>
                  <Link href={`/main/dashboard/team/${opponentId}/squad?league=${selectedLeagueId}`}>
                    <Button variant="outline" size="sm" className="shrink-0">
                      View squad
                    </Button>
                  </Link>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg rating</span>
                  <span className={`font-bold tabular-nums ${theirAvg > ourAvg ? "text-status-positive" : ""}`}>{theirAvg}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wage bill</span>
                  <span className="font-bold text-muted-foreground">Not public</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Squad size</span>
                  <span className="font-bold tabular-nums">{theirSquad.length}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-border px-6 py-3 flex justify-center">
              <Link href={`/main/dashboard/trades?league=${selectedLeagueId}&proposeTo=${opponentId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Propose a Trade with {opponentName}
                </Button>
              </Link>
            </div>
          </div>

          {/* Top 14 comparison — per-row winner highlighted, not just two flat lists */}
          <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
            <div className="px-6 pt-5 pb-1 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-2xl">Top 14 by Rating</h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border mt-3">
              <div className="px-6 pb-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 truncate">{selectedTeam.name}</p>
                <div className="space-y-1">
                  {Array.from({ length: maxRows }).map((_, i) => {
                    const p = ourTop14[i];
                    const opp = theirTop14[i];
                    const better = p && opp ? (p.rating ?? 0) > (opp.rating ?? 0) : !!p && !opp;
                    if (!p) return <div key={i} className="h-6" />;
                    return (
                      <div key={p.id} className="flex justify-between text-sm py-0.5">
                        <span className="truncate">{i + 1}. {p.name}</span>
                        <span className={`font-medium tabular-nums shrink-0 ml-2 ${better ? "text-status-positive" : ""}`}>{p.rating ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-6 pb-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 truncate">{opponentName}</p>
                <div className="space-y-1">
                  {Array.from({ length: maxRows }).map((_, i) => {
                    const p = theirTop14[i];
                    const opp = ourTop14[i];
                    const better = p && opp ? (p.rating ?? 0) > (opp.rating ?? 0) : !!p && !opp;
                    if (!p) return <div key={i} className="h-6" />;
                    return (
                      <div key={p.id} className="flex justify-between text-sm py-0.5">
                        <span className="truncate">{i + 1}. {p.name}</span>
                        <span className={`font-medium tabular-nums shrink-0 ml-2 ${better ? "text-status-positive" : ""}`}>{p.rating ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
