"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeague } from "@/contexts/LeagueContext";
import { getStatColor } from "@/hooks/getStatColor";
import { Images } from "@/lib/assets";
import { ArrowLeft, MessageSquare, Pencil } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";

const statCategories: Record<string, string[]> = {
  Attacking: ["crossing", "finishing", "heading_accuracy", "short_passing", "volleys"],
  Skill: ["dribbling", "curve", "fk_accuracy", "long_passing", "ball_control"],
  Movement: ["acceleration", "sprint_speed", "agility", "reactions", "balance"],
  Power: ["shot_power", "jumping", "stamina", "strength", "long_shots"],
  Mentality: ["aggression", "interceptions", "positioning", "vision", "penalties", "composure"],
  Defending: ["defensive_awareness", "standing_tackle", "sliding_tackle"],
  Goalkeeping: ["gk_diving", "gk_handling", "gk_kicking", "gk_positioning", "gk_reflexes"],
};

export default function TeamPlayerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const teamId = params.teamId as string;
  const playerId = params.playerId as string;
  const { selectedTeam, selectedLeagueId } = useLeague();
  const leagueId = searchParams.get("league") || selectedLeagueId;

  const [data, setData] = useState<{ player: any; context: { isOwnTeam: boolean; isHost: boolean } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !playerId || !leagueId) {
      setError("Missing team, player, or league");
      setLoading(false);
      return;
    }
    fetchPlayer();
  }, [teamId, playerId, leagueId]);

  const fetchPlayer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/league/team/${teamId}/player/${playerId}?leagueId=${leagueId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      const { player, context } = json;
      if (context?.isOwnTeam) {
        router.replace(`/main/dashboard/squad/player/${playerId}?teamId=${teamId}&league=${leagueId}`);
        return;
      }
      setData({ player, context });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <PageSkeleton variant="page" rows={12} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="mt-4 text-destructive">{error || "Player not found"}</p>
      </div>
    );
  }

  const { player, context } = data;
  const { isHost } = context;

  const imageSrc = player.image?.startsWith("http")
    ? `/api/proxy-image?url=${encodeURIComponent(player.image)}`
    : player.image || Images.NoImage.src;

  const formatStatName = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const displayValue =
    typeof player.value === "number" && !isNaN(player.value)
      ? player.value >= 1_000_000
        ? `€${(player.value / 1_000_000).toFixed(1)}M`
        : player.value >= 1000
          ? `€${(player.value / 1000).toFixed(0)}K`
          : `€${player.value}`
      : null;

  const lp = player.leaguePlayer as Record<string, unknown> | undefined;
  const overall = lp?.rating ?? player.overall_rating ?? player.rating ?? 0;
  const getStatValue = (stat: string) => {
    const v = lp?.[stat] ?? player[stat];
    return typeof v === "number" && !isNaN(v) ? v : 0;
  };

  const editPlayerUrl =
    teamId && leagueId && player.leaguePlayerId
      ? `/main/dashboard/add-player?edit=${player.leaguePlayerId}&teamId=${teamId}&league=${leagueId}`
      : null;

  const proposeTradeUrl = `/main/dashboard/trades${leagueId ? `?league=${leagueId}` : ""}`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="shrink-0">
                <img
                  src={imageSrc}
                  alt={player.full_name || player.name}
                  width={160}
                  height={160}
                  className="rounded-lg object-cover w-40 h-40"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = Images.NoImage.src;
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {player.full_name || player.name}
                </h1>
                <div className="flex flex-wrap gap-2 items-center mt-1">
                  <Badge variant="secondary" className="font-medium">
                    {player.positions}
                  </Badge>
                  {player.age != null && (
                    <span className="text-sm text-muted-foreground">{player.age} y.o.</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Overall rating</div>
                    <div
                      className={`inline-flex items-center justify-center w-14 h-14 rounded-lg text-xl font-bold ${getStatColor(
                        Number(overall)
                      )}`}
                    >
                      {overall}
                    </div>
                  </div>
                  {displayValue && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">Value</div>
                      <div className="text-xl font-semibold">{displayValue}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full lg:w-72 shrink-0">
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isHost && editPlayerUrl && (
              <Link href={editPlayerUrl}>
                <Button variant="outline" className="w-full">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Player
                </Button>
              </Link>
            )}
            <Link href={proposeTradeUrl}>
              <Button variant="outline" className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Propose Trade
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {player.preferred_foot && (
              <p>
                <span className="text-muted-foreground">Preferred foot </span>
                {player.preferred_foot}
              </p>
            )}
            {player.skill_moves != null && (
              <p>
                <span className="text-muted-foreground">Skill moves </span>
                {player.skill_moves} ★
              </p>
            )}
            {player.weak_foot != null && (
              <p>
                <span className="text-muted-foreground">Weak foot </span>
                {player.weak_foot} ★
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Club (IL)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {player.ilTeam?.name && <p className="font-medium">{player.ilTeam.name}</p>}
            {player.ilLeague?.name && (
              <p>
                <span className="text-muted-foreground">League </span>
                {player.ilLeague.name}
              </p>
            )}
            {player.positions && (
              <p>
                <span className="text-muted-foreground">Position </span>
                {player.positions.split(",")[0]?.trim() || player.positions}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="Attacking" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {Object.keys(statCategories).map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(statCategories).map(([cat, keys]) => (
          <TabsContent key={cat} value={cat} className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {keys.map((stat) => {
                    const val = getStatValue(stat);
                    const safeVal = isNaN(Number(val)) ? 0 : Math.min(99, Math.max(1, Number(val)));
                    return (
                      <div
                        key={stat}
                        className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30"
                      >
                        <span className="text-sm text-muted-foreground">{formatStatName(stat)}</span>
                        <Badge className={`min-w-[2.5rem] justify-center ${getStatColor(safeVal)}`}>
                          {safeVal}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
