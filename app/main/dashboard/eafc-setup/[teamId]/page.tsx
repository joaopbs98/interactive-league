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
  Plus,
  Pencil,
  Gamepad2,
  Users,
  Sparkles,
} from "lucide-react";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { getPositionFit } from "@/lib/positionFit";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
        <Card className="bg-surface border-border">
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
        <Card className="bg-surface border-border">
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

  // Fill an incomplete XI by positional fit first, then rating.
  const squadMap = new Map(team.squad.map((p) => [p.player_id, p]));
  const usedIds = new Set(startingIds.filter((id) => squadMap.has(id)));
  startingIds = startingIds.filter((id) => squadMap.has(id)).slice(0, 11);
  while (startingIds.length < Math.min(11, positions.length)) {
    const slot = positions[startingIds.length]?.label || "";
    const weight = { natural: 3, familiar: 2, unknown: 1, unfamiliar: 0 } as const;
    const next = team.squad.filter((p) => !usedIds.has(p.player_id)).sort((a, b) =>
      weight[getPositionFit(b.positions, slot)] - weight[getPositionFit(a.positions, slot)] ||
      (b.rating ?? 0) - (a.rating ?? 0)
    )[0];
    if (!next) break;
    startingIds.push(next.player_id);
    usedIds.add(next.player_id);
  }

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

  const cleanName = (player: SquadPlayer) =>
    (player.full_name || player.player_name || "Unknown player").replace(/\s+-\s*$/, "").trim();
  const averageRating = team.squad.length
    ? Math.round(team.squad.reduce((sum, player) => sum + (player.rating || 0), 0) / team.squad.length)
    : 0;
  const xiAverage = formationPlayers.length
    ? Math.round(formationPlayers.reduce((sum, player) => sum + player.overall_rating, 0) / formationPlayers.length)
    : 0;
  const roleLabel = (role?: string) => {
    const value = role?.toLowerCase();
    if (["starting", "starting_xi", "starter"].includes(value || "")) return "Starting XI";
    if (["bench", "substitute"].includes(value || "")) return "Bench";
    if (["reserves", "reserve"].includes(value || "")) return "Reserve";
    return "Squad";
  };
  const sortedSquad = [...team.squad].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto">
      <Breadcrumbs lastLabel={team.name} />
      <PageHeader
        eyebrow="EAFC Setup"
        title={`${team.name} setup`}
        subtitle="Review the match-ready XI, tactic code, and squad data before loading EAFC."
        stats={[
          { label: "Formation", value: formation, emphasis: true },
          { label: "Squad", value: team.squad.length },
          { label: "Avg OVR", value: averageRating },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/main/dashboard/add-player?league=${leagueId}&teamId=${teamId}`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add player
              </Button>
            </Link>
            <Link href="/main/dashboard/eafc-setup">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" /> All teams
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visual Formation */}
        <Card className="bg-surface border-border lg:col-span-7 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border bg-surface-2/40">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Match sheet</p>
              <CardTitle className="text-lg">Starting XI</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-sm px-3 py-1">{formation}</Badge>
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            <TeamFormationDisplay
              formation={formation}
              positions={positions}
              players={formationPlayers}
            />
          </CardContent>
        </Card>

        {/* Tactic Code & Comments */}
        <div className="lg:col-span-5 space-y-4">
        <Card className="bg-surface border-border overflow-hidden">
          <CardHeader className="border-b border-border bg-surface-2/40">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-border bg-surface-3 p-2.5"><Gamepad2 className="h-5 w-5 text-accent" /></div>
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">In-game setup</p><CardTitle className="text-lg">Tactic code</CardTitle></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {team.eafc_tactic_code ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-3 p-2">
                <code className="flex-1 px-2 font-mono text-base font-semibold tracking-wider">
                  {team.eafc_tactic_code}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyCode} aria-label="Copy tactic code">
                  {copiedCode ? <Check className="h-4 w-4 text-status-positive" /> : <Copy className="h-4 w-4" />}
                  Copy
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border-strong bg-surface-2/50 px-5 py-7 text-center">
                <Gamepad2 className="h-7 w-7 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">No tactic code yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Add one from Tactics &amp; Formation so this team is ready to load in-game.</p>
                <Link href="/main/dashboard/tactics"><Button variant="outline" size="sm" className="mt-4">Open tactics</Button></Link>
              </div>
            )}
            {team.eafc_comment && (
              <div>
                <p className="text-sm font-medium mb-1">Manager Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-surface-3 p-3 rounded">
                  {team.eafc_comment}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-surface border-border">
          <CardContent className="p-5 grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">Starting XI OVR</p><p className="font-mono text-2xl font-semibold mt-1">{xiAverage}</p></div>
            <div className="border-l border-border pl-4"><p className="text-xs text-muted-foreground">Players available</p><p className="font-mono text-2xl font-semibold mt-1">{team.squad.length}</p></div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Squad List */}
      <Card className="bg-surface border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Player data</p>
            <CardTitle className="text-lg">Full squad</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Ratings, roles, and development status for {team.name}.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> {team.squad.length} players</div>
        </CardHeader>
        <CardContent>
          <div className="hidden md:grid grid-cols-[56px_minmax(180px,1fr)_110px_120px_150px_44px] gap-3 px-3 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>OVR</span><span>Player</span><span>Positions</span><span>Role</span><span>Development</span><span></span>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {sortedSquad.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[48px_minmax(0,1fr)_auto] md:grid-cols-[56px_minmax(180px,1fr)_110px_120px_150px_44px] items-center gap-3 px-3 py-3 hover:bg-surface-2/70 transition-colors"
              >
                <Badge className={`justify-center w-10 font-mono ${getRatingColorClasses(p.rating)}`}>{p.rating}</Badge>
                <div className="min-w-0">
                  <p className="font-medium truncate">{cleanName(p)}</p>
                  <p className="md:hidden text-xs text-muted-foreground mt-0.5">{p.positions || "—"} · {roleLabel(p.role)}</p>
                </div>
                <span className="hidden md:block text-sm text-muted-foreground">{p.positions || "—"}</span>
                <Badge variant="outline" className="hidden md:inline-flex text-xs w-fit">{roleLabel(p.role)}</Badge>
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                  {p.is_youngster && <Sparkles className="h-3.5 w-3.5 text-status-warning" />}
                  <span>{p.potential != null ? `Potential ${p.potential}` : p.is_youngster ? "Wonderkid" : "—"}</span>
                </div>
                <Link href={`/main/dashboard/add-player?league=${leagueId}&teamId=${teamId}&edit=${p.id}`}>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${cleanName(p)}`}><Pencil className="h-4 w-4" /></Button>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
