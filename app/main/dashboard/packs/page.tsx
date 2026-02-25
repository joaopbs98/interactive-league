"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueSettings } from "@/contexts/LeagueSettingsContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { PackRevealCard } from "@/components/PackRevealCard";

type Pack = {
  id: number;
  name: string;
  price: number;
  player_count: number;
  season: number;
  pack_type: string;
  description: string;
};

type PackResult = {
  pack: any;
  players: any[];
  remainingBalance?: number;
  newBudget?: number;
  currentSeason?: number;
};

const GRADIENTS = [
  "from-green-800 via-transparent to-transparent",
  "from-blue-800 via-transparent to-transparent",
  "from-yellow-800 via-transparent to-transparent",
];

export default function PackStorePage() {
  const [packHistory, setPackHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [packResult, setPackResult] = useState<PackResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [packs, setPacks] = useState<Pack[]>([]);
  
  const { selectedTeam } = useLeague();
  const { settings } = useLeagueSettings();
  const { triggerRefresh, refreshKey } = useRefresh();

  // Get current season when team changes
  useEffect(() => {
    if (!selectedTeam?.id) return;
    
    // Get season from team data instead of making an API call
    if (selectedTeam.leagues?.season) {
      setCurrentSeason(selectedTeam.leagues.season);
    } else {
      // Fallback to season 1 if no season info available
      setCurrentSeason(1);
    }
  }, [selectedTeam?.id, selectedTeam?.leagues?.season]);

  const getSeasonPacks = () => packs.filter(pack => pack.season === currentSeason);

  // Fetch pack history (league-wide) and team data when team changes
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedTeam?.id) return;
      const leagueId = selectedTeam.league_id || selectedTeam.leagues?.id;

      try {
        const historyResponse = await fetch(`/api/packs?teamId=${selectedTeam.id}&leagueId=${leagueId || ''}`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setPackHistory(historyData.packHistory || []);
        }

        const balanceResponse = await fetch(`/api/balance?teamId=${selectedTeam.id}`);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setAvailableBalance(balanceData.data?.availableBalance || 0);
        }

        const packsResponse = await fetch('/api/debug/packs');
        if (packsResponse.ok) {
          const packsData = await packsResponse.json();
          setPacks(packsData.packs || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [selectedTeam?.id, selectedTeam?.league_id, selectedTeam?.leagues?.id, refreshKey]);

  // Show error if no team is selected
  if (!selectedTeam) {
    return (
      <div className="p-8 space-y-8 bg-background text-foreground">
        <Toaster position="top-center" richColors />
        <h1 className="text-2xl font-bold">Pack Store</h1>
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">
            Please select a team first to access the pack store.
          </p>
          <Button onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const handleOpenPack = async (pack: Pack) => {
    if (availableBalance < pack.price) {
      toast.error(`Insufficient balance. You need €${pack.price.toLocaleString()}`);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/packs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packId: pack.id,
          teamId: selectedTeam.id
        })
      });

      if (response.ok) {
        const result = await response.json();
        setPackResult(result);
        setShowResultModal(true);
        toast.success(`Pack opened! You got ${pack.player_count} players!`);
        triggerRefresh();

        const leagueId = selectedTeam.league_id || selectedTeam.leagues?.id;
        const [historyResponse, balanceResponse] = await Promise.all([
          fetch(`/api/packs?teamId=${selectedTeam.id}&leagueId=${leagueId || ''}`),
          fetch(`/api/balance?teamId=${selectedTeam.id}`)
        ]);
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setPackHistory(historyData.packHistory || []);
        }
        
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setAvailableBalance(balanceData.data?.availableBalance || 0);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to open pack");
      }
    } catch (error: any) {
      toast.error("An error occurred while opening the pack");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-background text-foreground">
      <Toaster position="top-center" richColors />
      
      {/* Transfer Window Status */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pack Store</h1>
        <div className="flex items-center gap-4">
          <span className={`text-sm font-medium ${settings.transferWindowOpen ? 'text-green-500' : 'text-red-500'}`}>
            Transfer Window: {settings.transferWindowOpen ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
      </div>
      
      {/* Hero / Team Info */}
      <div className="bg-gradient-to-r from-card to-card/80 p-6 rounded-xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Season {currentSeason} · Balance: <span className="font-semibold text-green-500">€{availableBalance.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={settings.transferWindowOpen ? "default" : "secondary"} className={settings.transferWindowOpen ? "bg-green-600" : ""}>
              {settings.transferWindowOpen ? "Transfer Window OPEN" : "Transfer Window CLOSED"}
            </Badge>
          </div>
        </div>
      </div>

      {settings.transferWindowOpen && (
        <p className="text-sm text-muted-foreground">
          During transfer window you can hold more than 23 players; trim to 21–23 before registration.
        </p>
      )}

      {!settings.transferWindowOpen && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
          <p className="text-yellow-500 font-medium">
            ⚠️ Transfer Window is CLOSED. You can only view packs and manage your squad.
          </p>
        </div>
      )}
      
      {/* Packs Display */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Available Packs for Season {currentSeason}</h2>
        {getSeasonPacks().length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No packs available for Season {currentSeason}</p>
            <p className="text-sm text-muted-foreground mt-2">Packs will be available once the season progresses</p>
          </div>
        ) : (
          <div className="flex justify-center gap-10">
            {getSeasonPacks().map((pack, idx) => (
              <Card
                key={pack.id}
                className="relative overflow-hidden rounded-2xl h-[600px] w-96"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${GRADIENTS[idx % GRADIENTS.length]} opacity-80`}
                />

                <CardContent className="relative flex flex-col justify-end h-full p-6">
                  <h2 className="text-lg font-semibold text-white">{pack.name}</h2>
                  <p className="text-green-400 font-bold">€{pack.price.toLocaleString()}</p>
                  <p className="text-sm text-white/80 mb-2">{pack.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-white">
                      Player Count: {pack.player_count}
                    </span>
                    <span className="text-sm text-white">{pack.pack_type}</span>
                    <Button 
                      size="sm" 
                      onClick={() => handleOpenPack(pack)}
                      disabled={loading || availableBalance < pack.price || !settings.transferWindowOpen}
                    >
                      {loading ? "Opening..." : !settings.transferWindowOpen ? "Transfer Window Closed" : "Open"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Separator />
        <h2 className="text-lg font-semibold">Pack History</h2>
        <p className="text-sm text-muted-foreground">
          All packs opened from all clubs in this league
        </p>
        <ScrollArea className="rounded-lg border border-border min-h-[280px]">
          <div className="p-4 space-y-4">
            {packHistory.length > 0 ? (
              packHistory.map((purchase: any, index: number) => {
                const players = (purchase.players_obtained || []).filter(
                  (p: any) => !p.player_id?.startsWith?.('placeholder_')
                );
                return (
                  <div
                    key={purchase.id || index}
                    className="bg-card p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">{purchase.pack?.name || 'Unknown Pack'}</p>
                        <p className="text-sm text-muted-foreground">
                          {purchase.team_name} · {new Date(purchase.purchased_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {players.map((p: any, i: number) => (
                        <span
                          key={p.player_id || i}
                          className="inline-flex items-center gap-1.5 text-sm bg-muted/60 px-2.5 py-1 rounded-md"
                        >
                          <span className="font-medium truncate max-w-[120px]">
                            {p.name || p.full_name || 'Unknown'}
                          </span>
                          <span className="text-muted-foreground">
                            {p.overall_rating ?? p.rating} · {p.positions || p.position || '-'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No pack purchases yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Pack Opening Result Modal - clean, opaque, collectible cards */}
      <Dialog open={showResultModal} onOpenChange={(open) => { setShowResultModal(open); if (!open) triggerRefresh(); }}>
        <DialogContent
          overlayClassName="bg-black/85 backdrop-blur-sm"
          className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background border border-border shadow-2xl"
        >
          {packResult ? (
            <div className="space-y-6">
              {/* Minimal header */}
              <div className="text-center space-y-1">
                <h2 className="text-xl font-semibold">Pack Opened</h2>
                <p className="text-sm text-muted-foreground">
                  {packResult.pack?.name || "Unknown Pack"}
                </p>
              </div>

              {/* Collectible cards */}
              <div className="grid grid-cols-3 gap-4">
                {(packResult.players || []).filter((p: any) => !p.player_id?.startsWith?.("placeholder_")).map((player: any, index: number) => (
                  <PackRevealCard
                    key={player.player_id || index}
                    player={{
                      player_id: player.player_id,
                      name: player.name,
                      full_name: player.full_name,
                      positions: player.positions || "",
                      overall_rating: player.overall_rating ?? 0,
                      image: player.image,
                      country_name: player.country_name,
                    }}
                    revealDelay={index * 100}
                  />
                ))}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Manage players in the Squad tab
              </p>

              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    setShowResultModal(false);
                    triggerRefresh();
                  }}
                  size="lg"
                  className="min-w-[140px]"
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading pack results...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
