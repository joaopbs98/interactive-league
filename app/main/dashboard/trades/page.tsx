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

interface Team {
  id: number;
  name: string;
}
interface Player {
  id: number;
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
  | { item_type: "request"; player: Player };

interface Trade {
  id: number;
  fromTeam: Team;
  toTeam: Team;
  status: TradeStatus;
  items: TradeItem[];
}

// current user’s club
const currentTeam: Team = { id: 1, name: "Southampton" };
// all clubs
const allTeams: Team[] = [
  currentTeam,
  { id: 2, name: "Benfica" },
  { id: 3, name: "AC Milan" },
  { id: 4, name: "AS Roma" },
];

// your squad
const mySquad: Player[] = [
  { id: 11, name: "Player A", position: "ST", image: "/players/pA.png" },
  { id: 22, name: "Player B", position: "CM", image: "/players/pB.png" },
  { id: 33, name: "Player C", position: "CB", image: "/players/pC.png" },
];
// objectives
const objectives: Objective[] = [
  { id: 101, label: "CL Qualification" },
  { id: 102, label: "Score 20 Goals" },
];
// mock squads per team
const teamSquads: Record<number, Player[]> = {
  2: [
    { id: 201, name: "Benfica GK", position: "GK", image: "/players/b-gk.png" },
    { id: 202, name: "Benfica CB", position: "CB", image: "/players/b-cb.png" },
    { id: 203, name: "Benfica ST", position: "ST", image: "/players/b-st.png" },
  ],
  3: [
    { id: 301, name: "Milan CM", position: "CM", image: "/players/m-cm.png" },
  ],
  4: [{ id: 401, name: "Roma RB", position: "RB", image: "/players/r-rb.png" }],
};

export default function TradeCenterPage() {
  const [trades, setTrades] = useState<Trade[]>([]);

  // Initialize with a sample outgoing trade
  useEffect(() => {
    setTrades([
      {
        id: 14,
        fromTeam: currentTeam,
        toTeam: allTeams[1],
        status: "pending",
        items: [
          { item_type: "player", player: mySquad[0] },
          { item_type: "money", amount: 5_000_000 },
        ],
      },
    ]);
  }, []);

  // --- Propose Trade Dialog State ---
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeTo, setProposeTo] = useState<number | "">("");
  const [selPlayers, setSelPlayers] = useState<number[]>([]);
  const [offerMoney, setOfferMoney] = useState("");
  const [selObjectives, setSelObjectives] = useState<number[]>([]);
  const [selRequests, setSelRequests] = useState<number[]>([]);
  const [requestFilter, setRequestFilter] = useState("");

  // --- View Offer Dialog State ---
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);

  // Filter pending vs completed
  const pending = trades.filter((t) => t.status === "pending");
  const completed = trades.filter((t) => t.status !== "pending");

  // Toggle helper
  const toggle = (arr: number[], id: number, on: boolean) =>
    on ? [...arr, id] : arr.filter((x) => x !== id);

  // Squad of selected team
  const requestSquad: Player[] =
    typeof proposeTo === "number" ? teamSquads[proposeTo] || [] : [];
  const filteredRequests = requestSquad.filter((p) =>
    p.name.toLowerCase().includes(requestFilter.toLowerCase())
  );

  function sendProposal() {
    if (!proposeTo) {
      toast.error("Select a team");
      return;
    }
    const items: TradeItem[] = [
      ...selPlayers.map((pid) => ({
        item_type: "player" as const,
        player: mySquad.find((p) => p.id === pid)!,
      })),
      ...(Number(offerMoney) > 0
        ? [{ item_type: "money" as const, amount: Number(offerMoney) }]
        : []),
      ...selObjectives.map((oid) => ({
        item_type: "objective" as const,
        objective: objectives.find((o) => o.id === oid)!,
      })),
      ...selRequests.map((rid) => ({
        item_type: "request" as const,
        player: requestSquad.find((p) => p.id === rid)!,
      })),
    ];
    if (!items.length) {
      toast.error("Add at least one asset");
      return;
    }
    const toT = allTeams.find((t) => t.id === proposeTo)!;
    const newT: Trade = {
      id: Date.now(),
      fromTeam: currentTeam,
      toTeam: toT,
      status: "pending",
      items,
    };
    setTrades((t) => [newT, ...t]);
    toast.success(`Proposal sent to ${toT.name}`);
    // reset
    setProposeOpen(false);
    setProposeTo("");
    setSelPlayers([]);
    setOfferMoney("");
    setSelObjectives([]);
    setSelRequests([]);
    setRequestFilter("");
  }

  function openView(t: Trade) {
    setViewTrade(t);
    setViewOpen(true);
  }
  function closeView() {
    setViewOpen(false);
    setViewTrade(null);
  }

  function accept() {
    if (!viewTrade) return;
    setTrades((t) =>
      t.map((x) => (x.id === viewTrade.id ? { ...x, status: "accepted" } : x))
    );
    toast.success(`Trade #${viewTrade.id} accepted`);
    closeView();
  }
  function reject() {
    if (!viewTrade) return;
    setTrades((t) =>
      t.map((x) => (x.id === viewTrade.id ? { ...x, status: "rejected" } : x))
    );
    toast.error(`Trade #${viewTrade.id} rejected`);
    closeView();
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
                  value={proposeTo.toString()}
                  onValueChange={(v) => setProposeTo(Number(v))}
                >
                  <SelectTrigger>
                    {proposeTo
                      ? allTeams.find((t) => t.id === proposeTo)!.name
                      : "Select Team"}
                  </SelectTrigger>
                  <SelectContent>
                    {allTeams
                      .filter((t) => t.id !== currentTeam.id)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Your Players */}
              <div>
                <Label>Your Players</Label>
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

              {/* 4. Objectives */}
              <div>
                <Label>Objectives</Label>
                <div className="space-y-2">
                  {objectives.map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selObjectives.includes(o.id)}
                        onCheckedChange={(chk) =>
                          setSelObjectives((s) =>
                            toggle(s, o.id, chk as boolean)
                          )
                        }
                      />
                      <span>{o.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Request Players */}
              {proposeTo && (
                <div className="space-y-2">
                  <Label>
                    Request from{" "}
                    {allTeams.find((t) => t.id === proposeTo)!.name}
                  </Label>
                  <Input
                    placeholder="Search squad..."
                    value={requestFilter}
                    onChange={(e) => setRequestFilter(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2 border p-2 rounded max-h-40 overflow-y-auto">
                    {filteredRequests.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={selRequests.includes(p.id)}
                          onCheckedChange={(chk) =>
                            setSelRequests((s) =>
                              toggle(s, p.id, chk as boolean)
                            )
                          }
                        />
                        <span
                          className="w-8 h-8 bg-neutral-800 rounded-full 
                                     flex items-center justify-center text-white"
                        >
                          {p.name[0]}
                        </span>
                        <span className="text-sm">{p.name}</span>
                      </div>
                    ))}
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
              </div>
            ))}
          </div>

          {/* Footer: only allow accept/reject if incoming */}
          <DialogFooter className="flex justify-end gap-2">
            {viewTrade?.toTeam.id === currentTeam.id ? (
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
