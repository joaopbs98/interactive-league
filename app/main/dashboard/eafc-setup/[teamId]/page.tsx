"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/contexts/LeagueContext";
import TeamFormationDisplay from "@/components/TeamFormationDisplay";
import { formationPositions } from "@/lib/formationPositions";
import {
  Shield,
  ArrowLeft,
  Copy,
  Check,
  Gamepad2,
} from "lucide-react";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { PageSkeleton } from "@/components/PageSkeleton";

type SquadPlayer = {
  id: string;
  player_id: string;
  player_name: string;
  full_name?: string | null;
  positions: string;
  rating: number;
  image?: string | null;
  role?: string;
  potential?: number | null;
  is_youngster?: boolean;
  is_veteran?: boolean;
};

type TeamData = {
  id: string;
  name: string;
  acronym: string;
  formation: string | null;
  eafc_tactic_code: string | null;
  eafc_comment?: string | null;
  squad: SquadPlayer[];
};

export default function EafcSetupTeamPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.teamId as string;
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  const leagueId = selectedLeagueId;
  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

  useEffect(() => {
    if (leagueId && teamId && isHost) {
      fetchTeam();
    } else {
      setLoading(false);
    }
  }, [leagueId, teamId, isHost]);

  const fetchTeam = async () => {
    if (!leagueId || !teamId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/league/host/squads?leagueId=${leagueId}&teamId=${teamId}`);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setTeam(data.data[0]);
      } else {
        setTeam(null);
      }
    } catch (err) {
      console.error(err);
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (team?.eafc_tactic_code) {
      navigator.clipboard.writeText(team.eafc_tactic_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="p-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Host Only</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center">
            <p className="text-lg">Team not found</p>
            <Link href="/main/dashboard/eafc-setup">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to EAFC Setup
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formation = team.formation || "3-1-4-2";
  const positions = formationPositions[formation] || formationPositions["3-1-4-2"];
  const rawLineup = (team as { starting_lineup?: unknown[] }).starting_lineup || [];
  let startingIds = rawLineup.map((item) =>
    typeof item === "string" ? item : (item as { player_id?: string })?.player_id
  ).filter(Boolean) as string[];

  // Fallback: when starting_lineup is empty or incomplete, fill with top squad players by rating
  const squadMap = new Map(team.squad.map((p) => [p.player_id, p]));
  const usedIds = new Set(startingIds);
  const topSquadByRating = [...team.squad].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const fillIds = topSquadByRating
    .filter((p) => !usedIds.has(p.player_id))
    .map((p) => p.player_id)
    .slice(0, Math.max(0, 11 - startingIds.length));
  startingIds = [...startingIds, ...fillIds].slice(0, 11);

  const formationPlayers = positions.slice(0, 11).map((_, idx) => {
    const pid = startingIds[idx];
    const p = pid ? squadMap.get(pid) : null;
    if (!p) return { player_id: `empty-${idx}`, name: "No Player", positions: positions[idx]?.label || "", overall_rating: 50 };
    return {
      player_id: p.player_id,
      name: p.player_name,
      full_name: p.full_name ?? undefined,
      positions: p.positions,
      overall_rating: p.rating,
      image: p.image ?? undefined,
    };
  });

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gamepad2 className="h-7 w-7" /> {team.name}
        </h1>
        <div className="flex gap-2">
          <Link href={`/main/dashboard/add-player?league=${leagueId}&teamId=${teamId}`}>
            <Button variant="outline" size="sm">
              Add Player to Team
            </Button>
          </Link>
          <Link href="/main/dashboard/eafc-setup">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to EAFC Setup
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual Formation */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base">Formation</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamFormationDisplay
              formation={formation}
              positions={positions}
              players={formationPlayers}
            />
          </CardContent>
        </Card>

        {/* Tactic Code & Comments */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base">EAFC Tactic Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {team.eafc_tactic_code ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-neutral-800 rounded font-mono text-sm">
                  {team.eafc_tactic_code}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyCode}>
                  {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  Copy
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not set</p>
            )}
            {team.eafc_comment && (
              <div>
                <p className="text-sm font-medium mb-1">Manager Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-neutral-800/50 p-3 rounded">
                  {team.eafc_comment}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Squad List */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base">Squad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {team.squad.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2 rounded bg-neutral-800/50 hover:bg-neutral-800"
              >
                <Badge className={getRatingColorClasses(p.rating)}>{p.rating}</Badge>
                <span className="flex-1">{p.player_name || p.full_name || "—"}</span>
                <span className="text-muted-foreground w-16">{p.positions}</span>
                <Badge variant="outline" className="text-xs">
                  {p.role || "squad"}
                </Badge>
                {p.is_youngster && (
                  <Badge variant="secondary" className="text-xs">Wonderkid</Badge>
                )}
                {p.potential != null && (
                  <span className="text-xs text-muted-foreground">Pot: {p.potential}</span>
                )}
                <Link href={`/main/dashboard/add-player?league=${leagueId}&teamId=${teamId}&edit=${p.id}`}>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
