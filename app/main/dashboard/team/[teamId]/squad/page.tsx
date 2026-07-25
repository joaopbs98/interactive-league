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
import { PageHeader } from "@/components/PageHeader";
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

const ROLE_LABELS: Record<string, string> = {
  starting: "Starting",
  bench: "Bench",
  reserves: "Reserve",
};
const ROLE_STYLES: Record<string, string> = {
  Starting: "bg-accent-muted text-accent",
  Bench: "bg-surface-3 text-foreground",
  Reserve: "bg-surface-3 text-muted-foreground",
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
      className="rounded-lg object-cover ring-1 ring-border"
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
      <div className="p-6">
        <PageSkeleton variant="page" rows={12} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="bg-surface border-border">
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
    <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="self-start -mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <PageHeader
        eyebrow="League"
        title={`${team.name} Squad`}
        stats={[
          { label: "Players", value: squad.length, emphasis: true },
          { label: "Avg", value: avgRating },
          { label: "Formation", value: team.formation || "—" },
        ]}
        actions={
          <Link href={`/main/dashboard/trades${leagueId ? `?league=${leagueId}&proposeTo=${teamId}` : ""}`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Propose Trade
            </Button>
          </Link>
        }
      />

      <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Player</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Pos</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">OVR</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Role</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Potential</th>
              </tr>
            </thead>
            <tbody>
              {squad
                .slice()
                .sort((a, b) => b.overall_rating - a.overall_rating)
                .map((p) => {
                  const playerProfileUrl = `/main/dashboard/players/${p.player_id}?league=${leagueId}`;
                  const roleLabel = ROLE_LABELS[p.role || ""] || "Reserve";
                  return (
                    <tr
                      key={p.player_id}
                      className="border-b border-border/50 hover:bg-surface-3/60 cursor-pointer transition-colors duration-150"
                      onClick={() => router.push(playerProfileUrl)}
                    >
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
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_STYLES[roleLabel]}`}>
                          {roleLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {p.is_youngster && p.potential != null ? (
                          <span className="text-status-warning">{p.potential}</span>
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
      </div>
    </div>
  );
}

export default function OpponentSquadPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <PageSkeleton variant="page" rows={12} />
      </div>
    }>
      <OpponentSquadContent />
    </Suspense>
  );
}
