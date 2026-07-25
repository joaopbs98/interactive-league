"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeague } from "@/contexts/LeagueContext";
import { ChevronDown, ChevronRight, HelpCircle, Trophy } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

interface HofEntry {
  team_id: string;
  team_name: string;
  hof_overall: number;
  hof_last_3: number;
  seasons: { season: number; position: number; points: number }[];
}

const LAST3_THRESHOLDS = { poor: 11, good: 23 };
const OVERALL_THRESHOLDS = { poor: 27, good: 41 };

const RANK_ROW_TINT: Record<number, string> = {
  0: "bg-gold/[0.06]",
  1: "bg-foreground/[0.03]",
  2: "bg-status-warning/[0.04]",
};

function situationBadge(
  value: number,
  thresholds: { poor: number; good: number }
) {
  if (value >= thresholds.good)
    return <Badge className="bg-status-positive/15 text-status-positive">Excellent</Badge>;
  if (value <= thresholds.poor)
    return <Badge className="bg-status-negative/15 text-status-negative">Poor</Badge>;
  return <Badge variant="secondary">OK</Badge>;
}

export default function HofPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [data, setData] = useState<HofEntry[]>([]);
  const [howOpen, setHowOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
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

    fetch(`/api/league/hof?leagueId=${encodeURIComponent(selectedLeagueId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to load HOF");
          setData([]);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load HOF");
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
        <PageHeader eyebrow="League" title="Hall of Fame" />
        <p className="text-muted-foreground">Select a league to view Hall of Fame standings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col gap-6">
        <Breadcrumbs />
        <PageHeader eyebrow="League" title="Hall of Fame" />
        <p className="text-status-negative">{error}</p>
      </div>
    );
  }

  const myRankIdx = data.findIndex((e) => e.team_id === selectedTeam?.id);
  const myEntry = myRankIdx >= 0 ? data[myRankIdx] : null;

  return (
    <div className="p-8 flex flex-col gap-6">
      <Breadcrumbs />
      <PageHeader eyebrow="League" title="Hall of Fame" subtitle="All-time standing, earned from league position each season" />

      {/* Your Standing — same spotlight pattern as CompIndex/Standings */}
      {myEntry && (
        <div className="relative overflow-hidden rounded-lg border border-border-strong bg-surface p-6 flex flex-wrap items-end gap-x-10 gap-y-4 glow-blue">
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Your Rank</p>
            <p className="font-display text-6xl text-accent tabular-nums leading-none">#{myRankIdx + 1}</p>
            <p className="text-xs text-muted-foreground mt-1.5">of {data.length} clubs</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">HOF Last 3</p>
            <p className="text-2xl font-bold tabular-nums">{myEntry.hof_last_3}</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">HOF Overall</p>
            <p className="text-2xl font-bold tabular-nums">{myEntry.hof_overall}</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Situation</p>
            {situationBadge(myEntry.hof_overall, OVERALL_THRESHOLDS)}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
        <div className="px-6 pt-5 pb-1 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-2xl">All-Time Leaderboard</h2>
        </div>
        {data.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center">
            No Hall of Fame data yet. Complete a season to earn HOF points.
          </p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[30px]">#</TableHead>
                <TableHead></TableHead>
                <TableHead>Club</TableHead>
                <TableHead className="text-center">HOF Last 3</TableHead>
                <TableHead className="text-center">Situation</TableHead>
                <TableHead className="text-center">HOF Overall</TableHead>
                <TableHead className="text-center">Situation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((entry, idx) => {
                const isUserTeam = selectedTeam?.id === entry.team_id;
                const isExpanded = expanded === entry.team_id;
                return (
                  <React.Fragment key={entry.team_id}>
                    <TableRow
                      className={`cursor-pointer transition-colors duration-150 hover:bg-surface-3/60 ${
                        isUserTeam ? "bg-accent-muted hover:bg-accent-muted" : RANK_ROW_TINT[idx] || ""
                      }`}
                      onClick={() => setExpanded(isExpanded ? null : entry.team_id)}
                    >
                      <TableCell className="font-bold tabular-nums">
                        {idx === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold bg-gold/15 text-gold">{idx + 1}</span>
                        ) : idx < 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold bg-surface-3 text-foreground">{idx + 1}</span>
                        ) : (
                          <span className="text-muted-foreground">{idx + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="w-6 pr-0">
                        {entry.seasons?.length > 0 && (
                          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                        )}
                      </TableCell>
                      <TableCell className={`font-medium ${isUserTeam ? "text-accent" : ""}`}>{entry.team_name}</TableCell>
                      <TableCell className="text-center tabular-nums">{entry.hof_last_3}</TableCell>
                      <TableCell className="text-center">
                        {situationBadge(entry.hof_last_3, LAST3_THRESHOLDS)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{entry.hof_overall}</TableCell>
                      <TableCell className="text-center">
                        {situationBadge(entry.hof_overall, OVERALL_THRESHOLDS)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && entry.seasons?.length > 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="bg-surface-2 p-0">
                          <div className="px-6 py-3 flex flex-wrap gap-x-8 gap-y-2">
                            {entry.seasons
                              .slice()
                              .sort((a, b) => b.season - a.season)
                              .map((s) => (
                                <div key={s.season} className="text-sm">
                                  <span className="text-muted-foreground">S{s.season}: </span>
                                  <span className="font-medium">
                                    {s.position === 1 ? "1st" : s.position === 2 ? "2nd" : s.position === 3 ? "3rd" : `${s.position}th`}
                                  </span>
                                  <span className="text-muted-foreground"> · {s.points} pts</span>
                                </div>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* How it works — reference info, de-emphasized below the leaderboard */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setHowOpen(!howOpen)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-3/60 transition-colors duration-150"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" /> How Hall of Fame works
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${howOpen ? "rotate-180" : ""}`} />
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border pt-3">
            <p>
              HOF points are earned from league position each season. Last 3 = sum of points from your last 3
              seasons. Overall = total across all seasons. Click a row to see the season-by-season breakdown.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
