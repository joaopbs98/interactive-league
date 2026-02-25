// app/(dashboard)/trades/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster, toast } from "sonner";
import { useLeague } from "@/contexts/LeagueContext";

interface Team {
  id: string | number;
  name: string;
}
interface Player {
  id: string | number;
  name: string;
  position: string;
  image: string;
}
interface Objective {
  id: number;
  label: string;
}
type TradeStatus = "pending" | "accepted" | "rejected";
type TradeItem =
  | { item_type: "player"; player: Player }
  | { item_type: "money"; amount: number }
  | { item_type: "objective"; objective: Objective }
  | { item_type: "request"; player: Player }
  | { item_type: "draft_pick"; draft_pick: { id: string; pick_number: number; season: number } };

interface Trade {
  id: number;
  fromTeam: Team;
  toTeam: Team;
  status: TradeStatus;
  items: TradeItem[];
}

// current user’s club
export default function TradeCenterPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userTeam, setUserTeam] = useState<Team | null>(null);

  const { selectedLeagueId, selectedTeam } = useLeague();
  const [leagueTeams, setLeagueTeams] = useState<Team[]>([]);
  const [mySquad, setMySquad] = useState<Player[]>([]);
  const [draftPicks, setDraftPicks] = useState<{ id: string; pick_number: number; season: number }[]>([]);

  // Fetch user's team, trades, league teams, squad, draft picks
  useEffect(() => {
    const fetchData = async () => {
      const team = selectedTeam ? { id: selectedTeam.id, name: selectedTeam.name } : null;
      setUserTeam(team);
      if (!team) {
        setLoading(false);
        return;
      }
      try {
        const tradesRes = await fetch(`/api/trades?teamId=${team.id}`);
        if (tradesRes.ok) {
          const tradesData = await tradesRes.json();
          const raw = tradesData.trades || [];
          setTrades(raw.map((t: any) => ({
            id: t.id,
            fromTeam: t.from_team || { id: t.from_team_id, name: "—" },
            toTeam: t.to_team || { id: t.to_team_id, name: "—" },
            status: t.status,
            items: (t.trade_items || []).map((i: any) => {
              if (i.item_type === "player" && i.player_id) {
                return { item_type: "player" as const, player: { id: i.player_id, name: String(i.player_id), position: "", image: "" } };
              }
              if (i.item_type === "request" && i.player_id) {
                return { item_type: "request" as const, player: { id: i.player_id, name: String(i.player_id), position: "", image: "" } };
              }
              if (i.item_type === "money") return { item_type: "money" as const, amount: i.amount ?? 0 };
              if (i.item_type === "objective") return { item_type: "objective" as const, objective: { id: i.objective_id, label: "Objective" } };
              if (i.item_type === "draft_pick" && i.draft_pick) {
                return { item_type: "draft_pick" as const, draft_pick: { id: i.draft_pick.id, pick_number: i.draft_pick.pick_number, season: i.draft_pick.season } };
              }
              return { item_type: "player" as const, player: { id: "", name: "?", position: "", image: "" } };
            }),
          })));
        }
        if (selectedLeagueId) {
          const [teamsRes, draftRes, squadRes] = await Promise.all([
            fetch(`/api/league/teams?leagueId=${selectedLeagueId}`),
            fetch(`/api/draft?leagueId=${selectedLeagueId}`),
            fetch(`/api/team/${team.id}`).catch(() => ({ ok: false })),
          ]);
          if (teamsRes.ok) {
            const teamsData = await teamsRes.json();
            const list = (teamsData.data || teamsData.teams || []) as { id: string; name: string }[];
            setLeagueTeams(list.map((t) => ({ id: t.id, name: t.name })));
          }
          if (draftRes.ok) {
            const draftData = await draftRes.json();
            const picks = (draftData.data?.picks || []) as { id: string; pick_number: number; season: number; is_used: boolean; current_owner_team_id?: string; team_id?: string }[];
            const myId = draftData.data?.userTeamId ?? team.id;
            setDraftPicks(picks.filter((p) => (p.current_owner_team_id ?? p.team_id) === myId && !p.is_used).map((p) => ({ id: p.id, pick_number: p.pick_number, season: p.season })));
          }
          if (squadRes.ok) {
            const squadData = await (squadRes as Response).json();
            const players = (squadData.team?.squad || squadData.squad || squadData.players || []) as { player_id: string; name?: string; full_name?: string; positions?: string[] }[];
            setMySquad(players.map((p: any) => ({ id: p.player_id, name: p.name || p.full_name || p.player_id, position: (Array.isArray(p.positions) ? p.positions[0] : p.positions) || "", image: "" })));
          }
        }
      } catch (error) {
        setError("An error occurred while fetching data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedLeagueId, selectedTeam]);

  // --- Propose Trade Dialog State (must be before useEffect that uses proposeTo) ---
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeTo, setProposeTo] = useState<string>("");
  const [selPlayers, setSelPlayers] = useState<(string | number)[]>([]);
  const [selDraftPicks, setSelDraftPicks] = useState<string[]>([]);
  const [offerMoney, setOfferMoney] = useState("");
  const [selObjectives, setSelObjectives] = useState<number[]>([]);
  const [selRequests, setSelRequests] = useState<(string | number)[]>([]);
  const [otherTeamSquad, setOtherTeamSquad] = useState<Player[]>([]);
  const [playerTakeoverPct, setPlayerTakeoverPct] = useState<Record<string, number>>({});
  const [requestFilter, setRequestFilter] = useState("");

  // Fetch other team's squad when proposeTo is selected
  useEffect(() => {
    if (!proposeTo || !selectedLeagueId) {
      setOtherTeamSquad([]);
      return;
    }
    fetch(`/api/league/team-squad?leagueId=${selectedLeagueId}&teamId=${proposeTo}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.squad)) {
          setOtherTeamSquad(json.squad);
        } else {
          setOtherTeamSquad([]);
        }
      })
      .catch(() => setOtherTeamSquad([]));
  }, [proposeTo, selectedLeagueId]);

  // --- View Offer Dialog State ---
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);

  // Filter pending vs completed
  const pending = trades.filter((t) => t.status === "pending");
  const completed = trades.filter((t) => t.status !== "pending");

  // Toggle helper
  const toggle = (arr: (string | number)[], id: string | number, on: boolean) =>
    on ? [...arr, id] : arr.filter((x) => x !== id);
  const toggleDraft = (id: string, on: boolean) =>
    on ? [...selDraftPicks, id] : selDraftPicks.filter((x) => x !== id);

  const requestSquad: Player[] = [];
  const filteredRequests = requestSquad.filter((p) =>
    p.name.toLowerCase().includes(requestFilter.toLowerCase())
  );

  async function sendProposal() {
    if (!proposeTo || !userTeam) {
      toast.error("Select a team");
      return;
    }
    
    const items = [
      ...selPlayers.map((pid) => ({ type: "player" as const, playerId: String(pid), contractTakeoverPct: playerTakeoverPct[String(pid)] ?? 100 })),
      ...(Number(offerMoney) > 0 ? [{ type: "money" as const, amount: Number(offerMoney) }] : []),
      ...selObjectives.map((oid) => ({ type: "objective" as const, objectiveId: oid })),
      ...selRequests.map((rid) => ({ type: "request" as const, playerId: String(rid) })),
      ...selDraftPicks.map((did) => ({ type: "draft_pick" as const, draftPickId: did })),
    ];
    
    if (!items.length) {
      toast.error("Add at least one asset");
      return;
    }

    try {
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromTeamId: userTeam.id,
          toTeamId: proposeTo,
          items: items
        })
      });

      if (response.ok) {
        toast.success("Proposal sent successfully!");
        // reset
        setProposeOpen(false);
        setProposeTo("");
        setSelPlayers([]);
        setOfferMoney("");
        setSelObjectives([]);
        setSelRequests([]);
        setSelDraftPicks([]);
        setOtherTeamSquad([]);
        setPlayerTakeoverPct({});
        
        // Refresh trades list
        const tradesResponse = await fetch(`/api/trades?teamId=${userTeam.id}`);
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          setTrades(tradesData.trades || []);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send proposal");
      }
    } catch (error) {
      toast.error("An error occurred while sending the proposal");
    }
  }

  function openView(t: Trade) {
    setViewTrade(t);
    setViewOpen(true);
  }
  function closeView() {
    setViewOpen(false);
    setViewTrade(null);
  }

  async function accept() {
    if (!viewTrade || !userTeam) return;
    
    try {
      const response = await fetch(`/api/trades/${viewTrade.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' })
      });

      if (response.ok) {
        toast.success(`Trade #${viewTrade.id} accepted`);
        closeView();
        
        // Refresh trades list
        const tradesResponse = await fetch(`/api/trades?teamId=${userTeam.id}`);
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          setTrades(tradesData.trades || []);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to accept trade");
      }
    } catch (error) {
      toast.error("An error occurred while accepting the trade");
    }
  }

  async function reject() {
    if (!viewTrade || !userTeam) return;
    
    try {
      const response = await fetch(`/api/trades/${viewTrade.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject' })
      });

      if (response.ok) {
        toast.success(`Trade #${viewTrade.id} rejected`);
        closeView();
        
        // Refresh trades list
        const tradesResponse = await fetch(`/api/trades?teamId=${userTeam.id}`);
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          setTrades(tradesData.trades || []);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to reject trade");
      }
    } catch (error) {
      toast.error("An error occurred while rejecting the trade");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <Toaster position="top-center" richColors />

      <h1 className="text-2xl font-bold text-white">Trade Center</h1>

      {/* Propose Trade */}
      <div className="flex justify-end">
        <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
          <DialogTrigger asChild>
            <Button>Propose Trade +</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Propose Trade</DialogTitle>
              <DialogDescription>
                Offer assets & request players.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* 1. To Team */}
              <div className="grid grid-cols-3 items-center gap-4">
                <Label>To Team</Label>
                <Select
                  value={proposeTo}
                  onValueChange={(v) => setProposeTo(v)}
                >
                  <SelectTrigger>
                    {proposeTo
                      ? leagueTeams.find((t) => t.id === proposeTo)?.name ?? "Select Team"
                      : "Select Team"}
                  </SelectTrigger>
                  <SelectContent>
                    {leagueTeams
                      .filter((t) => t.id !== userTeam?.id)
                      .map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Your Players */}
              <div>
                <Label>Your Players (Contract Takeover: % buying club takes)</Label>
                <div className="flex flex-wrap gap-2 border p-2 rounded max-h-40 overflow-y-auto">
                  {mySquad.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selPlayers.includes(p.id)}
                        onCheckedChange={(chk) =>
                          setSelPlayers((s) => toggle(s, p.id, chk as boolean))
                        }
                      />
                      <span
                        className="w-8 h-8 bg-neutral-800 rounded-full 
                                   flex items-center justify-center text-white"
                      >
                        {p.name[0]}
                      </span>
                      <span className="text-sm">{p.name}</span>
                      {selPlayers.includes(p.id) && (
                        <Select
                          value={String(playerTakeoverPct[String(p.id)] ?? 100)}
                          onValueChange={(v) =>
                            setPlayerTakeoverPct((prev) => ({ ...prev, [String(p.id)]: parseInt(v, 10) }))
                          }
                        >
                          <SelectTrigger className="w-20 h-7 text-xs">
                            {playerTakeoverPct[String(p.id)] ?? 100}%
                          </SelectTrigger>
                          <SelectContent>
                            {[100, 90, 80, 70, 60, 50, 40, 30, 20, 10].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Money */}
              <div className="grid grid-cols-3 items-center gap-4">
                <Label>Money (€)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 5,000,000"
                  value={offerMoney}
                  onChange={(e) => setOfferMoney(e.target.value)}
                  className="col-span-2"
                />
              </div>

              {/* 4. Draft Picks */}
              {draftPicks.length > 0 && (
                <div>
                  <Label>Draft Picks (offer to trade)</Label>
                  <div className="flex flex-wrap gap-2 border p-2 rounded max-h-40 overflow-y-auto">
                    {draftPicks.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={selDraftPicks.includes(p.id)}
                          onCheckedChange={(chk) =>
                            setSelDraftPicks((s) => toggleDraft(p.id, chk as boolean))
                          }
                        />
                        <span className="text-sm">Pick #{p.pick_number} (S{p.season})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Request Players - auto-loaded when team selected */}
              {proposeTo && (
                <div className="space-y-2">
                  <Label>
                    Request from{" "}
                    {leagueTeams.find((t) => t.id === proposeTo)?.name ?? "—"}
                  </Label>
                  <div className="flex flex-wrap gap-2 border p-2 rounded max-h-40 overflow-y-auto">
                    {filteredRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading squad...</p>
                    ) : (
                      filteredRequests.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={selRequests.includes(p.id)}
                            onCheckedChange={(chk) =>
                              setSelRequests((s) => toggle(s, p.id, chk as boolean))
                            }
                          />
                          <span
                            className="w-8 h-8 bg-neutral-800 rounded-full 
                                       flex items-center justify-center text-white"
                          >
                            {(p.name || "?")[0]}
                          </span>
                          <span className="text-sm truncate max-w-[120px]">{p.name}</span>
                          {p.position && (
                            <span className="text-xs text-muted-foreground">({p.position})</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProposeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendProposal}>Send Proposal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Trades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.length === 0 && (
            <p className="text-muted-foreground">No pending trades.</p>
          )}
          {pending.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-[#1F1F1F] p-4 rounded"
            >
              {/* Trade ID & Clubs */}
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-full">
                  <span className="font-mono">#{t.id}</span>
                </div>
                <div className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-full text-white">
                  {t.fromTeam.name[0]}
                </div>
                <span className="text-white">{t.fromTeam.name}</span>
                <span className="text-muted-foreground">→</span>
                <div className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-full text-white">
                  {t.toTeam.name[0]}
                </div>
                <span className="text-white">{t.toTeam.name}</span>
              </div>

              {/* View Offer always available */}
              <Button size="sm" onClick={() => openView(t)}>
                View Offer
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* View Offer Dialog */}
      <Dialog open={viewOpen} onOpenChange={closeView}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trade #{viewTrade?.id}</DialogTitle>
            <DialogDescription>
              From <b>{viewTrade?.fromTeam.name}</b> →
              <b> {viewTrade?.toTeam.name}</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {viewTrade?.items.map((it, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 bg-[#2A2A2A] rounded"
              >
                {it.item_type === "player" && (
                  <>
                    <span
                      className="w-8 h-8 bg-neutral-800 rounded-full 
                                 flex items-center justify-center text-white"
                    >
                      {it.player.name[0]}
                    </span>
                    <div>
                      <p>{it.player.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.player.position}
                      </p>
                    </div>
                  </>
                )}
                {it.item_type === "money" && (
                  <span className="font-mono">
                    €{it.amount.toLocaleString()}
                  </span>
                )}
                {it.item_type === "objective" && (
                  <span>{it.objective.label}</span>
                )}
                {it.item_type === "request" && (
                  <>
                    <span
                      className="w-8 h-8 bg-neutral-800 rounded-full 
                                 flex items-center justify-center text-white"
                    >
                      {it.player.name[0]}
                    </span>
                    <div>
                      <p>{it.player.name} (requested)</p>
                    </div>
                  </>
                )}
                {it.item_type === "draft_pick" && (
                  <span className="font-mono">
                    Draft Pick #{it.draft_pick.pick_number} (S{it.draft_pick.season})
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Footer: only allow accept/reject if incoming */}
          <DialogFooter className="flex justify-end gap-2">
            {viewTrade?.toTeam.id === userTeam?.id ? (
              <>
                <Button variant="outline" onClick={reject}>
                  Reject
                </Button>
                <Button onClick={accept}>Accept</Button>
              </>
            ) : (
              <Button onClick={closeView}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
