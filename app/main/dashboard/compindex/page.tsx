"use client";

import { useEffect, useState } from "react";
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
import { Loader2 } from "lucide-react";

type CompIndexEntry = {
  team_id: string;
  team_name: string;
  acronym: string;
  comp_index: number;
  hof_overall: number;
  hof_last_3: number;
  situation: string;
};

const SituationBadge = ({ status }: { status: string }) => {
  const statusStyles: Record<string, string> = {
    "Above average": "bg-green-600 text-white",
    "Inside average": "bg-green-800 text-white",
    "Below average": "bg-yellow-500 text-black",
    Critical: "bg-red-600 text-white",
    "N/A": "bg-neutral-600",
  };
  return (
    <Badge className={statusStyles[status] || "bg-neutral-600"}>
      {status}
    </Badge>
  );
};

export default function CompIndexPage() {
  const { selectedLeagueId } = useLeague();
  const [data, setData] = useState<CompIndexEntry[]>([]);
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
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">CompIndex Rankings</h2>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Select a league and team to continue</p>
            <p className="text-sm">Choose a league from the Saves page to view CompIndex rankings.</p>
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

  if (error) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">CompIndex Rankings</h2>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <h2 className="text-2xl font-bold">CompIndex Rankings</h2>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">No CompIndex data yet</p>
              <p className="text-sm">Complete seasons to build CompIndex and HOF rankings.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>CompIndex</TableHead>
                  <TableHead>HOF Last 3</TableHead>
                  <TableHead>HOF Overall</TableHead>
                  <TableHead>Situation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry, idx) => (
                  <TableRow key={entry.team_id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <span className="font-medium">{entry.team_name}</span>
                      <span className="text-muted-foreground text-sm ml-1">({entry.acronym})</span>
                    </TableCell>
                    <TableCell>{entry.comp_index.toFixed(2)}</TableCell>
                    <TableCell>{entry.hof_last_3}</TableCell>
                    <TableCell>{entry.hof_overall}</TableCell>
                    <TableCell>
                      <SituationBadge status={entry.situation} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
