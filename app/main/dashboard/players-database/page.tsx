"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";
import { PlayerCard } from "@/components/PlayerCard";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Toaster } from "sonner";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";

const POSITIONS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "LWB",
  "RWB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
  "CF",
];

type LeaguePlayer = {
  id: string;
  player_id: string;
  player_name: string;
  full_name: string | null;
  positions: string;
  rating: number;
  team_id: string | null;
  team_name: string | null;
  image: string | null;
  value?: number;
  wage?: number;
  age?: number;
  overall_rating?: number;
  country_name?: string | null;
  country_flag?: string | null;
};

type Team = { id: string; name: string };

const PAGE_SIZE = 24;

function formatValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`;
  return `€${value}`;
}

function formatWage(wage: number): string {
  if (wage >= 1000) return `€${(wage / 1000).toFixed(0)}K/wk`;
  return `€${wage}/wk`;
}

export default function PlayersDatabasePage() {
  const searchParams = useSearchParams();
  const { selectedLeagueId } = useLeague();
  const leagueId = searchParams.get("league") || selectedLeagueId;

  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Basic filters
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [teamId, setTeamId] = useState("");
  const [ratingMin, setRatingMin] = useState("");
  const [ratingMax, setRatingMax] = useState("");

  // Advanced filters
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [positionsMulti, setPositionsMulti] = useState<string[]>([]);
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [wageMin, setWageMin] = useState("");
  const [wageMax, setWageMax] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");

  const isFreeAgentsView = teamId === "free";

  const fetchPlayers = useCallback(async () => {
    if (!leagueId) {
      setError("No league selected");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("leagueId", leagueId);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search) params.set("search", search);
      if (position) params.set("position", position);
      if (teamId) params.set("teamId", teamId);
      if (ratingMin) params.set("ratingMin", ratingMin);
      if (ratingMax) params.set("ratingMax", ratingMax);
      if (positionsMulti.length) params.set("positions", positionsMulti.join(","));
      if (valueMin) params.set("valueMin", valueMin);
      if (valueMax) params.set("valueMax", valueMax);
      if (wageMin) params.set("wageMin", wageMin);
      if (wageMax) params.set("wageMax", wageMax);
      if (ageMin) params.set("ageMin", ageMin);
      if (ageMax) params.set("ageMax", ageMax);

      const res = await fetch(`/api/league/players/database?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setPlayers(data.data || []);
      setTeams(data.teams || []);
      setTotal(data.total ?? (data.data || []).length);
    } catch (err: any) {
      setError(err.message);
      setPlayers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    leagueId,
    page,
    search,
    position,
    teamId,
    ratingMin,
    ratingMax,
    positionsMulti,
    valueMin,
    valueMax,
    wageMin,
    wageMax,
    ageMin,
    ageMax,
  ]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [
    search,
    position,
    teamId,
    ratingMin,
    ratingMax,
    positionsMulti,
    valueMin,
    valueMax,
    wageMin,
    wageMax,
    ageMin,
    ageMax,
  ]);

  const togglePosition = (pos: string) => {
    setPositionsMulti((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setPosition("");
    setTeamId("");
    setRatingMin("");
    setRatingMax("");
    setPositionsMulti([]);
    setValueMin("");
    setValueMax("");
    setWageMin("");
    setWageMax("");
    setAgeMin("");
    setAgeMax("");
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!leagueId) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <p className="text-muted-foreground">Select a league to view the players database.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader
        eyebrow="Transfer Hub"
        title="Players Database"
        stats={[{ label: "Players", value: total.toLocaleString(), emphasis: true }]}
      />

      {/* Filters */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or position..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-[120px]">
              <Label className="text-xs">Position</Label>
              <Select value={position || "__any__"} onValueChange={(v) => setPosition(v === "__any__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs">Team</Label>
              <Select value={teamId || "__all__"} onValueChange={(v) => setTeamId(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All teams</SelectItem>
                  <SelectItem value="free">Free Agents</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[80px]">
              <Label className="text-xs">Rating min</Label>
              <Input
                type="number"
                placeholder="0"
                value={ratingMin}
                onChange={(e) => setRatingMin(e.target.value)}
                min={0}
                max={99}
              />
            </div>
            <div className="w-[80px]">
              <Label className="text-xs">Rating max</Label>
              <Input
                type="number"
                placeholder="99"
                value={ratingMax}
                onChange={(e) => setRatingMax(e.target.value)}
                min={0}
                max={99}
              />
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          </div>

          {/* Advanced filters */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setAdvancedOpen(!advancedOpen)}
            >
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Advanced filters
            </Button>
            {advancedOpen && (
              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-border mt-2">
                <div>
                  <Label className="text-xs">Positions (multi)</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {POSITIONS.map((p) => (
                      <Badge
                        key={p}
                        variant={positionsMulti.includes(p) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => togglePosition(p)}
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Value range (€)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={valueMin}
                      onChange={(e) => setValueMin(e.target.value)}
                      disabled={isFreeAgentsView}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={valueMax}
                      onChange={(e) => setValueMax(e.target.value)}
                      disabled={isFreeAgentsView}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Wage range (€)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={wageMin}
                      onChange={(e) => setWageMin(e.target.value)}
                      disabled={isFreeAgentsView}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={wageMax}
                      onChange={(e) => setWageMax(e.target.value)}
                      disabled={isFreeAgentsView}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Age range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value)}
                      min={16}
                      max={50}
                      disabled
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      min={16}
                      max={50}
                      disabled
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground md:col-span-2 lg:col-span-4">
                  {isFreeAgentsView
                    ? "Value/wage/age filters aren't available for the unrostered Free Agents pool."
                    : "Age filtering isn't available yet."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : players.length === 0 ? (
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            No players match your filters.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {players.map((player) => (
              <Link
                key={player.id}
                href={`/main/dashboard/players/${player.player_id}?league=${leagueId}`}
                className="group flex flex-col gap-2"
              >
                <PlayerCard
                  player={{
                    name: player.player_name,
                    full_name: player.full_name || player.player_name,
                    positions: player.positions,
                    overall_rating: player.overall_rating ?? player.rating,
                    image: player.image || undefined,
                    country_name: player.country_name,
                    country_flag: player.country_flag,
                  }}
                  size="lg"
                  className="w-full transition-transform group-hover:scale-[1.03]"
                />
                <div className="text-center">
                  <p className="font-semibold text-sm truncate">
                    {player.full_name || player.player_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {player.team_name || "Free Agent"}
                  </p>
                  {(player.value != null || player.wage != null) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {player.value != null && formatValue(player.value)}
                      {player.value != null && player.wage != null && " • "}
                      {player.wage != null && formatWage(player.wage)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total.toLocaleString()} players
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
