"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "sonner";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";

import { formationPositions, Position } from "@/lib/formationPositions";
import { useLeague } from "@/contexts/LeagueContext";
import { formatPlayerName } from "@/utils/playerUtils";
import { getRatingColorClasses } from "@/utils/ratingColors";

import { PageHeader } from "@/components/PageHeader";
import { Pitch } from "@/components/tactics/Pitch";
import { SquadCard } from "@/components/tactics/SquadCard";
import { PlayerAvatar } from "@/components/tactics/PlayerAvatar";
import { PlayerDetailSheet } from "@/components/tactics/PlayerDetailSheet";
import { TacticsPlayer as Player } from "@/components/tactics/types";
import { allowedRolesForPosition, defaultAssignmentForPosition, DEFENSIVE_APPROACHES } from "@/lib/tactics/catalogue.mjs";
import { deriveTacticDiagnostics, deriveWithBallPositions, roleFamiliarity } from "@/lib/tactics/diagnostics.mjs";
import { deriveSquadDiagnostics } from "@/lib/tactics/squadDiagnostics.mjs";
import type { BuildUpStyle, DefensiveApproach, TacticAssignment } from "@/lib/tactics/types";

// Team data interface
interface TeamData {
  id: string;
  name: string;
  squad: Player[];
  allPlayers?: Player[];
  formation: string;
  averageRating: number;
  eafc_tactic_code?: string | null;
  eafc_comment?: string | null;
}

type Location = { area: "starting" | "bench" | "reserves"; index: number };

function emptyPlayer(index: number, label?: string): Player {
  return {
    player_id: `empty-${index}`,
    name: "Empty Position",
    full_name: "Empty Position",
    positions: label || "ST",
    overall_rating: 0,
  };
}

function alignAssignments(players: Player[], slots: Position[], existing: TacticAssignment[] = []): TacticAssignment[] {
  return slots.slice(0, 11).map((slot, slotIndex) => {
    const current = existing.find((assignment) => assignment.slotIndex === slotIndex);
    const allowed = allowedRolesForPosition(slot.label);
    const compatible = current && allowed.find((definition) => definition.role === current.role && definition.focuses.includes(current.focus));
    const fallback = defaultAssignmentForPosition(slot.label);
    return {
      slotIndex,
      slotPosition: slot.label,
      playerId: players[slotIndex]?.player_id || `empty-${slotIndex}`,
      role: compatible ? current.role : fallback.role,
      focus: compatible ? current.focus : fallback.focus,
    };
  });
}

// Main component
export default function TacticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedLeagueId, setSelectedLeague } = useLeague();

  const leagueId = searchParams.get('league') || searchParams.get('leagueId') || selectedLeagueId;

  useEffect(() => {
    if (selectedLeagueId && !searchParams.get('league')) {
      router.replace(`/main/dashboard/tactics?league=${selectedLeagueId}`);
    }
  }, [selectedLeagueId, searchParams, router]);

  // State
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Formation & positions
  const formations = Object.keys(formationPositions);
  const [formation, setFormation] = useState("3-1-4-2");
  const positions: Position[] = formationPositions[formation] || [];

  // Squad state
  const [starting, setStarting] = useState<Player[]>([]);
  const [bench, setBench] = useState<Player[]>([]);
  const [reserves, setReserves] = useState<Player[]>([]);
  const [eafcTacticCode, setEafcTacticCode] = useState<string>("");
  const [eafcComment, setEafcComment] = useState<string>("");
  const [buildUpStyle, setBuildUpStyle] = useState<BuildUpStyle>("balanced");
  const [defensiveApproach, setDefensiveApproach] = useState<DefensiveApproach>("balanced");
  const [lineHeight, setLineHeight] = useState(50);
  const [tacticAssignments, setTacticAssignments] = useState<TacticAssignment[]>([]);
  const [shapeMode, setShapeMode] = useState<"without" | "with">("without");
  const [tacticSection, setTacticSection] = useState<"overview" | "roles">("overview");

  // Tap-to-select / swap
  const [selected, setSelected] = useState<Location | null>(null);

  // Player detail sheet
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (player: Player) => {
    setDetailPlayer(player);
    setDetailOpen(true);
  };

  // Fetch team data
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!leagueId) {
        setError("No league selected");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/user/team/${leagueId}`);
        if (response.ok) {
          const data = await response.json();
          const squad = data.team?.squad || [];
          const allPlayers = data.team?.allPlayers || [];

          const processedSquad: Player[] = squad.map((player: any) => ({
            ...player,
            positions: player.positions || "ST",
            overall_rating: typeof player.overall_rating === 'number' ? player.overall_rating : 70
          }));
          const processedAllPlayers: Player[] = allPlayers.length > 0 ? allPlayers.map((player: any) => ({
            ...player,
            positions: player.positions || "ST",
            overall_rating: typeof player.overall_rating === 'number' ? player.overall_rating : 70
          })) : processedSquad;

          const savedFormation = data.team?.formation || "3-1-4-2";
          setEafcTacticCode(data.team?.eafc_tactic_code || "");
          setEafcComment(data.team?.eafc_comment || "");

          const teamInfo: TeamData = {
            id: data.team?.id || "mock-team",
            name: data.team?.name || "Mock Team",
            squad: processedSquad,
            allPlayers: processedAllPlayers,
            formation: savedFormation,
            eafc_tactic_code: data.team?.eafc_tactic_code ?? null,
            eafc_comment: data.team?.eafc_comment ?? null,
            averageRating: processedSquad.length ?
              Math.round(processedSquad.reduce((sum, player) => sum + player.overall_rating, 0) / processedSquad.length) :
              0
          };

          setTeamData(teamInfo);
          setFormation(savedFormation);

          if (data.team?.starting_lineup && data.team?.starting_lineup.length > 0) {
            const squadPlayerMap = new Map();
            squad.forEach((player: any) => {
              squadPlayerMap.set(player.player_id, player);
            });

            const validStarting = data.team.starting_lineup.filter((p: any) => p && p.player_id).map((p: any) => {
              const fullPlayer = squadPlayerMap.get(p.player_id);
              return {
                ...fullPlayer,
                ...p,
                positions: fullPlayer?.positions || p.positions || "ST",
                overall_rating: typeof fullPlayer?.overall_rating === 'number' ? fullPlayer.overall_rating :
                               typeof p.overall_rating === 'number' ? p.overall_rating : 70
              };
            });
            const validBench = (data.team?.bench || []).filter((p: any) => p && p.player_id).map((p: any) => {
              const fullPlayer = squadPlayerMap.get(p.player_id);
              return {
                ...fullPlayer,
                ...p,
                positions: fullPlayer?.positions || p.positions || "ST",
                overall_rating: typeof fullPlayer?.overall_rating === 'number' ? fullPlayer.overall_rating :
                               typeof p.overall_rating === 'number' ? p.overall_rating : 70
              };
            });
            const validReserves = (data.team?.reserves || []).filter((p: any) => p && p.player_id).map((p: any) => {
              const fullPlayer = squadPlayerMap.get(p.player_id);
              return {
                ...fullPlayer,
                ...p,
                positions: fullPlayer?.positions || p.positions || "ST",
                overall_rating: typeof fullPlayer?.overall_rating === 'number' ? fullPlayer.overall_rating :
                               typeof p.overall_rating === 'number' ? p.overall_rating : 70
              };
            });

            const paddedStarting = [...validStarting];
            const availablePlayers = [...validBench, ...validReserves].map((p: any) => ({
              ...p,
              positions: p.positions || "ST",
              overall_rating: typeof p.overall_rating === 'number' ? p.overall_rating : 70
            }));

            while (paddedStarting.length < 11 && availablePlayers.length > 0) {
              const nextPlayer = availablePlayers.shift()!;
              paddedStarting.push(nextPlayer);
            }

            const remainingPlayers = [...validBench, ...validReserves].map((p: any) => ({
              ...p,
              positions: p.positions || "ST",
              overall_rating: typeof p.overall_rating === 'number' ? p.overall_rating : 70
            }));
            const newBench = remainingPlayers.slice(0, 7);
            const newReserves = remainingPlayers.slice(7);

            setStarting(paddedStarting);
            setBench(newBench);
            setReserves(newReserves);
            const tacticResponse = await fetch(`/api/team/formation?teamId=${teamInfo.id}`);
            const tacticJson = tacticResponse.ok ? await tacticResponse.json() : null;
            const savedTactic = tacticJson?.tactic;
            if (savedTactic) {
              setBuildUpStyle(savedTactic.build_up_style);
              setDefensiveApproach(savedTactic.defensive_approach);
              setLineHeight(savedTactic.line_height);
              const savedAssignments = (savedTactic.assignments || []).map((assignment: any) => ({
                slotIndex: assignment.slot_index, slotPosition: assignment.slot_position,
                playerId: assignment.player_id, role: assignment.role, focus: assignment.focus,
              }));
              setTacticAssignments(alignAssignments(paddedStarting, formationPositions[savedFormation], savedAssignments));
            } else {
              setTacticAssignments(alignAssignments(paddedStarting, formationPositions[savedFormation]));
            }
          } else if (squad.length > 0) {
            const fallbackSquad = squad.map((player: any) => ({
              ...player,
              positions: player.positions || "ST",
              overall_rating: typeof player.overall_rating === 'number' ? player.overall_rating : 70
            }));
            setStarting(fallbackSquad.slice(0, 11));
            setBench(fallbackSquad.slice(11, 18));
            setReserves(fallbackSquad.slice(18));
            setTacticAssignments(alignAssignments(fallbackSquad.slice(0, 11), formationPositions[savedFormation]));
          } else {
            setStarting([]);
            setBench([]);
            setReserves([]);
          }

          if (leagueId) {
            setSelectedLeague(leagueId, teamInfo);
          }
        } else {
          setError("Failed to fetch team data");
        }
      } catch (error) {
        setError("An error occurred while fetching team data");
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [leagueId]);

  // Compute ratings
  const ratings = useMemo(() => {
    const labs = positions.map((p) => p?.label).filter(Boolean);
    const realStarting = starting.filter((p) => p && !p.player_id?.startsWith('empty-') && typeof p.overall_rating === 'number');

    const isDef = (l: string | undefined) => l ? ["GK", "CB", "LB", "RB", "LWB", "RWB", "WB"].includes(l) : false;
    const isMid = (l: string | undefined) => l ? ["CDM", "CM", "CAM", "LM", "RM"].some((x) => l.includes(x)) : false;
    const isAtk = (l: string | undefined) => l ? ["ST", "CF", "AM", "FW", "W"].some((x) => l.includes(x)) : false;

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    return {
      overall: avg(realStarting.map((p) => p.overall_rating)),
      attack: avg(starting.filter((p, i) => p && !p.player_id?.startsWith('empty-') && isAtk(labs[i])).map((p) => p.overall_rating)),
      midfield: avg(starting.filter((p, i) => p && !p.player_id?.startsWith('empty-') && isMid(labs[i])).map((p) => p.overall_rating)),
      defense: avg(starting.filter((p, i) => p && !p.player_id?.startsWith('empty-') && isDef(labs[i])).map((p) => p.overall_rating)),
    };
  }, [starting, positions]);

  const alignedAssignments = useMemo(() => alignAssignments(starting, positions, tacticAssignments), [starting, positions, tacticAssignments]);
  const pitchPositions = useMemo(() => shapeMode === "with" ? deriveWithBallPositions(positions, alignedAssignments) : positions, [shapeMode, positions, alignedAssignments]);
  const diagnostics = useMemo(() => deriveTacticDiagnostics({ assignments: alignedAssignments, buildUpStyle, defensiveApproach, lineHeight }), [alignedAssignments, buildUpStyle, defensiveApproach, lineHeight]);
  const squadDiagnostics = useMemo(() => deriveSquadDiagnostics(starting, alignedAssignments), [starting, alignedAssignments]);

  // Save team changes
  async function saveTeamChanges(newStarting: Player[], newBench: Player[], newReserves: Player[], newFormation?: string) {
    if (!teamData?.id) return;

    const formationToSave = newFormation || formation;

    const isReal = (p: Player) => p && p.player_id && !p.player_id.startsWith('empty-');
    const validStarting = newStarting.filter(isReal);
    const validBench = newBench.filter(isReal);
    const validReserves = newReserves.filter(isReal);
    const formationSlots = formationPositions[formationToSave] || [];
    const nextAssignments = alignAssignments(newStarting, formationSlots, tacticAssignments);

    try {
      const response = await fetch('/api/team/formation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: teamData.id,
          formation: formationToSave,
          startingLineup: validStarting.map(p => p.player_id),
          bench: validBench.map(p => p.player_id),
          reserves: validReserves.map(p => p.player_id),
          eafcTacticCode: eafcTacticCode.trim() || undefined,
          eafcComment: eafcComment.trim() || undefined,
          tactic: {
            formation: formationToSave,
            buildUpStyle,
            defensiveApproach,
            lineHeight,
            assignments: nextAssignments,
          }
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = Array.isArray(payload?.details) ? payload.details.join('. ') : payload?.error;
        throw new Error(detail || 'Failed to save team changes');
      }

      if (setSelectedLeague && leagueId) {
        setSelectedLeague(leagueId, {
          ...teamData,
          formation: formationToSave,
          squad: [...validStarting, ...validBench, ...validReserves]
        });
      }
      setTacticAssignments(nextAssignments);
      if (payload?.warning) toast.warning(payload.warning);
      else toast.success('Tactic and matchday squad saved');
    } catch (error) {
      console.error('Error saving team changes:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save team changes');
    }
  }

  // Get player at a given location (handles empty pitch slots beyond starting.length)
  const getAt = (loc: Location): Player => {
    if (loc.area === "starting") return getPlayerForPosition(loc.index);
    if (loc.area === "bench") return bench[loc.index];
    return reserves[loc.index];
  };

  // Swap the players at two locations and persist
  function performSwap(locA: Location, locB: Location) {
    const newStarting = [...starting];
    const newBench = [...bench];
    const newReserves = [...reserves];

    const ensure = (loc: Location) => {
      if (loc.area === "starting") {
        while (newStarting.length <= loc.index) {
          newStarting.push(emptyPlayer(newStarting.length, positions[newStarting.length]?.label));
        }
      }
    };
    ensure(locA);
    ensure(locB);

    const getArr = (area: Location["area"]) =>
      area === "starting" ? newStarting : area === "bench" ? newBench : newReserves;

    const arrA = getArr(locA.area);
    const arrB = getArr(locB.area);

    const playerA = arrA[locA.index];
    const playerB = arrB[locB.index];
    arrA[locA.index] = playerB;
    arrB[locB.index] = playerA;

    setStarting(newStarting);
    setBench(newBench);
    setReserves(newReserves);
    saveTeamChanges(newStarting, newBench, newReserves);

    const nameOf = (p: Player) => (p.player_id.startsWith("empty-") ? "Empty slot" : formatPlayerName(p.full_name || p.name));
    toast.success(`Swapped ${nameOf(playerA)} ⇄ ${nameOf(playerB)}`);
  }

  // Tap-to-select / tap-to-swap
  function handleSelect(loc: Location) {
    const player = getAt(loc);

    if (!selected) {
      if (player.player_id.startsWith("empty-")) return;
      setSelected(loc);
      return;
    }

    if (selected.area === loc.area && selected.index === loc.index) {
      setSelected(null);
      return;
    }

    performSwap(selected, loc);
    setSelected(null);
  }

  // Get player for position
  const getPlayerForPosition = (positionIndex: number): Player => {
    if (starting.length > positionIndex && starting[positionIndex]) {
      // A lineup slot is an assignment, not a player attribute. Keep the player's
      // real eligible positions intact so position fit remains trustworthy.
      return starting[positionIndex];
    }
    return emptyPlayer(positionIndex, positions[positionIndex]?.label);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-border-strong border-t-accent mx-auto"></div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Loading team data...</p>
        </div>
      </div>
    );
  }

  if (error || !teamData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-status-negative text-xl mb-4 font-bold uppercase tracking-wide">Error</div>
          <p className="text-muted-foreground mb-4">{error || "Team not found"}</p>
          <Button onClick={() => router.push("/saves")} className="w-full">
            Back to Saves
          </Button>
        </div>
      </div>
    );
  }

  const hasNoPlayers = teamData.squad.length === 0 && starting.length === 0;
  const injuredPlayers = (teamData.allPlayers || []).filter((p) => p.isInjured);

  return (
    <div className="h-full flex flex-col p-6 bg-background text-foreground">
      <Toaster position="top-center" />

      {hasNoPlayers && (
        <Alert className="mb-6 border-status-warning/30 bg-status-warning/10">
          <AlertTriangle className="h-4 w-4 text-status-warning" />
          <AlertDescription>
            Your starter squad has not been generated yet. This can happen if the league was created before the update.
            Ask your league host to run &quot;Generate Starter Squads&quot; from Host Controls, or create a new league.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="mb-6">
        <PageHeader
          eyebrow="Team Management"
          title={teamData.name}
          subtitle="Tap a player, then tap another slot to swap them"
          stats={[
            { label: "AVG", value: ratings.overall, emphasis: true },
            { label: "ATK", value: ratings.attack },
            { label: "MID", value: ratings.midfield },
            { label: "DEF", value: ratings.defense },
          ]}
          actions={
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
          }
        />
      </div>

      <>
        {/* Pitch and Squad side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Pitch — formation lives here, tightly coupled to what it controls */}
          <div className="lg:col-span-2">
            <div className="bg-surface border border-border-strong p-3 rounded-lg sticky top-6">
              <div className="flex items-center justify-between px-1 pb-3">
                <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Formation</span>
                <Select
                  value={formation}
                  onValueChange={(newFormation) => {
                    setFormation(newFormation);
                    saveTeamChanges(starting, bench, reserves, newFormation);
                  }}
                >
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue placeholder="Select formation" />
                  </SelectTrigger>
                  <SelectContent>
                    {formations.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-3 grid grid-cols-2 rounded-md border border-border bg-surface-2 p-1" aria-label="Tactical shape">
                <button type="button" onClick={() => setShapeMode("without")} className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${shapeMode === "without" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Without ball</button>
                <button type="button" onClick={() => setShapeMode("with")} className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${shapeMode === "with" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>With ball</button>
              </div>
              <Pitch
                positions={pitchPositions}
                players={starting}
                onOpenDetail={openDetail}
                getPlayerForPosition={getPlayerForPosition}
                selectedIndex={selected?.area === "starting" ? selected.index : null}
                onSelect={(index) => handleSelect({ area: "starting", index })}
              />

              {/* EAFC sync — secondary metadata, tucked below the tactics interaction it doesn't affect */}
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground shrink-0">EAFC Code</span>
                  <Input
                    placeholder="e.g. m4@qGU2uyGCm"
                    value={eafcTacticCode}
                    onChange={(e) => setEafcTacticCode(e.target.value)}
                    onBlur={() => saveTeamChanges(starting, bench, reserves)}
                    className="h-7 text-xs font-mono flex-1"
                  />
                </div>
                <textarea
                  placeholder="Notes for host — e.g. key player injured, use this when ahead..."
                  value={eafcComment}
                  onChange={(e) => setEafcComment(e.target.value)}
                  onBlur={() => saveTeamChanges(starting, bench, reserves)}
                  className="w-full min-h-[48px] p-2 rounded-md bg-surface-2 border border-border text-xs resize-y focus:outline-none focus:ring-1 focus:ring-accent"
                  rows={2}
                />
                <p className="text-[10px] text-faint-foreground">Saves automatically</p>
              </div>
            </div>
          </div>

          {/* Right: Squad Management */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="tactic" className="space-y-3">
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-lg border border-border-strong bg-surface p-1">
                <TabsTrigger value="tactic" className="h-8">Tactic</TabsTrigger>
                <TabsTrigger value="squad" className="h-8">Squad selection</TabsTrigger>
              </TabsList>
              <TabsContent value="tactic" className="mt-0">
            <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">FC IQ tactic</h2>
                  <p className="text-sm text-muted-foreground mt-1">Shape, transition, and role behavior used by automated simulation.</p>
                </div>
                <Button size="sm" onClick={() => saveTeamChanges(starting, bench, reserves)}>Save tactic</Button>
              </div>
              <div className="border-b border-border px-5 pt-3">
                <div className="flex gap-1" role="tablist" aria-label="Tactic editor section">
                  {(["overview", "roles"] as const).map((section) => (
                    <button
                      key={section}
                      type="button"
                      role="tab"
                      aria-selected={tacticSection === section}
                      onClick={() => setTacticSection(section)}
                      className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${tacticSection === section ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      {section === "overview" ? "Overview" : "Player roles"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5 space-y-5">
                {tacticSection === "overview" ? <>
                <div className="space-y-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium">Build-up</label>
                      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
                        {(["short_passing", "balanced", "counter"] as BuildUpStyle[]).map((value) => (
                          <button key={value} type="button" onClick={() => setBuildUpStyle(value)} aria-pressed={buildUpStyle === value} className={`min-h-9 rounded-md px-2 text-xs font-medium transition-colors ${buildUpStyle === value ? "bg-accent-muted text-accent ring-1 ring-accent/40" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}>
                            {value === "short_passing" ? "Short passing" : value[0].toUpperCase() + value.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium">Defensive approach</label>
                      <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-background p-1">
                        {(Object.keys(DEFENSIVE_APPROACHES) as DefensiveApproach[]).map((value) => (
                          <button key={value} type="button" onClick={() => { setDefensiveApproach(value); setLineHeight(DEFENSIVE_APPROACHES[value].default); }} aria-pressed={defensiveApproach === value} className={`min-h-9 rounded-md px-1 text-xs font-medium capitalize transition-colors ${defensiveApproach === value ? "bg-accent-muted text-accent ring-1 ring-accent/40" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}>
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-2 p-3">
                    <label className="text-xs font-medium mb-2 flex justify-between"><span>Line height</span><span className="font-mono text-accent">{lineHeight}</span></label>
                    <input
                      aria-label="Defensive line height"
                      type="range"
                      min={DEFENSIVE_APPROACHES[defensiveApproach].min}
                      max={DEFENSIVE_APPROACHES[defensiveApproach].max}
                      value={lineHeight}
                      onChange={(event) => setLineHeight(Number(event.target.value))}
                      className="w-full accent-accent mt-3"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>{DEFENSIVE_APPROACHES[defensiveApproach].min}</span><span>{DEFENSIVE_APPROACHES[defensiveApproach].max}</span></div>
                  </div>
                </div>

                <div className="border-t border-border pt-5">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">Squad readiness</h3>
                    <p className="text-xs text-muted-foreground">Actual XI attributes measured against the work this tactic asks them to do. Low scores identify lineup or recruitment gaps.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {squadDiagnostics.map((diagnostic) => (
                      <div key={diagnostic.key} className="rounded-lg border border-border bg-surface-2 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium">{diagnostic.label}</span>
                          <span className={`font-mono text-sm ${diagnostic.status === "strength" ? "text-status-positive" : diagnostic.status === "gap" ? "text-status-negative" : "text-accent"}`}>
                            {diagnostic.score}
                          </span>
                        </div>
                        <div className="my-2 h-1.5 overflow-hidden rounded-full bg-background">
                          <div
                            className={`h-full rounded-full transition-[width] ${diagnostic.status === "strength" ? "bg-status-positive" : diagnostic.status === "gap" ? "bg-status-negative" : "bg-accent"}`}
                            style={{ width: `${diagnostic.score}%` }}
                          />
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground" title={diagnostic.weakest.map((player) => `${player.name} ${player.value}`).join(", ")}>
                          {diagnostic.weakest.length ? `Weakest: ${diagnostic.weakest.map((player) => `${formatPlayerName(player.name)} ${player.value}`).join(" · ")}` : "No eligible players"}
                        </p>
                        {diagnostic.fallbackCount > 0 && (
                          <p className="mt-1 text-[10px] text-status-warning">OVR fallback used for {diagnostic.fallbackCount}/{diagnostic.playerCount}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <details className="rounded-lg border border-border bg-surface-2 p-3">
                  <summary className="flex cursor-pointer list-none items-end justify-between gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <div><h3 className="text-sm font-semibold">Tactical shape details</h3><p className="text-xs text-muted-foreground">Attacking intent, defensive cover, width, workload, length, and build-up behavior.</p></div>
                    <Badge variant="outline">{shapeMode === "with" ? "With ball" : "Without ball"}</Badge>
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(Object.entries(diagnostics) as Array<[keyof typeof diagnostics, number]>).map(([key, value]) => {
                      const labels: Record<string, string> = { attack: "Attacking intent", defence: "Defensive cover", width: "Width", endurance: "Endurance", length: "Length", buildUp: "Build-Up" };
                      const explanations: Record<string, string> = {
                        attack: value >= 65 ? "Many forward runners and box occupation" : value <= 40 ? "Conservative final-third presence" : "Balanced attacking support",
                        defence: value >= 65 ? "Strong defensive occupation and recovery" : value <= 40 ? "Shape can be exposed after losses" : "Balanced defensive cover",
                        width: value >= 65 ? "Stretches both touchline channels" : value <= 40 ? "Narrow central occupation" : "Mixed central and wide outlets",
                        endurance: value >= 65 ? "High movement and stamina demand" : value <= 40 ? "Low-intensity positional demands" : "Moderate physical demand",
                        length: value >= 65 ? "Vertically stretched transition shape" : value <= 40 ? "Compact support distances" : "Balanced line spacing",
                        buildUp: value >= 65 ? "Many progression and passing outlets" : value <= 40 ? "Direct play with limited circulation" : "Balanced progression support",
                      };
                      return <div key={key} className="rounded-lg border border-border bg-surface-2 p-3">
                        <div className="flex items-center justify-between"><span className="text-xs font-medium">{labels[key]}</span><span className="font-mono text-sm text-accent">{value}</span></div>
                        <div className="my-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${value}%` }} /></div>
                        <p className="text-[11px] leading-snug text-muted-foreground">{explanations[key]}</p>
                      </div>;
                    })}
                  </div>
                </details>

                </> : (
                <div>
                  <div className="grid grid-cols-[42px_minmax(130px,1fr)_minmax(150px,1fr)_minmax(120px,0.8fr)] gap-2 px-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Pos</span><span>Player</span><span>Role</span><span>Focus</span>
                  </div>
                  <div className="divide-y divide-border border-y border-border">
                    {positions.slice(0, 11).map((slot, slotIndex) => {
                      const player = getPlayerForPosition(slotIndex);
                      const assignment = tacticAssignments[slotIndex] || { ...defaultAssignmentForPosition(slot.label), slotIndex, slotPosition: slot.label, playerId: player.player_id };
                      const roles = allowedRolesForPosition(slot.label);
                      const selectedRole = roles.find((definition) => definition.role === assignment.role) || roles[0];
                      return (
                        <div key={`${slot.label}-${slotIndex}`} className="grid grid-cols-[42px_minmax(130px,1fr)_minmax(150px,1fr)_minmax(120px,0.8fr)] gap-2 items-center px-2 py-2.5">
                          <Badge variant="outline" className="justify-center px-1">{slot.label}</Badge>
                          <div className="min-w-0">
                            <p className="truncate text-sm">{player.player_id.startsWith("empty-") ? "Empty slot" : formatPlayerName(player.full_name || player.name)}</p>
                            {!player.player_id.startsWith("empty-") && (() => {
                              const familiarity = roleFamiliarity(player as unknown as Record<string, unknown>, slot.label, assignment.role);
                              const label = familiarity.level === "role_plus_plus" ? "Role++" : familiarity.level === "role_plus" ? "Role+" : familiarity.level === "base_role" ? "Base role" : "Out of position";
                              const positionLabel = familiarity.positionFit === "natural" ? "Natural position" : familiarity.positionFit === "familiar" ? "Related position" : "Wrong position";
                              const profileNote = familiarity.profileSource === "attributes"
                                ? `role attributes ${familiarity.profile}`
                                : familiarity.profileSource === "mixed_fallback"
                                  ? `available role attributes plus OVR fallback ${familiarity.profile}`
                                  : `OVR fallback ${familiarity.profile}`;
                              return <span
                                className={`text-[10px] ${familiarity.level === "out_of_position" ? "text-status-negative" : familiarity.level === "role_plus_plus" ? "text-status-positive" : "text-muted-foreground"}`}
                                title={`${positionLabel}; ${profileNote}. Position fit and the attributes required by ${assignment.role.replace(/_/g, " ")} determine execution.`}
                              >{familiarity.level === "out_of_position" ? `Wrong position · ${Math.round(familiarity.multiplier * 100)}%` : `${familiarity.positionFit === "natural" ? "Natural" : "Related"} · ${label} · ${Math.round(familiarity.multiplier * 100)}%`}</span>;
                            })()}
                          </div>
                          <Select value={assignment.role} onValueChange={(role) => {
                            const definition = roles.find((entry) => entry.role === role)!;
                            setTacticAssignments((current) => alignAssignments(starting, positions, current).map((item, index) => index === slotIndex ? { ...item, role, focus: definition.focuses[0] } : item));
                          }}>
                            <SelectTrigger className="h-9 border-border-strong bg-background text-xs capitalize transition-colors hover:border-accent/50 data-[state=open]:border-accent data-[state=open]:ring-1 data-[state=open]:ring-accent/30"><SelectValue /></SelectTrigger>
                            <SelectContent>{roles.map((entry) => <SelectItem key={entry.role} value={entry.role}>{entry.role.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={assignment.focus} onValueChange={(focus) => setTacticAssignments((current) => alignAssignments(starting, positions, current).map((item, index) => index === slotIndex ? { ...item, focus: focus as TacticAssignment["focus"] } : item))}>
                            <SelectTrigger className="h-9 border-border-strong bg-background text-xs capitalize transition-colors hover:border-accent/50 data-[state=open]:border-accent data-[state=open]:ring-1 data-[state=open]:ring-accent/30"><SelectValue /></SelectTrigger>
                            <SelectContent>{selectedRole.focuses.map((focus: TacticAssignment["focus"]) => <SelectItem key={focus} value={focus}>{focus.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>
            </div>
              </TabsContent>
              <TabsContent value="squad" className="mt-0">
            <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
              <div className="px-6 py-5 border-b border-border">
                <h2 className="text-lg font-semibold">Squad selection</h2>
                <p className="text-sm text-muted-foreground mt-1">Select a player here, then choose a position on the pitch to swap them.</p>
              </div>
              <div className="p-6 pt-3">
                <ScrollArea className="h-[600px] rounded-lg pr-3">
                  <div className="space-y-5">
                    {/* Bench */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Bench</h3>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {bench.filter(player => player).length}/7
                        </span>
                      </div>
                      <div className="space-y-2 p-1">
                        {bench.filter(player => player).map((player, i) => (
                          <SquadCard
                            key={player.player_id}
                            player={player}
                            onOpenDetail={openDetail}
                            isSelected={selected?.area === "bench" && selected.index === i}
                            onSelect={() => handleSelect({ area: "bench", index: i })}
                          />
                        ))}
                        {bench.length === 0 && (
                          <div className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
                            No players on the bench
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reserves */}
                    <div>
                      <h3 className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Reserves</h3>
                      <div className="space-y-2 p-1">
                        {reserves.filter(player => player).map((player, i) => (
                          <SquadCard
                            key={player.player_id}
                            player={player}
                            onOpenDetail={openDetail}
                            isSelected={selected?.area === "reserves" && selected.index === i}
                            onSelect={() => handleSelect({ area: "reserves", index: i })}
                          />
                        ))}
                        {reserves.length === 0 && (
                          <div className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
                            No reserve players
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Unavailable Players */}
                    {injuredPlayers.length > 0 && (
                      <div>
                        <h3 className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-2">Unavailable</h3>
                        <div className="space-y-2">
                          {injuredPlayers.map((player, i) => (
                            <div
                              key={`unavailable-${i}-${player.player_id}`}
                              className="flex items-center justify-between p-3 bg-surface-2 border border-status-negative/30 rounded-lg opacity-75"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-surface-3 overflow-hidden opacity-50">
                                  <PlayerAvatar
                                    src={player.image}
                                    alt={player.name}
                                    className="w-full h-full object-cover grayscale"
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground/80">{formatPlayerName(player.full_name || player.name)}</p>
                                    <Badge variant="destructive" className="text-xs">
                                      {player.injuryType || 'Injured'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs border-status-negative/40 text-status-negative">{player.positions}</Badge>
                                    <span className="text-xs text-status-negative">{player.gamesRemaining} games out</span>
                                  </div>
                                </div>
                              </div>
                              <Badge className={`${getRatingColorClasses(player.overall_rating)} opacity-50`}>{player.overall_rating}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              </div>
            </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </>

      <PlayerDetailSheet
        player={detailPlayer}
        teamId={teamData.id}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
