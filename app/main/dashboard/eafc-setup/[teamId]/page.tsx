"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLeague } from "@/contexts/LeagueContext";
import TeamFormationDisplay from "@/components/TeamFormationDisplay";
import { formationPositions } from "@/lib/formationPositions";
import {
  Shield,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
  Gamepad2,
} from "lucide-react";
import { getRatingColorClasses } from "@/utils/ratingColors";

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
  const [editingPlayer, setEditingPlayer] = useState<SquadPlayer | null>(null);
  const [editRating, setEditRating] = useState("");
  const [editPositions, setEditPositions] = useState("");
  const [editPotential, setEditPotential] = useState("");
  const [editIsYoungster, setEditIsYoungster] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleSaveEdit = async () => {
    if (!editingPlayer || !leagueId) return;
    const ratingNum = parseInt(editRating, 10);
    if (isNaN(ratingNum) || ratingNum < 40 || ratingNum > 99) {
      alert("Rating must be 40-99");
      return;
    }
    const potentialNum = editPotential.trim() ? parseInt(editPotential, 10) : null;
    if (editPotential.trim() && (isNaN(potentialNum!) || potentialNum! < 40 || potentialNum! > 99)) {
      alert("Potential must be 40-99 or empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/league/host/edit-player", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          leaguePlayerId: editingPlayer.id,
          rating: ratingNum,
          positions: editPositions.trim() || undefined,
          potential: potentialNum,
          is_youngster: editIsYoungster,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingPlayer(null);
        await fetchTeam();
      } else {
        alert(data.error || "Failed to save");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
  const startingIds = ((team as { starting_lineup?: string[] }).starting_lineup || []).filter(Boolean);
  const squadMap = new Map(team.squad.map((p) => [p.player_id, p]));

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
          <Link href={`/main/dashboard/host-controls?addPlayer=${teamId}`}>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingPlayer(p);
                    setEditRating(String(p.rating));
                    setEditPositions(p.positions || "");
                    setEditPotential(p.potential != null ? String(p.potential) : "");
                    setEditIsYoungster(p.is_youngster ?? false);
                  }}
                >
                  Edit
                </Button>
                {editingPlayer?.id === p.id && (
                  <div className="flex flex-wrap items-center gap-2 ml-2">
                    <Input
                      type="number"
                      min={40}
                      max={99}
                      value={editRating}
                      onChange={(e) => setEditRating(e.target.value)}
                      placeholder="Rating"
                      className="w-16 h-8"
                    />
                    <Input
                      value={editPositions}
                      onChange={(e) => setEditPositions(e.target.value)}
                      placeholder="Positions"
                      className="w-24 h-8"
                    />
                    <Input
                      type="number"
                      min={40}
                      max={99}
                      value={editPotential}
                      onChange={(e) => setEditPotential(e.target.value)}
                      placeholder="Potential"
                      className="w-20 h-8"
                    />
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsYoungster}
                        onChange={(e) => setEditIsYoungster(e.target.checked)}
                        className="rounded"
                      />
                      Wonderkid
                    </label>
                    <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingPlayer(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
