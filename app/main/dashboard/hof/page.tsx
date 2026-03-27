"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, HelpCircle } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface HofEntry {
  team_id: string;
  team_name: string;
  hof_overall: number;
  hof_last_3: number;
  seasons: { season: number; position: number; points: number }[];
}

const LAST3_THRESHOLDS = { poor: 11, good: 23 };
const OVERALL_THRESHOLDS = { poor: 27, good: 41 };

function situationBadge(
  value: number,
  thresholds: { poor: number; good: number }
) {
  if (value >= thresholds.good)
    return <Badge variant="default">EXCELLENT!</Badge>;
  if (value <= thresholds.poor)
    return <Badge variant="destructive">POOR!</Badge>;
  return <Badge variant="secondary">OK</Badge>;
}

export default function HofPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [data, setData] = useState<HofEntry[]>([]);
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
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">🏆 Hall of Fame Standings</h1>
        <p className="text-muted-foreground">Select a league to view Hall of Fame standings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">🏆 Hall of Fame Standings</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">🏆 Hall of Fame Standings</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <Breadcrumbs />
      <h1 className="text-2xl font-bold">🏆 Hall of Fame Standings</h1>

      <Card className="bg-neutral-900 border-neutral-800">
        <button
          type="button"
          onClick={() => setHowOpen(!howOpen)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-800/50"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> How it works
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${howOpen ? "rotate-180" : ""}`} />
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-neutral-800 pt-4">
            <p>HOF points are earned from league position each season. Last 3 = sum of points from your last 3 seasons. Overall = total across all seasons. EXCELLENT = above threshold, POOR = below threshold.</p>
          </div>
        )}
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]">#</TableHead>
            <TableHead>Club</TableHead>
            <TableHead className="text-center">HOF Last 3</TableHead>
            <TableHead className="text-center">Situation</TableHead>
            <TableHead className="text-center">HOF Overall</TableHead>
            <TableHead className="text-center">Situation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((entry, idx) => (
            <TableRow
              key={entry.team_id}
              className={selectedTeam?.id === entry.team_id ? "bg-blue-900/20" : ""}
            >
              <TableCell>{idx + 1}</TableCell>
              <TableCell>{entry.team_name}</TableCell>
              <TableCell className="text-center">{entry.hof_last_3}</TableCell>
              <TableCell className="text-center">
                {situationBadge(entry.hof_last_3, LAST3_THRESHOLDS)}
              </TableCell>
              <TableCell className="text-center">{entry.hof_overall}</TableCell>
              <TableCell className="text-center">
                {situationBadge(entry.hof_overall, OVERALL_THRESHOLDS)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.length === 0 && (
        <p className="text-muted-foreground mt-4">
          No Hall of Fame data yet. Complete a season to earn HOF points.
        </p>
      )}
    </div>
  );
}
