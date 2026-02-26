"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, AlertTriangle } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { getRatingColors } from "@/utils/ratingColors";

type DraftPick = {
  id: string;
  pick_number: number;
  is_used: boolean;
  player_id: string | null;
  current_owner_team_id: string | null;
  team_id: string | null;
  bonus?: { type: string; value?: number; tier?: string } | null;
};

type PoolPlayer = {
  id: string;
  player_id: string;
  player_name: string;
  full_name: string | null;
  positions: string;
  rating: number;
  image: string | null;
};

type DraftData = {
  league: { season: number; status: string; draftActive: boolean };
  picks: DraftPick[];
  pool: PoolPlayer[];
  currentPick: DraftPick | null;
  isUserTurn: boolean;
  userTeamId: string | null;
  isHost?: boolean;
};

type TeamMap = Record<string, string>;

export default function DraftPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [data, setData] = useState<DraftData | null>(null);
  const [teams, setTeams] = useState<TeamMap>({});
  const [loading, setLoading] = useState(true);
  const [dialogPlayer, setDialogPlayer] = useState<PoolPlayer | null>(null);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bonusLoading, setBonusLoading] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLeagueId) fetchDraft();
  }, [selectedLeagueId]);

  const fetchDraft = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/draft?leagueId=${selectedLeagueId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        if (json.data.picks?.length) {
          const ids = [...new Set(json.data.picks.map((p: DraftPick) => p.current_owner_team_id ?? p.team_id).filter(Boolean))];
          const teamRes = await fetch(`/api/league/teams?leagueId=${selectedLeagueId}`);
          const teamJson = await teamRes.json();
          const teamList = teamJson.data || [];
          const map: TeamMap = {};
          teamList.forEach((t: { id: string; name: string }) => { map[t.id] = t.name; });
          setTeams(map);
        }
      } else {
        setData(null);
      }
    } catch (err) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePick = async () => {
    if (!data?.currentPick) return;
    const isClaim = data.currentPick?.bonus?.type === "merch_pct" || data.currentPick?.bonus?.type === "upgrade_ticket";
    if (!isClaim && !dialogPlayer) return;
    setPicking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftPickId: data.currentPick.id,
          playerId: dialogPlayer?.player_id,
          claimOnly: isClaim,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          type: "success",
          text: isClaim
            ? `Claimed ${data.currentPick.bonus?.type === "merch_pct" ? "Merch %" : "Upgrade Ticket"}!`
            : `Drafted ${json.data?.player_name || dialogPlayer?.player_name}!`,
        });
        setDialogPlayer(null);
        await fetchDraft();
      } else {
        setMessage({ type: "error", text: json.error || "Failed to draft" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setPicking(false);
    }
  };

  const handleClaimOnly = async () => {
    setDialogPlayer(null);
    await handlePick();
  };

  const setPickBonus = async (pickId: string, bonus: { type: string; value?: number; tier?: string } | null) => {
    setBonusLoading(pickId);
    setMessage(null);
    try {
      const res = await fetch("/api/league/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_draft_pick_bonus",
          leagueId: selectedLeagueId,
          draftPickId: pickId,
          bonus: bonus || { type: "player" },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDraft();
      } else {
        setMessage({ type: "error", text: json.error || "Failed to set bonus" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBonusLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={8} />
      </div>
    );
  }

  if (!selectedLeagueId) {
    return (
      <div className="p-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            Select a league to view the draft.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.picks?.length && !data?.league?.draftActive) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold">Draft</h1>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No draft in progress.</p>
            <p className="text-sm">The host must start the draft from Host Controls. Draft is available from Season 2 onward, during OFFSEASON.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPick = data.currentPick;
  const nextPick = data.picks?.find((p) => !p.is_used && p.id !== currentPick?.id);
  const ownerId = (p: DraftPick) => p.current_owner_team_id ?? p.team_id ?? "";
  const currentTeamName = currentPick ? teams[ownerId(currentPick)] || "—" : "—";
  const nextTeamName = nextPick ? teams[ownerId(nextPick)] || "—" : "—";
  const isPlayerChoice80 = currentPick?.bonus?.type === "player_choice_80";
  const isClaimOnly = currentPick?.bonus?.type === "merch_pct" || currentPick?.bonus?.type === "upgrade_ticket";
  const filteredPool = isPlayerChoice80
    ? (data.pool || []).filter((p) => p.rating <= 80)
    : (data.pool || []);

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Season {data.league?.season || "?"} Draft</h1>

      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === "success"
              ? "bg-green-900/30 text-green-300 border border-green-800"
              : "bg-red-900/30 text-red-300 border border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="space-y-1 pt-4">
            <p className="text-sm text-muted-foreground">Current Pick</p>
            <h2 className="text-lg font-semibold">{currentTeamName}</h2>
            <p className="text-xs text-muted-foreground">
              {data.isUserTurn ? "Your turn!" : "Waiting..."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-4">
            <p className="text-sm text-muted-foreground">Next Pick</p>
            <h2 className="text-lg font-semibold">{nextTeamName || "—"}</h2>
            <p className="text-xs text-muted-foreground">
              Pick #{nextPick?.pick_number ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-4">
            <p className="text-sm text-muted-foreground">Available Players</p>
            <h2 className="text-lg font-semibold">{filteredPool.length}</h2>
            <p className="text-xs text-muted-foreground">
              {isPlayerChoice80 ? "OVR ≤80 (Player of choice)" : "In pool"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-0">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">Draft Order</h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {(data.picks || []).map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      p.id === currentPick?.id ? "bg-accent/20" : p.is_used ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar>
                        <AvatarFallback>{(teams[ownerId(p)] || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{teams[ownerId(p)] || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Pick #{p.pick_number}
                          {p.bonus?.type === "player_choice_80" && " • OVR≤80"}
                          {p.bonus?.type === "merch_pct" && ` • Merch ${p.bonus?.value ?? ""}%`}
                          {p.bonus?.type === "upgrade_ticket" && ` • ${(p.bonus?.tier ?? "Bronze").charAt(0).toUpperCase() + (p.bonus?.tier ?? "bronze").slice(1)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {data.isHost && !p.is_used && (
                        <div className="flex items-center gap-1">
                          <Select
                            value={p.bonus?.type ?? "player"}
                            onValueChange={(v) => {
                              const bonus = v === "player" ? { type: "player" }
                                : v === "player_choice_80" ? { type: "player_choice_80" }
                                : v === "merch_pct" ? { type: "merch_pct", value: 10 }
                                : v === "upgrade_ticket" ? { type: "upgrade_ticket", tier: p.bonus?.tier ?? "bronze" }
                                : { type: "player" };
                              setPickBonus(p.id, bonus);
                            }}
                            disabled={bonusLoading === p.id}
                          >
                            <SelectTrigger className="w-[100px] h-8">
                              <SelectValue placeholder="Bonus" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="player">Player</SelectItem>
                              <SelectItem value="player_choice_80">OVR≤80</SelectItem>
                              <SelectItem value="merch_pct">Merch %</SelectItem>
                              <SelectItem value="upgrade_ticket">Upgrade</SelectItem>
                            </SelectContent>
                          </Select>
                          {(p.bonus?.type ?? "player") === "merch_pct" && (
                            <Select
                              value={String(p.bonus?.value ?? 10)}
                              onValueChange={(v) => setPickBonus(p.id, { type: "merch_pct", value: Number(v) })}
                              disabled={bonusLoading === p.id}
                            >
                              <SelectTrigger className="w-[70px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1%</SelectItem>
                                <SelectItem value="2.5">2.5%</SelectItem>
                                <SelectItem value="5">5%</SelectItem>
                                <SelectItem value="10">10%</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {(p.bonus?.type ?? "player") === "upgrade_ticket" && (
                            <Select
                              value={p.bonus?.tier ?? "bronze"}
                              onValueChange={(v) => setPickBonus(p.id, { type: "upgrade_ticket", tier: v })}
                              disabled={bonusLoading === p.id}
                            >
                              <SelectTrigger className="w-[90px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bronze">Bronze (+1)</SelectItem>
                                <SelectItem value="silver">Silver (+2)</SelectItem>
                                <SelectItem value="gold">Gold (+3)</SelectItem>
                                <SelectItem value="platinum">Platinum (+4)</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                      {p.is_used && p.player_id ? (
                        <p className="font-medium text-sm">Picked</p>
                      ) : p.id === currentPick?.id ? (
                        <Badge className="bg-blue-600">Current</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">
              {isClaimOnly && data.isUserTurn
                ? "Claim your perk"
                : "Available Players"}
            </h3>
            {isClaimOnly && data.isUserTurn ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-4">
                  This pick grants {currentPick?.bonus?.type === "merch_pct"
                    ? `Merchandise ${currentPick.bonus?.value ?? ""}%`
                    : `Upgrade Ticket (${(currentPick?.bonus?.tier ?? "Bronze").charAt(0).toUpperCase() + (currentPick?.bonus?.tier ?? "bronze").slice(1)}: +${currentPick?.bonus?.tier === "platinum" ? 4 : currentPick?.bonus?.tier === "gold" ? 3 : currentPick?.bonus?.tier === "silver" ? 2 : 1} OVR)`}
                </p>
                <Button onClick={handleClaimOnly} disabled={picking}>
                  {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
                </Button>
              </div>
            ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredPool.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded hover:bg-secondary ${
                      !data.isUserTurn ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                    }`}
                    onClick={() => data.isUserTurn && setDialogPlayer(p)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden">
                        {p.image ? (
                          <img src={p.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground">{p.positions?.split(",")[0] || "?"}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{p.full_name || p.player_name}</p>
                        <p className="text-xs text-muted-foreground">{p.positions}</p>
                      </div>
                    </div>
                    <Badge className={getRatingColors(p.rating).background + " " + getRatingColors(p.rating).text}>
                      {p.rating}
                    </Badge>
                  </div>
                ))}
                {filteredPool.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">
                    {isPlayerChoice80 ? "No players with OVR ≤80 in pool." : "No players in draft pool."}
                  </p>
                )}
              </div>
            </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!dialogPlayer} onOpenChange={(open) => !open && setDialogPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Pick</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Pick <strong>{dialogPlayer?.full_name || dialogPlayer?.player_name}</strong> for{" "}
            <strong>{selectedTeam?.name || currentTeamName}</strong>?
          </p>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDialogPlayer(null)} disabled={picking}>
              Cancel
            </Button>
            <Button onClick={handlePick} disabled={picking}>
              {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
