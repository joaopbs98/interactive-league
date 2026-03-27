"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getRatingColorClasses } from "@/utils/ratingColors";
import { Images } from "@/lib/assets";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { Toaster, toast } from "sonner";

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
};

type Team = { id: string; name: string };

export default function PlayersDatabasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedLeagueId, selectedTeam } = useLeague();
  const leagueId = searchParams.get("league") || selectedLeagueId;

  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
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
    } catch (err: any) {
      setError(err.message);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [
    leagueId,
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

  const handleProposeTrade = (player: LeaguePlayer) => {
    if (!player.team_id || player.team_id === selectedTeam?.id) {
      toast.error(
        player.team_id
          ? "You cannot trade with your own team"
          : "Free agents cannot be traded"
      );
      return;
    }
    router.push(
      `/main/dashboard/trades?league=${leagueId}&proposeTo=${player.team_id}&requestPlayer=${player.player_id}`
    );
  };

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

  if (!leagueId) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Select a league to view the players database.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Toaster position="top-center" richColors />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Players Database</h1>
        <Badge variant="secondary">{players.length} players</Badge>
      </div>

      {/* Filters */}
      <Card>
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
              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t mt-2">
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
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={valueMax}
                      onChange={(e) => setValueMax(e.target.value)}
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
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={wageMax}
                      onChange={(e) => setWageMax(e.target.value)}
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
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      min={16}
                      max={50}
                    />
                  </div>
                </div>
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
        <Card>
          <CardContent className="p-8 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : players.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No players match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {players.map((player) => (
            <Card
              key={player.id}
              className="hover:shadow-lg transition-shadow overflow-hidden"
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="shrink-0">
                    <img
                      src={
                        player.image?.startsWith("http")
                          ? `/api/proxy-image?url=${encodeURIComponent(player.image)}`
                          : player.image || Images.NoImage.src
                      }
                      alt={player.full_name || player.player_name}
                      className="w-14 h-14 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = Images.NoImage.src;
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {player.full_name || player.player_name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {player.positions?.split(",")[0] || "-"}
                      </Badge>
                      <Badge
                        className={`text-xs ${getRatingColorClasses(
                          player.overall_rating ?? player.rating
                        )}`}
                      >
                        {player.overall_rating ?? player.rating}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {player.team_name || "Free Agent"}
                    </p>
                    {(player.value != null || player.wage != null) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {player.value != null &&
                          `€${(player.value / 1_000_000).toFixed(1)}M`}
                        {player.value != null && player.wage != null && " • "}
                        {player.wage != null &&
                          `€${(player.wage / 1000).toFixed(0)}K/wk`}
                      </p>
                    )}
                    {player.team_id &&
                      player.team_id !== selectedTeam?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full gap-1"
                          onClick={() => handleProposeTrade(player)}
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          Propose Trade
                        </Button>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
