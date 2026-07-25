"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { Ticket, ArrowUpDown, Filter, Users, Shield, Sparkles } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPlayerName } from "@/utils/playerUtils";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { Images } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { toast, Toaster } from "sonner";
import { eligibleTicketPlayers, ticketRule } from "@/lib/upgradeTicketRules.mjs";

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

type UpgradeTicket = { id: string; tier: string; used_on_player_id: string | null; eligible_player_ids?: string[] };
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
  const [sortBy, setSortBy] = useState<"rating" | "wage" | "position">("rating");
  const [filterInjured, setFilterInjured] = useState(false);

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
      <div className="container mx-auto p-6">
        <PageSkeleton variant="page" rows={8} />
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

  const rawSquad = teamData.squad || [];
  const filteredPlayers = filterInjured
    ? rawSquad.filter((p) => p.isInjured)
    : rawSquad;
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (sortBy === "rating") return (b.overall_rating ?? 0) - (a.overall_rating ?? 0);
    if (sortBy === "wage") return ((b.wage as number) ?? 0) - ((a.wage as number) ?? 0);
    if (sortBy === "position") return (a.positions || "").localeCompare(b.positions || "");
    return 0;
  });
  const allPlayers = sortedPlayers;

  const totalWage = rawSquad.reduce((s, p) => s + (typeof p.wage === "number" ? p.wage : parseInt(String(p.wage || 0), 10) || 0), 0);

  // Group players by position
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

  const squadFillClasses =
    totalPlayers < 21
      ? { text: "text-status-negative", bg: "bg-status-negative" }
      : totalPlayers > 23
        ? { text: "text-status-warning", bg: "bg-status-warning" }
        : { text: "text-status-positive", bg: "bg-status-positive" };
  const squadFillPct = Math.min(100, Math.round((totalPlayers / 23) * 100));

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />

      {/* Header */}
      <PageHeader
        eyebrow="Team Management"
        title={`${teamData.name} Squad`}
        subtitle="Manage your roster, monitor squad strength, and apply upgrade tickets"
        stats={[
          { label: "Size", value: `${totalPlayers}/23`, emphasis: true },
          { label: "Avg", value: averageRating },
          { label: "Formation", value: teamData.formation || "—" },
          { label: "CompIdx", value: teamData.comp_index != null ? teamData.comp_index.toFixed(1) : "—" },
          { label: "Wage", value: formatWage(totalWage) },
        ]}
        actions={
          <Button onClick={() => router.push('/main/dashboard/tactics')}>
            <Shield className="h-4 w-4 mr-2" />
            Manage Tactics
          </Button>
        }
      />

      {/* Registration progress — a thin attached strip, not a separate panel repeating the "Size" stat above */}
      <div className="-mt-3">
        <div className="h-1 w-full rounded-full bg-surface-3 overflow-hidden">
          <div
            className={`h-full rounded-full ${squadFillClasses.bg} transition-all duration-300`}
            style={{ width: `${squadFillPct}%` }}
          />
        </div>
        {totalPlayers < 21 && (
          <p className="text-xs text-status-negative mt-1">
            {21 - totalPlayers} more player{21 - totalPlayers !== 1 ? "s" : ""} needed to register (21–23 required)
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "rating" | "wage" | "position")}>
            <SelectTrigger className="w-40">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="wage">Wage</SelectItem>
              <SelectItem value="position">Position</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors duration-150">
            <Checkbox checked={filterInjured} onCheckedChange={(c) => setFilterInjured(!!c)} />
            <Filter className="h-4 w-4" />
            Injured only
          </label>
        </div>
      </div>

      {/* Upgrade Tickets — an actionable resource, styled like "Needs Attention" rather than a passive info card */}
      {upgradeTickets.length > 0 && (
        <div className="relative overflow-hidden rounded-lg border border-accent/30 bg-surface p-4 glow-blue">
          <p className="relative text-sm font-semibold flex items-center gap-2 mb-1">
            <Ticket className="h-4 w-4 text-accent" /> {upgradeTickets.length} Upgrade Ticket{upgradeTickets.length !== 1 ? "s" : ""} Available
          </p>
          <p className="relative text-xs text-muted-foreground mb-3">
            Use one on a player you ended last season with and still own. Bronze +1, Silver +2, Gold +3, Platinum +4 OVR. Tickets can also be sold in the Auction House.
          </p>
          <div className="relative flex flex-wrap gap-2">
            {upgradeTickets.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                className="bg-surface-2 hover:bg-surface-3 hover:border-accent/50"
                onClick={() => setTicketDialog({ ticket: t })}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-accent" />
                {(t.tier ?? "bronze").charAt(0).toUpperCase() + (t.tier ?? "bronze").slice(1)} (+{TIER_BOOST[t.tier ?? "bronze"] ?? 1})
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Use Upgrade Ticket Dialog */}
      <Dialog open={!!ticketDialog} onOpenChange={(open) => !open && setTicketDialog(null)}>
        <DialogContent className="bg-surface border-border">
          <DialogHeader>
            <DialogTitle>Apply Upgrade Ticket</DialogTitle>
          </DialogHeader>
          {ticketDialog && (
            <>
              <p className="text-sm text-muted-foreground">
                {ticketRule(ticketDialog.ticket.tier).description}
              </p>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 py-2">
                  {eligibleTicketPlayers(sortPlayersByRating(teamData?.squad ?? []), ticketDialog.ticket.eligible_player_ids).map((p: Player) => (
                    <button
                      type="button"
                      key={p.player_id}
                      className="flex w-full items-center justify-between p-2 rounded-lg hover:bg-surface-3 cursor-pointer transition-colors duration-150 text-left"
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
                              toast.error(json.error ?? "Failed to apply ticket");
                            }
                          })
                          .finally(() => setApplyingTicket(false));
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <PlayerImage src={p.image} alt={p.name} width={32} height={32} className="rounded-lg ring-1 ring-border object-cover" />
                        <div>
                          <p className="font-medium text-sm">{formatPlayerName(p.name)}</p>
                          <p className="text-xs text-muted-foreground">{p.positions} • {p.overall_rating} OVR</p>
                        </div>
                      </div>
                      <Badge className={getRatingColorClasses(p.overall_rating)}>{p.overall_rating}</Badge>
                    </button>
                  ))}
                  {eligibleTicketPlayers(teamData?.squad ?? [], ticketDialog.ticket.eligible_player_ids).length === 0 && (
                    <p className="p-4 text-center text-sm text-muted-foreground">No eligible players remain from your previous-season roster.</p>
                  )}
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
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

// Squad role: readable label + color, not the cryptic S1-S4 codes this used to show
const SQUAD_ROLE_STYLES: Record<string, string> = {
  Starting: "bg-accent-muted text-accent",
  Bench: "bg-surface-3 text-foreground",
  Reserve: "bg-surface-3 text-muted-foreground",
  Unregistered: "bg-status-negative/10 text-status-negative",
};
const getSquadRole = (playerId: string, starting: string[], bench: string[], reserves: string[]): string => {
  if (starting?.includes(playerId)) return "Starting";
  if (bench?.includes(playerId)) return "Bench";
  if (reserves?.includes(playerId)) return "Reserve";
  return "Unregistered";
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
    const isAllEmpty = allPlayers.length === 0;
    return isAllEmpty ? (
      <EmptyState
        icon={Users}
        title="No players in your squad"
        description="Build your squad through the Draft, Packs, or Free Agents. You need 21–23 players for registration."
        action={{ label: "Go to Draft", href: "/main/dashboard/draft" }}
      />
    ) : (
      <div className="text-center py-12 text-muted-foreground">
        No players in this category.
      </div>
    );
  }

  return (
    <Card className="bg-surface border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Player</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Pos</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">OVR</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Role</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Wage</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Potential</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const playerUrl = `/main/dashboard/players/${player.player_id}${leagueId ? `?league=${leagueId}` : ""}`;
                const ratingColorClasses = getRatingColorClasses(player.overall_rating);
                const isWonderkid = player.is_youngster;
                const inTop14 = top14Ids.has(player.player_id);
                const squadRole = getSquadRole(player.player_id, startingLineup || [], bench || [], reserves || []);

                return (
                  <tr
                    key={player.player_id}
                    className="border-b border-border/50 hover:bg-surface-3/60 cursor-pointer transition-colors duration-150"
                    onClick={() => router.push(playerUrl)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <PlayerImage
                            src={player.image}
                            alt={player.name}
                            width={40}
                            height={40}
                            className={cn(
                              "rounded-lg object-cover ring-1",
                              inTop14 ? "ring-accent" : "ring-border"
                            )}
                          />
                          {player.isInjured && (
                            <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 text-[10px] px-1 leading-none">
                              INJ
                            </Badge>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium truncate block max-w-[160px]">{formatPlayerName(player.name)}</span>
                          {player.country_name && (
                            <span className="text-xs text-muted-foreground truncate block max-w-[160px]">{player.country_name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{player.positions?.split(",")[0]?.trim() || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={ratingColorClasses} title={inTop14 ? "Top 14 by rating" : undefined}>
                        {player.overall_rating}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SQUAD_ROLE_STYLES[squadRole]}`}>
                        {squadRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm tabular-nums">{formatWage(player.wage)}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{getStatusLabel(player)}</td>
                    <td className="py-3 px-4 text-sm">
                      {isWonderkid && player.potential != null ? (
                        <span className="text-status-warning font-medium tabular-nums">{player.potential}</span>
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
