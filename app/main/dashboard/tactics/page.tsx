"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast, Toaster } from "sonner";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

import { formationPositions, Position } from "@/lib/formationPositions";
import TeamFormationDisplay from "@/components/TeamFormationDisplay";
import { Images } from "@/lib/assets";
import { useLeague } from "@/contexts/LeagueContext";
import { formatPlayerName } from "@/utils/playerUtils";
import { getRatingColorClasses } from "@/utils/ratingColors";

// Helper component for player images with fallback
const PlayerImage = ({ src, alt, className, width = 48, height = 48 }: {
  src?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) => {
  const [imageSrc, setImageSrc] = useState<string>(src || Images.NoImage.src);
  
  useEffect(() => {
    if (src && src.startsWith('http')) {
      // Use proxy route for external URLs to bypass CORS
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
      setImageSrc(proxyUrl);
    } else {
      // Use local images directly
      setImageSrc(src || Images.NoImage.src);
    }
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => {
        setImageSrc(Images.NoImage.src);
      }}
      crossOrigin="anonymous"
    />
  );
};

// Player interface
interface Player {
  player_id: string;
  name: string;
  full_name?: string;
  positions: string;
  overall_rating: number;
  image?: string;
  role?: string;
  description?: string;
  isInjured?: boolean;
  injuryType?: string;
  gamesRemaining?: number;
}

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

// Main component
export default function TacticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedLeagueId, setSelectedLeague } = useLeague();
  
  // Use leagueId from URL params or global context
  const leagueId = searchParams.get('league') || searchParams.get('leagueId') || selectedLeagueId;
  
  // Debug logging
  console.log('Tactics page - URL params:', {
    league: searchParams.get('league'),
    leagueId: searchParams.get('leagueId'),
    selectedLeagueId,
    finalLeagueId: leagueId
  });

  // Update URL if we have a league ID from context but not from URL
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

  // Swap dialog state
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [benchReserveSwap, setBenchReserveSwap] = useState<{benchPlayerId: string | null, reservePlayerId: string | null}>({
    benchPlayerId: null,
    reservePlayerId: null
  });

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
          
          // Use real squad data only - no mock/placeholder players
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
          
          // Update formation state with saved formation
          setFormation(savedFormation);
           
                     // Initialize squad sections from API data or fallback to distributing squad
          if (data.team?.starting_lineup && data.team?.starting_lineup.length > 0) {
            
            // Create a map of full player data by player_id for efficient lookup
            const squadPlayerMap = new Map();
            squad.forEach((player: any) => {
              squadPlayerMap.set(player.player_id, player);
            });
            
            // Filter out undefined entries and merge with full player data from squad
            const validStarting = data.team.starting_lineup.filter((p: any) => p && p.player_id).map((p: any) => {
              const fullPlayer = squadPlayerMap.get(p.player_id);
              return {
                ...fullPlayer, // Use full player data (including image)
                ...p, // Override with any specific data from starting_lineup
                positions: fullPlayer?.positions || p.positions || "ST",
                overall_rating: typeof fullPlayer?.overall_rating === 'number' ? fullPlayer.overall_rating : 
                               typeof p.overall_rating === 'number' ? p.overall_rating : 70
              };
            });
            const validBench = (data.team?.bench || []).filter((p: any) => p && p.player_id).map((p: any) => {
              const fullPlayer = squadPlayerMap.get(p.player_id);
              return {
                ...fullPlayer, // Use full player data (including image)
                ...p, // Override with any specific data from bench
                positions: fullPlayer?.positions || p.positions || "ST",
                overall_rating: typeof fullPlayer?.overall_rating === 'number' ? fullPlayer.overall_rating : 
                               typeof p.overall_rating === 'number' ? p.overall_rating : 70
              };
            });
            const validReserves = (data.team?.reserves || []).filter((p: any) => p && p.player_id).map((p: any) => {
              const fullPlayer = squadPlayerMap.get(p.player_id);
              return {
                ...fullPlayer, // Use full player data (including image)
                ...p, // Override with any specific data from reserves
                positions: fullPlayer?.positions || p.positions || "ST",
                overall_rating: typeof fullPlayer?.overall_rating === 'number' ? fullPlayer.overall_rating : 
                               typeof p.overall_rating === 'number' ? p.overall_rating : 70
              };
            });
            

            
            // Ensure starting lineup has 11 players by filling with real players from bench/reserves
            const paddedStarting = [...validStarting];
            const availablePlayers = [...validBench, ...validReserves].map((p: any) => ({
              ...p,
              positions: p.positions || "ST",
              overall_rating: typeof p.overall_rating === 'number' ? p.overall_rating : 70
            }));
            
            while (paddedStarting.length < 11 && availablePlayers.length > 0) {
              // Take the first available player
              const nextPlayer = availablePlayers.shift()!;
              paddedStarting.push(nextPlayer);
            }
            
            // Update bench and reserves after filling starting lineup
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
          } else if (squad.length > 0) {
            // Fallback: distribute squad manually on frontend
            const processedSquad = squad.map((player: any) => ({
              ...player,
              positions: player.positions || "ST",
              overall_rating: typeof player.overall_rating === 'number' ? player.overall_rating : 70
            }));
            setStarting(processedSquad.slice(0, 11));
            setBench(processedSquad.slice(11, 18));
            setReserves(processedSquad.slice(18));
          } else {
            // No players - show empty state (will be handled by UI)
            setStarting([]);
            setBench([]);
            setReserves([]);
          }
           
           // Save to global context
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
    const vals = starting.filter(p => p && typeof p.overall_rating === 'number').map((p) => p.overall_rating);
    
    const isDef = (l: string | undefined) => l ? ["GK", "CB", "LB", "RB", "LWB", "RWB", "WB"].includes(l) : false;
    const isMid = (l: string | undefined) => l ? ["CDM", "CM", "CAM", "LM", "RM"].some((x) => l.includes(x)) : false;
    const isAtk = (l: string | undefined) => l ? ["ST", "CF", "AM", "FW", "W"].some((x) => l.includes(x)) : false;
    
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    
    return {
      overall: avg(vals),
      attack: avg(starting.filter((p, i) => p && typeof p.overall_rating === 'number' && isAtk(labs[i])).map((p) => p.overall_rating)),
      midfield: avg(starting.filter((p, i) => p && typeof p.overall_rating === 'number' && isMid(labs[i])).map((p) => p.overall_rating)),
      defense: avg(starting.filter((p, i) => p && typeof p.overall_rating === 'number' && isDef(labs[i])).map((p) => p.overall_rating)),
    };
  }, [starting, positions]);

  // Save team changes
  async function saveTeamChanges(newStarting: Player[], newBench: Player[], newReserves: Player[], newFormation?: string) {
    if (!teamData?.id) return;

    const formationToSave = newFormation || formation;
    
    // Filter out any undefined entries before mapping
    const validStarting = newStarting.filter(p => p && p.player_id);
    const validBench = newBench.filter(p => p && p.player_id);
    const validReserves = newReserves.filter(p => p && p.player_id);
    
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
          eafcComment: eafcComment.trim() || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save team changes');
      }

      // Update context with new data
      if (setSelectedLeague && leagueId) {
        setSelectedLeague(leagueId, {
          ...teamData,
          formation: formationToSave,
          squad: [...validStarting, ...validBench, ...validReserves]
        });
      }

    } catch (error) {
      console.error('Error saving team changes:', error);
      toast.error('Failed to save team changes');
    }
  }

  // Swap logic
  async function doSwap(pid: string) {
    if (swapIdx === null) return;
    
    console.log('doSwap called with:', { pid, swapIdx, benchLength: bench.length, reservesLength: reserves.length, startingLength: starting.length });
    
    const pool = [...bench, ...reserves];
    console.log('Pool of available players:', pool.map(p => ({ id: p?.player_id, name: p?.name })));
    
    const picked = pool.find((p) => p && p.player_id === pid);
    const replaced = starting[swapIdx];
    
    console.log('Swap details:', { 
      picked: picked ? { id: picked.player_id, name: picked.name } : null,
      replaced: replaced ? { id: replaced.player_id, name: replaced.name } : null,
      swapIdx,
      startingAtIdx: starting[swapIdx] ? { id: starting[swapIdx].player_id, name: starting[swapIdx].name } : null
    });

    // Validate that we have valid players to swap
    if (!picked || !replaced) {
      console.error('Invalid swap: picked or replaced player is undefined', { 
        picked: picked ? { id: picked.player_id, name: picked.name } : null,
        replaced: replaced ? { id: replaced.player_id, name: replaced.name } : null,
        swapIdx,
        pool: pool.map(p => ({ id: p?.player_id, name: p?.name })),
        starting: starting.map(p => ({ id: p?.player_id, name: p?.name }))
      });
      toast.error('Invalid swap operation - please try again');
      return;
    }
    
    // Prevent swapping with empty positions
    if (replaced.player_id?.startsWith('empty-')) {
      console.error('Cannot swap empty positions');
      toast.error('Cannot swap empty positions');
      return;
    }

    // Create new arrays for state updates
    let newBench = [...bench];
    let newReserves = [...reserves];
    let newStarting = [...starting];

    if (bench.some((b) => b.player_id === pid)) {
      newBench = bench.filter((x) => x.player_id !== pid).concat([replaced]);
    } else {
      newReserves = reserves.filter((x) => x.player_id !== pid).concat([replaced]);
    }

    newStarting[swapIdx] = picked;

    // Save changes to the server
    await saveTeamChanges(newStarting, newBench, newReserves);

    // Update local state
    setBench(newBench);
    setReserves(newReserves);
    setStarting(newStarting);

    toast.success(`Swapped ${replaced.name} ⇄ ${picked.name}`);
    setSwapOpen(false);
    setSwapIdx(null);
  }

  // Swap between bench and reserves
  async function doBenchReserveSwap(benchPlayerId: string, reservePlayerId: string) {
    console.log('Bench-Reserve swap called with:', { benchPlayerId, reservePlayerId });
    
    const benchPlayer = bench.find((p) => p && p.player_id === benchPlayerId);
    const reservePlayer = reserves.find((p) => p && p.player_id === reservePlayerId);
    
    if (!benchPlayer || !reservePlayer) {
      console.error('Invalid bench-reserve swap: one or both players not found');
      toast.error('Invalid swap operation - please try again');
      return;
    }

    // Create new arrays for state updates
    const newBench = bench.map((p) => p.player_id === benchPlayerId ? reservePlayer : p);
    const newReserves = reserves.map((p) => p.player_id === reservePlayerId ? benchPlayer : p);

    // Ensure bench doesn't exceed 7 players
    if (newBench.length > 7) {
      console.log('Bench would exceed 7 players, moving excess to reserves');
      const excessPlayers = newBench.slice(7);
      const trimmedBench = newBench.slice(0, 7);
      const updatedReserves = [...newReserves, ...excessPlayers];
      
      // Save changes to the server
      await saveTeamChanges(starting, trimmedBench, updatedReserves);

      // Update local state
      setBench(trimmedBench);
      setReserves(updatedReserves);

      toast.success(`Swapped ${benchPlayer.name} ⇄ ${reservePlayer.name} (bench limited to 7 players)`);
    } else {
      // Save changes to the server
      await saveTeamChanges(starting, newBench, newReserves);

      // Update local state
      setBench(newBench);
      setReserves(newReserves);

      toast.success(`Swapped ${benchPlayer.name} ⇄ ${reservePlayer.name}`);
    }
  }

  // Get player for position
  const getPlayerForPosition = (positionIndex: number): Player => {
    if (starting.length > positionIndex && starting[positionIndex]) {
      return {
        ...starting[positionIndex],
        positions: positions[positionIndex]?.label || starting[positionIndex].positions || "ST"
      };
    }
    
    // Return a minimal player object if no player is available
    return {
      player_id: `empty-${positionIndex}`,
      name: "Empty Position",
      full_name: "Empty Position",
      positions: positions[positionIndex]?.label || "ST",
      overall_rating: 0,
      image: undefined,
      role: positions[positionIndex]?.label || "ST"
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team data...</p>
        </div>
      </div>
    );
  }

  if (error || !teamData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600 mb-4">{error || "Team not found"}</p>
          <Button onClick={() => router.push("/saves")} className="w-full">
            Back to Saves
          </Button>
        </div>
      </div>
    );
  }

  // Empty squad state - no real players (starter squad not generated)
  const hasNoPlayers = teamData.squad.length === 0 && starting.length === 0;

  return (
    <div className="h-full flex flex-col p-6 bg-[#0b0b0d] text-white">
      <Toaster position="top-center" />

      {/* Empty squad notice */}
      {hasNoPlayers && (
        <Alert className="mb-6 border-amber-600/50 bg-amber-950/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your starter squad has not been generated yet. This can happen if the league was created before the update.
            Ask your league host to run &quot;Generate Starter Squads&quot; from Host Controls, or create a new league.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{teamData.name} - Team Management</h1>
          <p className="text-gray-400">Manage your squad and tactics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>AVG {ratings.overall}</Badge>
          <Badge variant="destructive">Atk {ratings.attack}</Badge>
          <Badge variant="default">Mid {ratings.midfield}</Badge>
          <Badge variant="secondary">Def {ratings.defense}</Badge>
          <Button variant="outline" onClick={() => router.back()}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Top bar: Rating, Formation, EAFC Code, Notes, Save */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-neutral-900/50 border border-neutral-800 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Rating Avg.</span>
            <Badge variant="secondary">{ratings.overall}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Formation</span>
            <Select
              value={formation}
              onValueChange={(newFormation) => {
                setFormation(newFormation);
                saveTeamChanges(starting, bench, reserves, newFormation);
              }}
            >
              <SelectTrigger className="w-28">
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">EAFC Tactic Code</span>
            <Input
              placeholder="e.g. m4@qGU2uyGCm"
              value={eafcTacticCode}
              onChange={(e) => setEafcTacticCode(e.target.value)}
              onBlur={() => saveTeamChanges(starting, bench, reserves)}
              className="w-40 font-mono text-sm"
            />
          </div>
          <Button variant="outline" onClick={() => saveTeamChanges(starting, bench, reserves)}>
            Save
          </Button>
        </div>
        <div className="flex gap-2 items-start">
          <span className="text-sm font-medium text-muted-foreground shrink-0 pt-2">Notes for Host</span>
          <textarea
            placeholder="e.g. Key player injured, use this when ahead..."
            value={eafcComment}
            onChange={(e) => setEafcComment(e.target.value)}
            onBlur={() => saveTeamChanges(starting, bench, reserves)}
            className="flex-1 min-h-[52px] p-2 rounded bg-neutral-800 text-sm resize-y"
            rows={2}
          />
        </div>
      </div>

      {/* Formation and Squad side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Formation */}
        <div className="bg-gradient-to-t border border-neutral-800 to-[#09090B] from-[#262626] p-4 rounded-lg">
          <TeamFormationDisplay
            formation={formation}
            positions={positions}
            players={starting}
            onPlayerClick={(idx) => {
              setSwapIdx(idx);
              setSwapOpen(true);
            }}
          />
        </div>

        {/* Right: Squad Management */}
          <div className="flex flex-col gap-4">
            <Card className="bg-neutral-950 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-lg">Squad Management</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] rounded-lg">
                  <div className="space-y-4">
                    {/* Starting XI */}
                    <div>
                      <h3 className="font-semibold text-green-400 mb-2">Starting XI</h3>
                      <div className="space-y-2">
                        {starting.map((player, i) => (
                          <div
                            key={`starting-${i}-${player.player_id}`}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                              player.player_id?.startsWith('empty-') 
                                ? 'bg-gray-900/20 border-gray-700/50 opacity-50' 
                                : 'bg-green-900/20 border-green-800/50 hover:bg-green-900/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                                                              <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden">
                                  <PlayerImage 
                                    src={player.image}
                                    alt={player.name || "Player"}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">
                                      {player.player_id?.startsWith('empty-') 
                                        ? 'Empty Position' 
                                        : formatPlayerName(player.full_name || player.name)
                                      }
                                    </p>
                                    {!player.player_id?.startsWith('empty-') && (
                                      <Badge className={getRatingColorClasses(player.overall_rating)}>{player.overall_rating}</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">{positions[i]?.label || "?"}</Badge>
                                    <span className="text-xs text-gray-400">{player.positions}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={player.player_id?.startsWith('empty-')}
                                onClick={() => {
                                  setSwapIdx(i);
                                  setSwapOpen(true);
                                }}
                              >
                                Swap
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bench */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-yellow-400">Bench</h3>
                        <span className="text-xs text-yellow-400/70">
                          {bench.filter(player => player).length}/7
                        </span>
                      </div>
                      <div className="space-y-2">
                        {bench.filter(player => player).map((player, i) => (
                          <div
                            key={`bench-${i}-${player.player_id}`}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                              benchReserveSwap.benchPlayerId === player.player_id
                                ? 'bg-yellow-900/40 border-yellow-600/70'
                                : 'bg-yellow-900/20 border-yellow-800/50 hover:bg-yellow-900/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gray-800 overflow-hidden">
                                <PlayerImage 
                                  src={player.image}
                                  alt={player.name || "Player"}
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-medium">{formatPlayerName(player.full_name || player.name)}</p>
                                <p className="text-sm text-gray-400">{player.positions}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getRatingColorClasses(player.overall_rating)}>{player.overall_rating}</Badge>
                              <Button
                                size="sm"
                                variant={benchReserveSwap.benchPlayerId === player.player_id ? "default" : "outline"}
                                onClick={() => {
                                  if (benchReserveSwap.benchPlayerId === player.player_id) {
                                    setBenchReserveSwap({ benchPlayerId: null, reservePlayerId: null });
                                  } else {
                                    setBenchReserveSwap({ 
                                      benchPlayerId: player.player_id, 
                                      reservePlayerId: benchReserveSwap.reservePlayerId 
                                    });
                                  }
                                }}
                              >
                                {benchReserveSwap.benchPlayerId === player.player_id ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reserves */}
                    <div>
                      <h3 className="font-semibold text-gray-400 mb-2">Reserves</h3>
                      <div className="space-y-2">
                        {reserves.filter(player => player).map((player, i) => (
                          <div
                            key={`reserves-${i}-${player.player_id}`}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                              benchReserveSwap.reservePlayerId === player.player_id
                                ? 'bg-gray-900/40 border-gray-600/70'
                                : 'bg-gray-900/20 border-gray-800/50 hover:bg-gray-900/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gray-800 overflow-hidden">
                                <PlayerImage 
                                  src={player.image}
                                  alt={player.name || "Player"}
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-medium">{formatPlayerName(player.full_name || player.name)}</p>
                                <p className="text-sm text-gray-400">{player.positions}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getRatingColorClasses(player.overall_rating)}>{player.overall_rating}</Badge>
                              <Button
                                size="sm"
                                variant={benchReserveSwap.reservePlayerId === player.player_id ? "default" : "outline"}
                                onClick={() => {
                                  if (benchReserveSwap.reservePlayerId === player.player_id) {
                                    setBenchReserveSwap({ benchPlayerId: benchReserveSwap.benchPlayerId, reservePlayerId: null });
                                  } else {
                                    setBenchReserveSwap({ 
                                      benchPlayerId: benchReserveSwap.benchPlayerId, 
                                      reservePlayerId: player.player_id 
                                    });
                                  }
                                }}
                              >
                                {benchReserveSwap.reservePlayerId === player.player_id ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bench-Reserve Swap Controls */}
                    {(benchReserveSwap.benchPlayerId || benchReserveSwap.reservePlayerId) && (
                      <div className="flex justify-center gap-2 pt-4">
                        {benchReserveSwap.benchPlayerId && benchReserveSwap.reservePlayerId && (
                          <Button
                            onClick={() => {
                              doBenchReserveSwap(benchReserveSwap.benchPlayerId!, benchReserveSwap.reservePlayerId!);
                              setBenchReserveSwap({ benchPlayerId: null, reservePlayerId: null });
                            }}
                            className="bg-gradient-to-r from-yellow-600 to-gray-600 hover:from-yellow-700 hover:to-gray-700"
                          >
                            Swap Selected Players
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => setBenchReserveSwap({ benchPlayerId: null, reservePlayerId: null })}
                        >
                          Clear Selection
                        </Button>
                      </div>
                    )}

                    {/* Unavailable Players */}
                    {teamData.allPlayers && teamData.allPlayers.filter((player: Player) => player.isInjured).length > 0 && (
                      <div>
                        <h3 className="font-semibold text-red-400 mb-2">Unavailable</h3>
                        <div className="space-y-2">
                          {teamData.allPlayers.filter((player: Player) => player.isInjured).map((player, i) => (
                            <div
                              key={`unavailable-${i}-${player.player_id}`}
                              className="flex items-center justify-between p-3 bg-red-900/20 border border-red-800/50 rounded-lg opacity-75"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden opacity-50">
                                  <PlayerImage 
                                    src={player.image}
                                    alt={player.name}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover grayscale"
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-300">{formatPlayerName(player.full_name || player.name)}</p>
                                    <Badge variant="destructive" className="text-xs">
                                      {player.injuryType || 'Injured'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs border-red-600/50 text-red-400">{player.positions}</Badge>
                                    <span className="text-xs text-red-400">{player.gamesRemaining} games out</span>
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
              </CardContent>
            </Card>
          </div>
      </div>

      {/* Swap Dialog */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">
              {swapIdx !== null && starting[swapIdx] && (
                <>
                  Swap {formatPlayerName(starting[swapIdx].full_name || starting[swapIdx].name)} 
                  <Badge variant="outline" className="ml-2">{positions[swapIdx]?.label}</Badge>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6">
              {/* Bench Players */}
              {bench.filter(p => p).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <h3 className="font-semibold text-yellow-400 text-lg">Bench Players</h3>
                    <Badge variant="secondary" className="ml-auto">{bench.filter(p => p).length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {bench.filter(p => p).map((p, i) => (
                      <div
                        key={`swap-bench-${i}-${p.player_id}`}
                        className="group relative p-4 bg-gradient-to-r from-yellow-900/10 to-yellow-800/10 border border-yellow-800/30 rounded-xl hover:from-yellow-900/20 hover:to-yellow-800/20 hover:border-yellow-600/50 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                        onClick={() => doSwap(p.player_id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden border-2 border-yellow-600/20 group-hover:border-yellow-500/40">
                              <PlayerImage 
                                src={p.image}
                                alt={p.name}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <Badge className={`absolute -top-2 -right-2 px-1.5 py-0.5 ${getRatingColorClasses(p.overall_rating)}`}>
                              {p.overall_rating}
                            </Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white truncate">{formatPlayerName(p.full_name || p.name)}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs border-yellow-600/50 text-yellow-400">
                                {p.positions}
                              </Badge>
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-bold">↑</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reserve Players */}
              {reserves.filter(p => p).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <h3 className="font-semibold text-gray-400 text-lg">Reserve Players</h3>
                    <Badge variant="secondary" className="ml-auto">{reserves.filter(p => p).length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {reserves.filter(p => p).map((p, i) => (
                      <div
                        key={`swap-reserves-${i}-${p.player_id}`}
                        className="group relative p-4 bg-gradient-to-r from-gray-900/10 to-gray-800/10 border border-gray-700/30 rounded-xl hover:from-gray-800/20 hover:to-gray-700/20 hover:border-gray-500/50 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                        onClick={() => doSwap(p.player_id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden border-2 border-gray-600/20 group-hover:border-gray-500/40">
                              <PlayerImage 
                                src={p.image}
                                alt={p.name}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <Badge className={`absolute -top-2 -right-2 px-1.5 py-0.5 ${getRatingColorClasses(p.overall_rating)}`}>
                              {p.overall_rating}
                            </Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white truncate">{formatPlayerName(p.full_name || p.name)}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs border-gray-600/50 text-gray-400">
                                {p.positions}
                              </Badge>
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-bold">↑</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {bench.filter(p => p).length === 0 && reserves.filter(p => p).length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-gray-500 text-2xl">👥</span>
                  </div>
                  <p className="text-gray-400">No available players for substitution</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <DialogFooter className="pt-4 border-t border-gray-800">
            <Button variant="outline" onClick={() => setSwapOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
