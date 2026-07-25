"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeague } from "@/contexts/LeagueContext";
import { ChevronDown, HelpCircle, Trophy } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";

type CompIndexEntry = {
  team_id: string;
  team_name: string;
  acronym: string;
  comp_index: number;
  hof_overall: number;
  hof_last_3: number;
  situation: string;
};

const SITUATION_STYLES: Record<string, string> = {
  "Above average": "bg-status-positive/15 text-status-positive",
  "Inside average": "bg-accent-muted text-accent-hover",
  "Below average": "bg-status-warning/15 text-status-warning",
  Critical: "bg-status-negative/15 text-status-negative",
  "N/A": "bg-surface-3 text-muted-foreground",
};

const RANK_ROW_TINT: Record<number, string> = {
  0: "bg-gold/[0.06]",
  1: "bg-foreground/[0.03]",
  2: "bg-status-warning/[0.04]",
};

const SituationBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      SITUATION_STYLES[status] || SITUATION_STYLES["N/A"]
    }`}
  >
    {status}
  </span>
);

export default function CompIndexPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [data, setData] = useState<CompIndexEntry[]>([]);
  const [howOpen, setHowOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLeagueId) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/league/compindex?leagueId=${encodeURIComponent(selectedLeagueId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to load CompIndex");
          setData([]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load CompIndex");
          setData([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId]);

  if (!selectedLeagueId) {
    return (
      <div className="p-8 flex flex-col gap-6">
        <Breadcrumbs />
        <PageHeader eyebrow="Overview" title="CompIndex Rankings" />
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2 text-foreground">Select a league and team to continue</p>
            <p className="text-sm">Choose a league from the Saves page to view CompIndex rankings.</p>
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

  if (error) {
    return (
      <div className="p-8 flex flex-col gap-6">
        <Breadcrumbs />
        <PageHeader eyebrow="Overview" title="CompIndex Rankings" />
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center text-status-negative">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const myRankIdx = data.findIndex((e) => e.team_id === selectedTeam?.id);
  const myEntry = myRankIdx >= 0 ? data[myRankIdx] : null;

  return (
    <div className="p-8 flex flex-col gap-6">
      <Breadcrumbs />
      <PageHeader
        eyebrow="Overview"
        title="CompIndex Rankings"
        subtitle="Squad strength and Hall of Fame standing across the league"
      />

      {/* Your Position — answers "where do I stand" before the full leaderboard */}
      {myEntry && (
        <div className="relative overflow-hidden rounded-lg border border-border-strong bg-surface p-6 flex flex-wrap items-end gap-x-10 gap-y-4 glow-blue">
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Your Rank</p>
            <p className="font-display text-6xl text-accent tabular-nums leading-none">#{myRankIdx + 1}</p>
            <p className="text-xs text-muted-foreground mt-1.5">of {data.length} clubs</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">CompIndex</p>
            <p className="text-2xl font-bold tabular-nums">{myEntry.comp_index.toFixed(2)}</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">HOF (Last 3)</p>
            <p className="text-2xl font-bold tabular-nums">{myEntry.hof_last_3}</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Situation</p>
            <SituationBadge status={myEntry.situation} />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <h2 className="font-display text-2xl flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" /> League Leaderboard
          </h2>
        </div>
        {data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2 text-foreground">No CompIndex data yet</p>
            <p className="text-sm">Complete seasons to build CompIndex and HOF rankings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0 mt-3">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead className="text-center">CompIndex</TableHead>
                  <TableHead className="text-center">HOF Last 3</TableHead>
                  <TableHead className="text-center">HOF Overall</TableHead>
                  <TableHead>Situation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry, idx) => {
                  const isUserTeam = selectedTeam?.id === entry.team_id;
                  return (
                    <TableRow
                      key={entry.team_id}
                      className={`border-b border-border/60 transition-colors duration-150 hover:bg-surface-3/60 ${
                        isUserTeam ? "bg-accent-muted hover:bg-accent-muted" : RANK_ROW_TINT[idx] || ""
                      }`}
                    >
                      <TableCell className="text-center font-bold tabular-nums">
                        {idx === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold bg-gold/15 text-gold">
                            {idx + 1}
                          </span>
                        ) : idx < 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold bg-surface-3 text-foreground">
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{idx + 1}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${isUserTeam ? "text-accent" : ""}`}>{entry.team_name}</span>
                        <span className="text-muted-foreground text-xs ml-1">({entry.acronym})</span>
                      </TableCell>
                      <TableCell className="text-center font-semibold tabular-nums">
                        {entry.comp_index.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{entry.hof_last_3}</TableCell>
                      <TableCell className="text-center tabular-nums">{entry.hof_overall}</TableCell>
                      <TableCell>
                        <SituationBadge status={entry.situation} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* How it works — reference info, de-emphasized below the actual content it explains */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setHowOpen(!howOpen)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-3/60 transition-colors duration-150"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" /> How CompIndex works
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${howOpen ? "rotate-180" : ""}`}
          />
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border pt-3">
            <p>
              CompIndex is based on your top 14 players by rating. Higher ratings = higher CompIndex. Situation
              badges indicate if you are above average, inside average, below average, or critical compared to
              league peers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
