"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, ArrowUpRight, ArrowDownRight, Search } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";

type TransferItem = {
  id: string;
  date: string;
  type: string;
  reason: string;
  amount: number;
  direction: "in" | "out";
  playerName: string | null;
  description: string | null;
  season: number;
};

function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toLocaleString()}`;
}

export default function TransferHistoryPage() {
  const { selectedTeam } = useLeague();
  const [items, setItems] = useState<TransferItem[]>([]);
  const [summary, setSummary] = useState({
    totalReceived: 0,
    totalSpent: 0,
    net: 0,
  });
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchHistory = useCallback(() => {
    if (!selectedTeam?.id) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (season !== "all") params.set("season", season);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/team/${selectedTeam.id}/transfer-history?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setItems(json.data.items ?? []);
          setSummary(json.data.summary ?? { totalReceived: 0, totalSpent: 0, net: 0 });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedTeam?.id, season, typeFilter, search]);

  useEffect(() => {
    if (!selectedTeam?.id) return;
    const t = setTimeout(() => fetchHistory(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [selectedTeam?.id, fetchHistory, search]);

  if (!selectedTeam) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Select a league to view transfer history.</p>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Transfer History</h2>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={season} onValueChange={setSeason}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All seasons</SelectItem>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
              <SelectItem key={s} value={String(s)}>
                Season {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in">Incoming</SelectItem>
            <SelectItem value="out">Outgoing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Received</p>
            <p className="text-lg font-bold text-green-400">
              {formatMoney(summary.totalReceived)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-lg font-bold text-red-400">
              {formatMoney(summary.totalSpent)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={`text-lg font-bold ${
                summary.net >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {summary.net >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(summary.net))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-6">
              <PageSkeleton variant="table" rows={8} />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No transfer activity yet.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800"
                >
                  <div className="flex items-center gap-3">
                    {item.direction === "in" ? (
                      <ArrowUpRight className="h-4 w-4 text-green-400" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {item.playerName || item.description || item.reason}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.type} · Season {item.season}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        item.direction === "in"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {item.direction === "in" ? "+" : "-"}
                      {formatMoney(Math.abs(item.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
