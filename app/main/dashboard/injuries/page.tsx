"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueSettings } from "@/contexts/LeagueSettingsContext";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { AlertTriangle, Calendar, Clock, Plus, Trash2, UserX } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";

type Injury = {
  id: string;
  player_id: string;
  team_id: string;
  type: 'injury' | 'suspension';
  description: string;
  games_remaining: number;
  return_date: string | null;
  created_at: string;
};

type Player = {
  player_id: string;
  player_name: string; // Changed from 'name' to 'player_name'
  positions: string;
  rating: number; // Changed from 'overall_rating' to 'rating'
};

type Team = {
  id: string;
  name: string;
  acronym: string;
};

type InjuryWithPlayer = Injury & {
  player?: Player;
  team?: Team;
};

const InjuriesPage = () => {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('league');
  const { selectedTeam } = useLeague();
  const { isHost } = useLeagueSettings();
  const [injuries, setInjuries] = useState<InjuryWithPlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newInjury, setNewInjury] = useState({
    team_id: "",
    player_id: "",
    type: "injury" as 'injury' | 'suspension',
    description: "",
    games_remaining: 1,
    return_date: ""
  });
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (leagueId && selectedTeam?.id) {
      fetchTeams();
    }
  }, [leagueId, selectedTeam]);

  // Fetch injuries after teams are loaded
  useEffect(() => {
    if (teams.length > 0) {
      fetchInjuries();
    }
  }, [teams]);

  // Fetch players when team_id changes in the form
  useEffect(() => {
    if (newInjury.team_id && !isFetchingRef.current) {
      console.log('Team selected, fetching players for:', newInjury.team_id);
      fetchPlayersForTeam(newInjury.team_id);
    } else if (!newInjury.team_id) {
      console.log('No team selected, clearing players');
      setAvailablePlayers([]);
    }
  }, [newInjury.team_id]);

  const fetchInjuries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/league/injuries?leagueId=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        const injuriesData = data.data || [];
        
        // Get all players for this league
        const allPlayersResponse = await fetch(`/api/league/players?leagueId=${leagueId}&type=all`);
        let allPlayers: any[] = [];
        if (allPlayersResponse.ok) {
          const playersData = await allPlayersResponse.json();
          allPlayers = playersData.data || [];
        }
        
        // Map injuries to include player and team details
        const injuriesWithDetails = injuriesData.map((injury: Injury) => {
          // Find player details from the league players data
          const player = allPlayers.find((p: any) => p.player_id === injury.player_id);
          const playerDetails = player ? {
            player_id: player.player_id,
            player_name: player.player_name,
            positions: player.positions,
            rating: player.rating
          } : undefined;

          // Find team details from the teams state
          const team = teams.find(t => t.id === injury.team_id);
          
          return { ...injury, player: playerDetails, team };
        });
        
        setInjuries(injuriesWithDetails);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch injuries");
      }
    } catch (error) {
      console.error("Error fetching injuries:", error);
      setError("An error occurred while fetching injuries");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch(`/api/league/teams?leagueId=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        setTeams(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  const fetchPlayersForTeam = async (teamId: string) => {
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      console.log('Fetching players for team:', teamId);
      const response = await fetch(`/api/league/players?leagueId=${leagueId}&teamId=${teamId}`);
      if (response.ok) {
        const data = await response.json();
        const players = data.data || [];
        console.log('Found players:', players.length);
        console.log('Sample player data:', players[0]); // Log first player to see structure
        
        // Filter out players who are already injured/suspended
        const injuredPlayerIds = injuries
          .filter(injury => injury.team_id === teamId && injury.games_remaining > 0)
          .map(injury => injury.player_id);
        
        const available = players.filter((player: any) => !injuredPlayerIds.includes(player.player_id));
        console.log('Available players:', available.length);
        setAvailablePlayers(available);
      } else {
        console.error('Failed to fetch players for team');
        setAvailablePlayers([]);
      }
    } catch (error) {
      console.error("Error fetching players for team:", error);
      setAvailablePlayers([]);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const handleAddInjury = async () => {
    try {
      if (!newInjury.team_id || !newInjury.player_id) {
        setError("Please select both team and player");
        return;
      }

      // Check if player is already injured
      const isAlreadyInjured = injuries.some(
        injury => injury.player_id === newInjury.player_id && injury.games_remaining > 0
      );
      
      if (isAlreadyInjured) {
        setError("This player is already injured or suspended");
        return;
      }

      const response = await fetch('/api/league/injuries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newInjury,
          return_date: newInjury.return_date || null
        })
      });

      if (response.ok) {
        setIsAddDialogOpen(false);
        setNewInjury({
          team_id: "",
          player_id: "",
          type: "injury",
          description: "",
          games_remaining: 1,
          return_date: ""
        });
        await fetchInjuries();
        // Refresh available players if we have a team selected
        if (newInjury.team_id) {
          fetchPlayersForTeam(newInjury.team_id);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to add injury");
      }
    } catch (error) {
      console.error("Error adding injury:", error);
      setError("An error occurred while adding injury");
    }
  };

  const handleDeleteInjury = async (injuryId: string) => {
    try {
      const response = await fetch(`/api/league/injuries?id=${injuryId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchInjuries();
        // Refresh available players if we have a team selected
        if (newInjury.team_id) {
          fetchPlayersForTeam(newInjury.team_id);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete injury");
      }
    } catch (error) {
      console.error("Error deleting injury:", error);
      setError("An error occurred while deleting injury");
    }
  };

  const filteredInjuries = injuries.filter(injury => {
    if (activeTab !== "all" && injury.type !== activeTab) return false;
    if (severityFilter === "minor" && injury.games_remaining > 2) return false;
    if (severityFilter === "major" && injury.games_remaining <= 2) return false;
    return true;
  });

  const injuryStats = {
    total: injuries.length,
    injuries: injuries.filter(i => i.type === 'injury').length,
    suspensions: injuries.filter(i => i.type === 'suspension').length,
    totalGames: injuries.reduce((sum, injury) => sum + injury.games_remaining, 0)
  };

  const myTeamInjuries = injuries.filter(i => selectedTeam && i.team_id === selectedTeam.id);
  const positionsAffected = [...new Set(myTeamInjuries.map(i => i.player?.positions?.split(",")[0]?.trim()).filter(Boolean))];

  // Helper function to safely get player initials
  const getPlayerInitials = (playerName?: string) => {
    if (!playerName) return 'N/A';
    return playerName.replace(/-/g, ' ').split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Helper function to safely format player name
  const formatPlayerName = (playerName?: string) => {
    if (!playerName) return 'Unknown Player';
    return playerName.replace(/-/g, ' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading injuries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Injuries & Suspensions</h2>
        <div className="flex gap-2">
          {isHost && (
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (open && newInjury.team_id && !isFetchingRef.current) {
              // Refresh available players when dialog opens
              fetchPlayersForTeam(newInjury.team_id);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Injury/Suspension
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Injury or Suspension</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="team">Team</Label>
                  <Select value={newInjury.team_id} onValueChange={(value) => setNewInjury({...newInjury, team_id: value, player_id: ""})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} ({team.acronym})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="player">Player</Label>
                  <Select 
                    value={newInjury.player_id} 
                    onValueChange={(value) => setNewInjury({...newInjury, player_id: value})}
                    disabled={!newInjury.team_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={newInjury.team_id ? "Select a player" : "Select a team first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlayers.map((player) => (
                        <SelectItem key={player.player_id} value={player.player_id}>
                          {formatPlayerName(player.player_name)} ({player.positions}) - {player.rating}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={newInjury.type} onValueChange={(value: 'injury' | 'suspension') => setNewInjury({...newInjury, type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="injury">Injury</SelectItem>
                      <SelectItem value="suspension">Suspension</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the injury or suspension reason..."
                    value={newInjury.description}
                    onChange={(e) => setNewInjury({...newInjury, description: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="games">Games to Miss</Label>
                  <Input
                    id="games"
                    type="number"
                    min={1}
                    value={Number.isNaN(newInjury.games_remaining) ? "" : newInjury.games_remaining}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      setNewInjury({ ...newInjury, games_remaining: Number.isNaN(parsed) ? 1 : parsed });
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="return_date">Return Date (Optional)</Label>
                  <Input
                    id="return_date"
                    type="date"
                    value={newInjury.return_date}
                    onChange={(e) => setNewInjury({...newInjury, return_date: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddInjury}>
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Total Out</span>
            </div>
            <div className="text-2xl font-bold">{injuryStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Injuries</span>
            </div>
            <div className="text-2xl font-bold">{injuryStats.injuries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Suspensions</span>
            </div>
            <div className="text-2xl font-bold">{injuryStats.suspensions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Games</span>
            </div>
            <div className="text-2xl font-bold">{injuryStats.totalGames}</div>
          </CardContent>
        </Card>
      </div>

      {selectedTeam && myTeamInjuries.length > 0 && (
        <Card className="bg-amber-900/20 border-amber-800/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium">
              Impact on your squad: {myTeamInjuries.length} player{myTeamInjuries.length !== 1 ? "s" : ""} out
              {positionsAffected.length > 0 && (
                <span className="text-muted-foreground"> — positions affected: {positionsAffected.join(", ")}</span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="minor">Minor (1–2 games)</SelectItem>
            <SelectItem value="major">Major (3+ games)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            All ({injuryStats.total})
          </TabsTrigger>
          <TabsTrigger value="injury">
            Injuries ({injuryStats.injuries})
          </TabsTrigger>
          <TabsTrigger value="suspension">
            Suspensions ({injuryStats.suspensions})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === 'all' && 'All Injuries & Suspensions'}
                {activeTab === 'injury' && 'Injuries'}
                {activeTab === 'suspension' && 'Suspensions'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInjuries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No injuries or suspensions</p>
                  <p className="text-sm mt-1">All players are available for selection.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInjuries.map((injury) => (
                    <div key={injury.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {getPlayerInitials(injury.player?.player_name)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {formatPlayerName(injury.player?.player_name) || `Player ${injury.player_id}`}
                            </h3>
                            {injury.player && (
                              <Badge className={getRatingColorClasses(injury.player.rating)}>
                                {injury.player.rating}
                              </Badge>
                            )}
                            <Badge variant={injury.type === 'injury' ? 'destructive' : 'secondary'}>
                              {injury.type === 'injury' ? 'Injured' : 'Suspended'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {injury.player && (
                              <span>{injury.player.positions}</span>
                            )}
                            {injury.team && (
                              <>
                                <span>•</span>
                                <span>{injury.team.name} ({injury.team.acronym})</span>
                              </>
                            )}
                          </div>
                          {injury.description && (
                            <p className="text-sm text-muted-foreground mt-1">{injury.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{injury.games_remaining} games</span>
                          </div>
                          {injury.return_date && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>Returns: {new Date(injury.return_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        {isHost && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteInjury(injury.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InjuriesPage;
