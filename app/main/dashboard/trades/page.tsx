// app/(dashboard)/trades/page.tsx
"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Images } from "@/lib/assets";
import { ArrowRight, Inbox, Send, Shuffle } from "lucide-react";

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

const PlayerAvatar = ({ src, name, size = 32 }: { src?: string; name: string; size?: number }) => {
  const imgSrc = src?.startsWith("http") ? `/api/proxy-image?url=${encodeURIComponent(src)}` : src || Images.NoImage.src;
  return (
    <img
      src={imgSrc}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-lg object-cover ring-1 ring-border shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).src = Images.NoImage.src;
      }}
    />
  );
};

// Maps raw /api/trades rows (snake_case joins: from_team/to_team) to the shape the UI
// renders (camelCase fromTeam/toTeam). Every call site that sets `trades` must go through
// this — a couple of refetches used to setTrades(raw) directly, leaving toTeam/fromTeam
// undefined and crashing the page the moment a user proposed/accepted/rejected a trade.
function mapTrades(raw: any[]): Trade[] {
  return raw.map((t: any) => ({
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
  }));
}

function TradeCenterContent() {
  const searchParams = useSearchParams();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTeam, setUserTeam] = useState<Team | null>(null);

  const { selectedLeagueId, selectedTeam } = useLeague();
  const [leagueTeams, setLeagueTeams] = useState<Team[]>([]);
  const [mySquad, setMySquad] = useState<Player[]>([]);
  const [draftPicks, setDraftPicks] = useState<{ id: string; pick_number: number; season: number }[]>([]);

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
          setTrades(mapTrades(tradesData.trades || []));
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
            const players = (squadData.team?.squad || squadData.squad || squadData.players || []) as { player_id: string; name?: string; full_name?: string; positions?: string[]; image?: string }[];
            setMySquad(players.map((p: any) => ({ id: p.player_id, name: p.name || p.full_name || p.player_id, position: (Array.isArray(p.positions) ? p.positions[0] : p.positions) || "", image: p.image || "" })));
          }
        }
      } catch (error) {
        toast.error("An error occurred while fetching data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedLeagueId, selectedTeam]);

  // --- Propose Trade Dialog State ---
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeTo, setProposeTo] = useState<string>("");
  const [selPlayers, setSelPlayers] = useState<(string | number)[]>([]);
  const [selDraftPicks, setSelDraftPicks] = useState<string[]>([]);
  const [offerMoney, setOfferMoney] = useState("");
  const [selObjectives] = useState<number[]>([]);
  const [selRequests, setSelRequests] = useState<(string | number)[]>([]);
  const [otherTeamSquad, setOtherTeamSquad] = useState<Player[]>([]);
  const [playerTakeoverPct, setPlayerTakeoverPct] = useState<Record<string, number>>({});
  const [requestFilter, setRequestFilter] = useState("");

  // Deep-link from Team Comparison / opponent squad pages: ?proposeTo=<teamId> opens pre-filled
  useEffect(() => {
    const preselect = searchParams.get("proposeTo");
    if (preselect) {
      setProposeTo(preselect);
      setProposeOpen(true);
    }
  }, [searchParams]);

  // Fetch other team's squad (with images) when proposeTo is selected — also used for the Request list
  useEffect(() => {
    if (!proposeTo || !selectedLeagueId) {
      setOtherTeamSquad([]);
      return;
    }
    fetch(`/api/league/team-squad?leagueId=${selectedLeagueId}&teamId=${proposeTo}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.squad)) {
          setOtherTeamSquad(
            json.squad.map((p: any) => ({
              id: p.player_id ?? p.id,
              name: p.name || p.full_name || p.player_id,
              position: p.position || (Array.isArray(p.positions) ? p.positions[0] : p.positions) || "",
              image: p.image || "",
            }))
          );
        } else {
          setOtherTeamSquad([]);
        }
      })
      .catch(() => setOtherTeamSquad([]));
  }, [proposeTo, selectedLeagueId]);

  // --- View Offer Dialog State ---
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);
  const [viewLookup, setViewLookup] = useState<Record<string, { name: string; position: string; image: string }>>({});

  const incoming = trades.filter((t) => t.status === "pending" && String(t.toTeam.id) === String(userTeam?.id));
  const outgoing = trades.filter((t) => t.status === "pending" && String(t.fromTeam.id) === String(userTeam?.id));

  const toggle = (arr: (string | number)[], id: string | number, on: boolean) =>
    on ? [...arr, id] : arr.filter((x) => x !== id);
  const toggleDraft = (id: string, on: boolean) =>
    on ? [...selDraftPicks, id] : selDraftPicks.filter((x) => x !== id);

  // Bug fix: this used to reference an always-empty placeholder array, so the "Request from X"
  // list never populated. It should read from the other team's squad, which is already fetched above.
  const filteredRequests = otherTeamSquad.filter((p) =>
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTeamId: userTeam.id,
          toTeamId: proposeTo,
          items: items
        })
      });

      if (response.ok) {
        toast.success("Proposal sent");
        setProposeOpen(false);
        setProposeTo("");
        setSelPlayers([]);
        setOfferMoney("");
        setSelRequests([]);
        setSelDraftPicks([]);
        setOtherTeamSquad([]);
        setPlayerTakeoverPct({});

        const tradesResponse = await fetch(`/api/trades?teamId=${userTeam.id}`);
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          setTrades(mapTrades(tradesData.trades || []));
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send proposal");
      }
    } catch (error) {
      toast.error("An error occurred while sending the proposal");
    }
  }

  // Bug fix: trade items only ever carried a raw player_id, so "View Offer" displayed IDs
  // instead of names. Resolve both teams' squads on open and build a lookup for display.
  async function openView(t: Trade) {
    setViewTrade(t);
    setViewOpen(true);
    if (!selectedLeagueId) return;
    try {
      const [fromRes, toRes] = await Promise.all([
        fetch(`/api/league/team-squad?leagueId=${selectedLeagueId}&teamId=${t.fromTeam.id}`),
        fetch(`/api/league/team-squad?leagueId=${selectedLeagueId}&teamId=${t.toTeam.id}`),
      ]);
      const lookup: Record<string, { name: string; position: string; image: string }> = {};
      for (const res of [fromRes, toRes]) {
        if (!res.ok) continue;
        const json = await res.json();
        for (const p of json.squad || []) {
          const id = String(p.player_id ?? p.id);
          lookup[id] = {
            name: p.name || p.full_name || id,
            position: p.position || (Array.isArray(p.positions) ? p.positions[0] : p.positions) || "",
            image: p.image || "",
          };
        }
      }
      setViewLookup(lookup);
    } catch {
      setViewLookup({});
    }
  }
  function closeView() {
    setViewOpen(false);
    setViewTrade(null);
    setViewLookup({});
  }

  async function accept() {
    if (!viewTrade || !userTeam) return;
    try {
      const response = await fetch(`/api/trades/${viewTrade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      });
      if (response.ok) {
        toast.success(`Trade #${viewTrade.id} accepted`);
        closeView();
        const tradesResponse = await fetch(`/api/trades?teamId=${userTeam.id}`);
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          setTrades(mapTrades(tradesData.trades || []));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      });
      if (response.ok) {
        toast.success(`Trade #${viewTrade.id} rejected`);
        closeView();
        const tradesResponse = await fetch(`/api/trades?teamId=${userTeam.id}`);
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          setTrades(mapTrades(tradesData.trades || []));
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to reject trade");
      }
    } catch (error) {
      toast.error("An error occurred while rejecting the trade");
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={4} />
      </div>
    );
  }

  const TradeRow = ({ t, actionable }: { t: Trade; actionable: boolean }) => (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${
        actionable ? "border-accent/30 bg-accent-muted/40" : "border-border bg-surface-2"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-xs text-muted-foreground shrink-0">#{t.id}</span>
        <span className="font-medium truncate">{t.fromTeam.name}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{t.toTeam.name}</span>
      </div>
      <Button aria-label={`${actionable ? "Review" : "View"} trade from ${t.fromTeam.name} to ${t.toTeam.name}`} size="sm" variant={actionable ? "default" : "outline"} onClick={() => openView(t)} className="shrink-0">
        {actionable ? "Review Offer" : "View"}
      </Button>
    </div>
  );

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />

      <PageHeader
        eyebrow="Transfer Hub"
        title="Trade Center"
        subtitle="Propose, review, and respond to player trades"
        actions={
          <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
            <DialogTrigger asChild>
              <Button>Propose Trade +</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-surface border-border max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Propose Trade</DialogTitle>
                <DialogDescription>
                  Offer assets and request players from another club.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-5 py-2">
                {/* Destination */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">To Team</Label>
                  <Select value={proposeTo} onValueChange={(v) => setProposeTo(v)}>
                    <SelectTrigger className="mt-1.5">
                      {proposeTo
                        ? leagueTeams.find((t) => String(t.id) === String(proposeTo))?.name ?? "Select team"
                        : "Select team"}
                    </SelectTrigger>
                    <SelectContent>
                      {leagueTeams
                        .filter((t) => String(t.id) !== String(userTeam?.id))
                        .map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Your offer */}
                <div className="rounded-lg border border-border bg-surface-2 p-3 flex flex-col gap-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Your Offer</p>

                  <div>
                    <Label className="text-xs text-muted-foreground">Players (contract takeover %)</Label>
                    <div className="flex flex-col gap-1.5 mt-1.5 max-h-40 overflow-y-auto pr-1">
                      {mySquad.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={selPlayers.includes(p.id)}
                            onCheckedChange={(chk) => setSelPlayers((s) => toggle(s, p.id, chk as boolean))}
                          />
                          <PlayerAvatar src={p.image} name={p.name} size={28} />
                          <span className="text-sm truncate flex-1">{p.name}</span>
                          {selPlayers.includes(p.id) && (
                            <Select
                              value={String(playerTakeoverPct[String(p.id)] ?? 100)}
                              onValueChange={(v) =>
                                setPlayerTakeoverPct((prev) => ({ ...prev, [String(p.id)]: parseInt(v, 10) }))
                              }
                            >
                              <SelectTrigger className="w-16 h-7 text-xs shrink-0">
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

                  <div>
                    <Label className="text-xs text-muted-foreground">Money (€)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5,000,000"
                      value={offerMoney}
                      onChange={(e) => setOfferMoney(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  {draftPicks.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Draft Picks</Label>
                      <div className="flex flex-col gap-1.5 mt-1.5 max-h-32 overflow-y-auto">
                        {draftPicks.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={selDraftPicks.includes(p.id)}
                              onCheckedChange={(chk) => setSelDraftPicks(toggleDraft(p.id, chk as boolean))}
                            />
                            <span className="text-sm">Pick #{p.pick_number} (S{p.season})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Their players you're requesting */}
                {proposeTo && (
                  <div className="rounded-lg border border-border bg-surface-2 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Request from {leagueTeams.find((t) => String(t.id) === String(proposeTo))?.name ?? "—"}
                      </p>
                    </div>
                    <Input
                      placeholder="Search players..."
                      value={requestFilter}
                      onChange={(e) => setRequestFilter(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {otherTeamSquad.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Loading squad...</p>
                      ) : filteredRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No players match.</p>
                      ) : (
                        filteredRequests.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={selRequests.includes(p.id)}
                              onCheckedChange={(chk) => setSelRequests((s) => toggle(s, p.id, chk as boolean))}
                            />
                            <PlayerAvatar src={p.image} name={p.name} size={28} />
                            <span className="text-sm truncate flex-1">{p.name}</span>
                            {p.position && <span className="text-xs text-muted-foreground shrink-0">{p.position}</span>}
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
        }
      />

      {trades.length === 0 ? (
        <Card className="bg-surface border-border">
          <CardContent className="p-8">
            <EmptyState
              icon={Shuffle}
              title="No trades yet"
              description="Propose a trade to another team to swap players, draft picks, or money."
              action={{ label: "Propose Trade", onClick: () => setProposeOpen(true) }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Incoming — actionable, shown first */}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5" /> Incoming ({incoming.length})
            </p>
            {incoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incoming offers awaiting your response.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {incoming.map((t) => <TradeRow key={t.id} t={t} actionable />)}
              </div>
            )}
          </div>

          {/* Outgoing — sent, waiting on the other side */}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Sent ({outgoing.length})
            </p>
            {outgoing.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers currently awaiting a response.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {outgoing.map((t) => <TradeRow key={t.id} t={t} actionable={false} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* View Offer Dialog */}
      <Dialog open={viewOpen} onOpenChange={closeView}>
        <DialogContent className="sm:max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle>Trade #{viewTrade?.id}</DialogTitle>
            <DialogDescription>
              From <b>{viewTrade?.fromTeam.name}</b> → <b>{viewTrade?.toTeam.name}</b>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {viewTrade?.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-surface-2 rounded-lg">
                {(it.item_type === "player" || it.item_type === "request") && (() => {
                  const id = String(it.player.id);
                  const resolved = viewLookup[id];
                  return (
                    <>
                      <PlayerAvatar src={resolved?.image} name={resolved?.name || "?"} />
                      <div className="min-w-0">
                        <p className="truncate">
                          {resolved?.name || "Loading..."}
                          {it.item_type === "request" && <span className="text-muted-foreground"> (requested)</span>}
                        </p>
                        {resolved?.position && (
                          <p className="text-xs text-muted-foreground">{resolved.position}</p>
                        )}
                      </div>
                    </>
                  );
                })()}
                {it.item_type === "money" && (
                  <span className="font-mono tabular-nums">€{it.amount.toLocaleString()}</span>
                )}
                {it.item_type === "objective" && <span>{it.objective.label}</span>}
                {it.item_type === "draft_pick" && (
                  <span className="font-mono">
                    Draft Pick #{it.draft_pick.pick_number} (S{it.draft_pick.season})
                  </span>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="flex justify-end gap-2">
            {String(viewTrade?.toTeam.id) === String(userTeam?.id) ? (
              <>
                <Button variant="outline" onClick={reject} className="hover:border-status-negative/40 hover:text-status-negative">
                  Reject
                </Button>
                <Button onClick={accept}>Accept</Button>
              </>
            ) : (
              <Button variant="outline" onClick={closeView}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TradeCenterPage() {
  return (
    <Suspense fallback={
      <div className="p-8">
        <PageSkeleton variant="page" rows={4} />
      </div>
    }>
      <TradeCenterContent />
    </Suspense>
  );
}
