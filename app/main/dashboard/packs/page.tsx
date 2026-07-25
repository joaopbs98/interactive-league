"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueSettings } from "@/contexts/LeagueSettingsContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { PackTierCard } from "@/components/packs/PackTierCard";
import { PackOpeningExperience } from "@/components/packs/PackOpeningExperience";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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

export default function PackStorePage() {
  const [packHistory, setPackHistory] = useState([]);
  const [openingPackId, setOpeningPackId] = useState<number | null>(null);
  const [packResult, setPackResult] = useState<PackResult | null>(null);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [oddsCache, setOddsCache] = useState<Record<number, { rating: number; pct: string }[]>>({});

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

  const fetchPackOdds = async (packId: number) => {
    if (oddsCache[packId]) return;
    try {
      const res = await fetch(`/api/packs/odds?packId=${packId}`);
      const data = await res.json();
      if (data.success && data.odds) {
        setOddsCache((prev) => ({
          ...prev,
          [packId]: data.odds.map((o: { rating: number; pct: string }) => ({ rating: o.rating, pct: o.pct })),
        }));
      }
    } catch {
      // ignore
    }
  };

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
      <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
        <Toaster position="top-center" richColors />
        <Breadcrumbs />
        <PageHeader eyebrow="Transfer Hub" title="Pack Store" />
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

    setOpeningPackId(pack.id);
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

        triggerRefresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to open pack");
      }
    } catch (error: any) {
      toast.error("An error occurred while opening the pack");
    } finally {
      setOpeningPackId(null);
    }
  };

  const handleCloseOpeningExperience = () => {
    setPackResult(null);
    triggerRefresh();
  };

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader eyebrow="Transfer Hub" title="Pack Store" />

      {/* Hero / Team Info */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Season {currentSeason} · Balance: <span className="font-semibold text-status-positive">€{availableBalance.toLocaleString()}</span>
            </p>
          </div>
          <Badge className={settings.transferWindowOpen ? "bg-status-positive/15 text-status-positive border border-status-positive/30" : "bg-surface-3 text-muted-foreground border border-border-strong"}>
            {settings.transferWindowOpen ? "Transfer Window OPEN" : "Transfer Window CLOSED"}
          </Badge>
        </div>
      </div>

      {settings.transferWindowOpen && (
        <p className="text-sm text-muted-foreground">
          During transfer window you can hold more than 23 players; trim to 21–23 before registration.
        </p>
      )}

      {!settings.transferWindowOpen && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-4 text-center">
          <p className="text-status-warning font-medium">
            Transfer Window is closed. You can only view packs and manage your squad.
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
          <div className="flex flex-wrap justify-center gap-10">
            {getSeasonPacks().map((pack) => {
              const disabled =
                openingPackId !== null || availableBalance < pack.price || !settings.transferWindowOpen;
              const disabledLabel = !settings.transferWindowOpen
                ? "Transfer Window Closed"
                : availableBalance < pack.price
                  ? "Insufficient Balance"
                  : undefined;
              return (
                <PackTierCard
                  key={pack.id}
                  pack={pack}
                  odds={oddsCache[pack.id]}
                  onFetchOdds={() => fetchPackOdds(pack.id)}
                  onOpen={() => handleOpenPack(pack)}
                  disabled={disabled}
                  disabledLabel={disabledLabel}
                  charging={openingPackId === pack.id}
                />
              );
            })}
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
          <div className="p-4 space-y-3">
            {packHistory.length > 0 ? (
              packHistory.map((purchase: any, index: number) => {
                const players = (purchase.players_obtained || []).filter(
                  (p: any) => !p.player_id?.startsWith?.('placeholder_')
                );
                return (
                  <div
                    key={purchase.id || index}
                    className="bg-surface-2 p-4 rounded-lg border border-border"
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
                      {players.map((p: any, i: number) => {
                        const rating = p.overall_rating ?? p.rating ?? 0;
                        return (
                          <span
                            key={p.player_id || i}
                            className="inline-flex items-center gap-2 text-sm bg-surface-3 border border-border pl-1 pr-2.5 py-1 rounded-full"
                          >
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${getRatingColorClasses(rating)}`}>
                              {rating}
                            </span>
                            <span className="font-medium truncate max-w-[120px]">
                              {p.name || p.full_name || 'Unknown'}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {p.positions || p.position || '-'}
                            </span>
                          </span>
                        );
                      })}
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

      {packResult && (
        <PackOpeningExperience
          packResult={packResult}
          teamId={selectedTeam.id}
          leagueId={String(selectedTeam.league_id || selectedTeam.leagues?.id || "")}
          onClose={handleCloseOpeningExperience}
        />
      )}
    </div>
  );
}
