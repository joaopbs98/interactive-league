"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, Ticket } from "lucide-react";
import { formatPlayerName } from "@/utils/playerUtils";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { Images } from "@/lib/assets";

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
  wage?: number | string;
  potential?: number | null;
  country_name?: string | null;
  origin_type?: string | null;
  is_youngster?: boolean;
}

// Team data interface
interface TeamData {
  id: string;
  name: string;
  squad: Player[];
  formation: string;
  starting_lineup: any[];
  bench: any[];
  reserves: any[];
  comp_index?: number | null;
}

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
    />
  );
};

// Helper function to get position group
const getPositionGroup = (positions: string): string => {
  if (!positions) return 'Unknown';
  
  const firstPosition = positions.split(',')[0].trim();
  
  if (['GK'].includes(firstPosition)) return 'Goalkeepers';
  if (['CB', 'LB', 'RB', 'WB', 'LWB', 'RWB'].includes(firstPosition)) return 'Defenders';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW'].includes(firstPosition)) return 'Midfielders';
  if (['ST', 'CF'].includes(firstPosition)) return 'Attackers';
  
  return 'Other';
};

// Helper function to sort players by rating (highest first)
const sortPlayersByRating = (players: Player[]): Player[] => {
  return [...players].sort((a, b) => b.overall_rating - a.overall_rating);
};

// Helper to get status label (origin + wonderkid when host-assigned)
// Wonderkid is ONLY shown when host has set is_youngster - not auto-derived from potential
const getStatusLabel = (p: Player): string => {
  const parts: string[] = [];
  const origin = p.origin_type;
  if (origin) {
    const labels: Record<string, string> = {
      drafted: "Drafted",
      packed: "Packed",
      signed: "Signed",
      trade: "Trade",
    };
    parts.push(labels[origin] || origin);
  }
  if (p.is_youngster) {
    parts.push("Wonderkid");
  }
  if (parts.length === 0) return "Player";
  return parts.join(" · ");
};

// Format wage for display
const formatWage = (wage?: number | string | null): string => {
  if (wage == null) return "—";
  const w = typeof wage === "string" ? parseInt(wage, 10) : wage;
  if (isNaN(w)) return "—";
  if (w >= 1_000_000) return `€${(w / 1_000_000).toFixed(1)}M`;
  if (w >= 1_000) return `€${(w / 1_000).toFixed(0)}K`;
  return `€${w}`;
};

type UpgradeTicket = { id: string; tier: string; used_on_player_id: string | null };
const TIER_BOOST: Record<string, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4 };

function SquadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedTeam, selectedLeagueId, setSelectedLeague } = useLeague();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeTickets, setUpgradeTickets] = useState<UpgradeTicket[]>([]);
  const [ticketDialog, setTicketDialog] = useState<{ ticket: UpgradeTicket } | null>(null);
  const [applyingTicket, setApplyingTicket] = useState(false);

  // Use leagueId from URL params first, then context (allows direct navigation to squad?league=xxx)
  const leagueId = searchParams.get('league') || searchParams.get('leagueId') || selectedLeagueId || selectedTeam?.league_id || selectedTeam?.leagues?.id;

  useEffect(() => {
    if (!leagueId) {
      setError('No league selected. Go to Saves to select a league.');
      setLoading(false);
      return;
    }

    fetchTeamData();
  }, [leagueId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);

      const userTeamResponse = await fetch(`/api/user/team/${leagueId}`);
      const data = await userTeamResponse.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      const team = data.team;
      if (!team) {
        setError('No team found for this league');
        setLoading(false);
        return;
      }

      setTeamData(team);

      // Fetch upgrade tickets
      const ticketsRes = await fetch(`/api/team/${team.id}/upgrade-tickets`);
      const ticketsJson = await ticketsRes.json();
      if (ticketsJson.success && ticketsJson.data?.available) {
        setUpgradeTickets(ticketsJson.data.available);
      } else {
        setUpgradeTickets([]);
      }

      // Update context so sidebar (balance, etc.) and other pages have the team
      if (setSelectedLeague && team.id) {
        setSelectedLeague(leagueId, { ...team, league_id: leagueId, leagues: data.league });
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching team data:', err);
      setError('Failed to fetch team data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-muted-foreground">Loading squad...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.push('/main/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-4">No Team Data</h1>
          <p className="text-muted-foreground mb-4">Could not load team information</p>
          <Button onClick={() => router.push('/main/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Group players by position
  const allPlayers = teamData.squad || [];
  const playersByPosition = allPlayers.reduce((acc, player) => {
    const group = getPositionGroup(player.positions);
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, Player[]>);

  // Sort players within each group by rating
  Object.keys(playersByPosition).forEach(group => {
    playersByPosition[group] = sortPlayersByRating(playersByPosition[group]);
  });

  const totalPlayers = allPlayers.length;
  const averageRating = totalPlayers > 0 
    ? Math.round(allPlayers.reduce((sum, p) => sum + p.overall_rating, 0) / totalPlayers)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{teamData.name} Squad</h1>
          <p className="text-muted-foreground mt-2">
            {totalPlayers} / 23 players (21-23 required at registration) • Avg: {averageRating}
          </p>
        </div>
        <Button 
          onClick={() => router.push('/main/dashboard/tactics')}
          variant="outline"
        >
          Manage Tactics
        </Button>
      </div>

      {/* Squad Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalPlayers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{averageRating}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Formation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{teamData.formation || 'Not Set'}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CompIndex</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{teamData.comp_index != null ? teamData.comp_index.toFixed(1) : "—"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Tickets */}
      {upgradeTickets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ticket className="h-4 w-4" /> Upgrade Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Apply a ticket to a player to boost their rating. Bronze +1, Silver +2, Gold +3, Platinum +4 OVR.
            </p>
            <div className="flex flex-wrap gap-2">
              {upgradeTickets.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setTicketDialog({ ticket: t })}
                >
                  {(t.tier ?? "bronze").charAt(0).toUpperCase() + (t.tier ?? "bronze").slice(1)} (+{TIER_BOOST[t.tier ?? "bronze"] ?? 1})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Use Upgrade Ticket Dialog */}
      <Dialog open={!!ticketDialog} onOpenChange={(open) => !open && setTicketDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Upgrade Ticket</DialogTitle>
          </DialogHeader>
          {ticketDialog && (
            <>
              <p className="text-sm text-muted-foreground">
                Select a player to receive +{TIER_BOOST[ticketDialog.ticket.tier ?? "bronze"] ?? 1} OVR.
              </p>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 py-2">
                  {sortPlayersByRating(teamData?.squad ?? []).map((p) => (
                    <div
                      key={p.player_id}
                      className="flex items-center justify-between p-2 rounded hover:bg-secondary cursor-pointer"
                      onClick={() => {
                        if (applyingTicket) return;
                        setApplyingTicket(true);
                        fetch("/api/upgrade-ticket", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            ticketId: ticketDialog.ticket.id,
                            playerId: p.player_id,
                          }),
                        })
                          .then((r) => r.json())
                          .then((json) => {
                            if (json.success) {
                              setTicketDialog(null);
                              fetchTeamData();
                            } else {
                              alert(json.error ?? "Failed to apply ticket");
                            }
                          })
                          .finally(() => setApplyingTicket(false));
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <PlayerImage src={p.image} alt={p.name} width={32} height={32} className="rounded" />
                        <div>
                          <p className="font-medium text-sm">{formatPlayerName(p.name)}</p>
                          <p className="text-xs text-muted-foreground">{p.positions} • {p.overall_rating} OVR</p>
                        </div>
                      </div>
                      <Badge className={getRatingColorClasses(p.overall_rating)}>{p.overall_rating}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTicketDialog(null)} disabled={applyingTicket}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Squad List */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Players</TabsTrigger>
          <TabsTrigger value="goalkeepers">Goalkeepers</TabsTrigger>
          <TabsTrigger value="defenders">Defenders</TabsTrigger>
          <TabsTrigger value="midfielders">Midfielders</TabsTrigger>
          <TabsTrigger value="attackers">Attackers</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <SquadList players={sortPlayersByRating(allPlayers)} allPlayers={allPlayers} teamId={teamData.id} leagueId={leagueId} startingLineup={toPlayerIds(teamData.starting_lineup)} bench={toPlayerIds(teamData.bench)} reserves={toPlayerIds(teamData.reserves)} />
        </TabsContent>

        <TabsContent value="goalkeepers" className="mt-6">
          <SquadList players={sortPlayersByRating(playersByPosition['Goalkeepers'] || [])} allPlayers={allPlayers} teamId={teamData.id} leagueId={leagueId} startingLineup={toPlayerIds(teamData.starting_lineup)} bench={toPlayerIds(teamData.bench)} reserves={toPlayerIds(teamData.reserves)} />
        </TabsContent>

        <TabsContent value="defenders" className="mt-6">
          <SquadList players={sortPlayersByRating(playersByPosition['Defenders'] || [])} allPlayers={allPlayers} teamId={teamData.id} leagueId={leagueId} startingLineup={toPlayerIds(teamData.starting_lineup)} bench={toPlayerIds(teamData.bench)} reserves={toPlayerIds(teamData.reserves)} />
        </TabsContent>

        <TabsContent value="midfielders" className="mt-6">
          <SquadList players={sortPlayersByRating(playersByPosition['Midfielders'] || [])} allPlayers={allPlayers} teamId={teamData.id} leagueId={leagueId} startingLineup={toPlayerIds(teamData.starting_lineup)} bench={toPlayerIds(teamData.bench)} reserves={toPlayerIds(teamData.reserves)} />
        </TabsContent>

        <TabsContent value="attackers" className="mt-6">
          <SquadList players={sortPlayersByRating(playersByPosition['Attackers'] || [])} allPlayers={allPlayers} teamId={teamData.id} leagueId={leagueId} startingLineup={toPlayerIds(teamData.starting_lineup)} bench={toPlayerIds(teamData.bench)} reserves={toPlayerIds(teamData.reserves)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SquadPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-muted-foreground">Loading squad...</p>
        </div>
      </div>
    }>
      <SquadPageContent />
    </Suspense>
  );
}

// Extract player IDs from lineup (handles both ID arrays and object arrays)
const toPlayerIds = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => (typeof item === "string" ? item : (item as { player_id?: string })?.player_id)).filter(Boolean) as string[];
};

// Get squad tier (S1=starting, S2=bench, S3=reserves, S4=other)
const getSquadTier = (playerId: string, starting: string[], bench: string[], reserves: string[]): string => {
  if (starting?.includes(playerId)) return "S1";
  if (bench?.includes(playerId)) return "S2";
  if (reserves?.includes(playerId)) return "S3";
  return "S4";
};

// Squad List - list view with wages, position, status, potential, nationality, picture, CompIndex
function SquadList({ players, allPlayers, teamId, leagueId, startingLineup, bench, reserves }: { 
  players: Player[]; 
  allPlayers: Player[]; 
  teamId: string; 
  leagueId: string | null;
  startingLineup?: string[];
  bench?: string[];
  reserves?: string[];
}) {
  const router = useRouter();
  const top14Ids = new Set(sortPlayersByRating(allPlayers).slice(0, 14).map((p) => p.player_id));

  if (players.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No players in this category.
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Squad</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Player</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pos</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">OVR</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Wage</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Potential</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nationality</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">CompIndex</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const playerUrl = `/main/dashboard/squad/player/${player.player_id}?teamId=${teamId}${leagueId ? `&league=${leagueId}` : ""}`;
                const ratingColorClasses = getRatingColorClasses(player.overall_rating);
                const isWonderkid = player.is_youngster;
                const inTop14 = top14Ids.has(player.player_id);
                const squadTier = getSquadTier(player.player_id, startingLineup || [], bench || [], reserves || []);

                return (
                  <tr
                    key={player.player_id}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(playerUrl)}
                  >
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs font-mono">{squadTier}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <PlayerImage
                            src={player.image}
                            alt={player.name}
                            width={40}
                            height={40}
                            className="rounded object-cover"
                          />
                          {player.isInjured && (
                            <Badge variant="destructive" className="absolute -top-1 -right-1 text-[10px] px-1">
                              INJ
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium truncate max-w-[140px]">{formatPlayerName(player.name)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{player.positions?.split(",")[0]?.trim() || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={ratingColorClasses}>{player.overall_rating}</Badge>
                    </td>
                    <td className="py-3 px-4 text-sm">{formatWage(player.wage)}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{getStatusLabel(player)}</td>
                    <td className="py-3 px-4 text-sm">
                      {isWonderkid && player.potential != null ? (
                        <span className="text-amber-500 font-medium">{player.potential}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{player.country_name || "—"}</td>
                    <td className="py-3 px-4">
                      {inTop14 ? (
                        <Badge variant="secondary" className="text-xs">Top 14</Badge>
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
  );
}
