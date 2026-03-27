"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { formatPlayerName } from "@/utils/playerUtils";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { Images } from "@/lib/assets";

type SquadPlayer = {
  player_id: string;
  name: string;
  full_name?: string;
  positions: string;
  overall_rating: number;
  image?: string;
  potential?: number | null;
  is_youngster?: boolean;
  role?: string;
};

type TeamSquadData = {
  team: { id: string; name: string; acronym: string; formation: string };
  squad: SquadPlayer[];
};

const PlayerImage = ({ src, alt }: { src?: string; alt: string }) => {
  const [imgSrc, setImgSrc] = useState(src || Images.NoImage.src);
  useEffect(() => {
    if (src?.startsWith("http")) {
      setImgSrc(`/api/proxy-image?url=${encodeURIComponent(src)}`);
    } else {
      setImgSrc(src || Images.NoImage.src);
    }
  }, [src]);
  return (
    <img
      src={imgSrc}
      alt={alt}
      width={40}
      height={40}
      className="rounded object-cover"
      onError={() => setImgSrc(Images.NoImage.src)}
    />
  );
};

function OpponentSquadContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const teamId = params.teamId as string;
  const { selectedLeagueId, selectedTeam } = useLeague();
  const leagueId = searchParams.get("league") || selectedLeagueId;

  const [data, setData] = useState<TeamSquadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnTeam = selectedTeam?.id === teamId;

  useEffect(() => {
    if (!leagueId || !teamId) {
      setLoading(false);
      setError("League and team required");
      return;
    }
    if (isOwnTeam) {
      router.replace(`/main/dashboard/squad?league=${leagueId}&teamId=${teamId}`);
      return;
    }
    fetch(`/api/league/team-squad?leagueId=${leagueId}&teamId=${teamId}&view=full`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.team) {
          setData({ team: json.team, squad: json.squad || [] });
        } else {
          setError(json.error || "Failed to load squad");
        }
      })
      .catch(() => setError("Failed to load squad"))
      .finally(() => setLoading(false));
  }, [leagueId, teamId, isOwnTeam, router]);

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
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">{error || "Squad not found"}</p>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { team, squad } = data;
  const avgRating = squad.length > 0
    ? Math.round(squad.reduce((s, p) => s + p.overall_rating, 0) / squad.length)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-2xl font-bold">{team.name} Squad</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {squad.length} players • Avg: {avgRating} • {team.formation}
          </p>
        </div>
        <Link href={`/main/dashboard/trades${leagueId ? `?league=${leagueId}` : ""}`}>
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Propose Trade
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Players</p>
            <p className="text-2xl font-bold">{squad.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Avg Rating</p>
            <p className="text-2xl font-bold">{avgRating}</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Formation</p>
            <p className="text-2xl font-bold">{team.formation || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Squad</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Player</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pos</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">OVR</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Potential</th>
                </tr>
              </thead>
              <tbody>
                {squad
                  .sort((a, b) => b.overall_rating - a.overall_rating)
                  .map((p) => {
                    const playerProfileUrl = `/main/dashboard/team/${teamId}/player/${p.player_id}?league=${leagueId}`;
                    return (
                    <tr
                      key={p.player_id}
                      className="border-b border-neutral-800/50 hover:bg-neutral-800/30 cursor-pointer transition-colors"
                      onClick={() => router.push(playerProfileUrl)}
                    >
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {p.role === "starting" ? "S1" : p.role === "bench" ? "S2" : p.role === "reserves" ? "S3" : "S4"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <PlayerImage src={p.image} alt={p.name} />
                          <span className="font-medium">{formatPlayerName(p.full_name || p.name)}</span>
                          {p.is_youngster && (
                            <Badge variant="secondary" className="text-xs">Wonderkid</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {(p.positions || "").split(",")[0]?.trim() || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getRatingColorClasses(p.overall_rating)}>{p.overall_rating}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {p.is_youngster && p.potential != null ? (
                          <span className="text-amber-500">{p.potential}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OpponentSquadPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-6">
        <PageSkeleton variant="page" rows={12} />
      </div>
    }>
      <OpponentSquadContent />
    </Suspense>
  );
}
