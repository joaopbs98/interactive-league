"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, Search, UserPlus, Gavel, Trash2, History, ChevronDown, ChevronUp } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { freeAgentPointsValue } from "@/lib/freeAgentPoints";
import { getRatingColors } from "@/utils/ratingColors";
import { Images } from "@/lib/assets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FreeAgent = {
  id: string;
  player_id: string;
  player_name: string;
  full_name: string | null;
  positions: string;
  rating: number;
  image: string | null;
  deadline?: string | null;
  myBid?: { bonus: number; salary: number; years: number; guaranteed_pct?: number; no_trade_clause?: boolean } | null;
};

type HistoryItem = {
  player_id: string;
  player_name: string;
  winner_team: string;
  winner_acronym?: string;
  salary: number;
  years: number;
  resolved_at: string;
};

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const end = new Date(deadline).getTime();
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setRemaining("Closed");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return <span className="text-xs font-mono text-muted-foreground">{remaining}</span>;
}

export default function FreeAgentsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [agents, setAgents] = useState<FreeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [signingId, setSigningId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bidModal, setBidModal] = useState<FreeAgent | null>(null);
  const [bidSalary, setBidSalary] = useState("");
  const [bidYears, setBidYears] = useState("2");
  const [bidGuaranteedPct, setBidGuaranteedPct] = useState("100");
  const [bidNoTradeClause, setBidNoTradeClause] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (selectedLeagueId) {
      fetchAgents();
      fetchHistory();
    }
  }, [selectedLeagueId]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/freeagents?leagueId=${selectedLeagueId}${selectedTeam?.id ? `&teamId=${selectedTeam.id}` : ""}`
      );
      const data = await res.json();
      if (data.success) {
        setAgents(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!selectedLeagueId) return;
    try {
      const res = await fetch(`/api/freeagents?leagueId=${selectedLeagueId}&mode=history`);
      const data = await res.json();
      if (data.success) setHistory(data.data || []);
    } catch {
      // ignore
    }
  };

  const openBidModal = (agent: FreeAgent) => {
    setBidModal(agent);
    setBidSalary(agent.myBid?.salary?.toString() ?? "");
    setBidYears(agent.myBid?.years?.toString() ?? "2");
    setBidGuaranteedPct(agent.myBid?.guaranteed_pct != null ? String(Math.round((agent.myBid.guaranteed_pct as number) * 100)) : "100");
    setBidNoTradeClause(!!agent.myBid?.no_trade_clause);
  };

  const handlePlaceBid = async () => {
    if (!bidModal || !selectedTeam?.id) return;
    setSigningId(bidModal.player_id);
    setMessage(null);
    try {
      const res = await fetch("/api/freeagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "placeBid",
          leagueId: selectedLeagueId,
          teamId: selectedTeam.id,
          playerId: bidModal.player_id,
          signingBonus: 0,
          salaryPerYear: parseInt(bidSalary, 10) || 0,
          contractYears: parseInt(bidYears, 10) || 2,
          guaranteedPct: (parseInt(bidGuaranteedPct, 10) || 100) / 100,
          noTradeClause: bidNoTradeClause,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Bid placed! Host will resolve free agency." });
        setBidModal(null);
        fetchAgents();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSigningId(null);
    }
  };

  const handleSign = async (playerId: string) => {
    setSigningId(playerId);
    setMessage(null);
    try {
      const res = await fetch('/api/freeagents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          leagueId: selectedLeagueId,
          teamId: selectedTeam?.id,
          playerId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Signed ${data.data.player_name}!` });
        fetchAgents();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSigningId(null);
    }
  };

  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);
  const pointsPreview = bidModal && bidSalary && bidYears
    ? freeAgentPointsValue(
        parseInt(bidSalary, 10) * parseInt(bidYears, 10),
        (parseInt(bidGuaranteedPct, 10) || 100) / 100,
        parseInt(bidYears, 10) || 2,
        bidNoTradeClause
      ).toFixed(2)
    : null;

  const handleClearBids = async () => {
    if (!selectedLeagueId || !isHost) return;
    setMessage(null);
    try {
      const res = await fetch("/api/freeagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", leagueId: selectedLeagueId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "All pending bids cleared" });
        fetchAgents();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  const filtered = agents.filter(a =>
    (a.player_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.positions || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={8} />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Free Agents</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{agents.length} available</Badge>
          {isHost && (
            <Button variant="outline" size="sm" onClick={handleClearBids}>
              <Trash2 className="h-4 w-4 mr-1" /> CLEAR Bids
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-900/30 text-green-300 border border-green-800' : 'bg-red-900/30 text-red-300 border border-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-neutral-800 border-neutral-700"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            {agents.length === 0
              ? "No free agents available. The host must add players to the pool and confirm it in Host Controls."
              : "No players match your search."
            }
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map(agent => {
            const imageSrc = agent.image?.startsWith("http")
              ? `/api/proxy-image?url=${encodeURIComponent(agent.image)}`
              : agent.image || Images.NoImage.src;
            return (
            <Card key={agent.id} className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={imageSrc}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = Images.NoImage.src; }}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{agent.full_name || agent.player_name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{agent.positions}</Badge>
                      <Badge className={`text-xs ${getRatingColors(agent.rating).background} ${getRatingColors(agent.rating).text}`}>
                        {agent.rating}
                      </Badge>
                      {agent.deadline && (
                        <span className="flex items-center gap-1">
                          <Countdown deadline={agent.deadline} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => openBidModal(agent)}
                  disabled={signingId === agent.player_id || !selectedTeam?.id}
                >
                  {signingId === agent.player_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : agent.myBid ? (
                    <><Gavel className="h-3 w-3 mr-1" /> Edit Bid</>
                  ) : (
                    <><UserPlus className="h-3 w-3 mr-1" /> Place Bid</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );})}
        </div>
      )}

      {history.length > 0 && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-0">
            <button
              type="button"
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <span className="font-medium flex items-center gap-2">
                <History className="h-4 w-4" /> FA History
              </span>
              {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {historyOpen && (
              <div className="border-t border-neutral-800 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 text-muted-foreground text-left">
                      <th className="p-3">Player</th>
                      <th className="p-3">Winner</th>
                      <th className="p-3">Salary</th>
                      <th className="p-3">Years</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i} className="border-b border-neutral-800/50">
                        <td className="p-3">{h.player_name}</td>
                        <td className="p-3">{h.winner_team} {h.winner_acronym && `(${h.winner_acronym})`}</td>
                        <td className="p-3">${(h.salary / 1_000_000).toFixed(1)}M</td>
                        <td className="p-3">{h.years}</td>
                        <td className="p-3 text-muted-foreground">{new Date(h.resolved_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!bidModal} onOpenChange={(open) => !open && setBidModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Bid</DialogTitle>
            <DialogDescription>
              {bidModal?.full_name || bidModal?.player_name} — Sealed bid. Host resolves when ready.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Annual Salary ($) — $100K increments</Label>
              <Input
                type="number"
                min={0}
                step={100000}
                value={bidSalary}
                onChange={(e) => setBidSalary(e.target.value)}
                placeholder="5000000"
              />
            </div>
            <div>
              <Label>Contract Years (max 2)</Label>
              <Input
                type="number"
                min={1}
                max={2}
                value={bidYears}
                onChange={(e) => setBidYears(e.target.value)}
                placeholder="2"
              />
            </div>
            <div>
              <Label>Guaranteed % (1-year = 100%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={bidGuaranteedPct}
                onChange={(e) => setBidGuaranteedPct(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="noTradeClause"
                checked={bidNoTradeClause}
                onChange={(e) => setBidNoTradeClause(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="noTradeClause">No-Trade Clause (+4% Points Value)</Label>
            </div>
            {pointsPreview != null && (
              <p className="text-sm text-muted-foreground">
                Points Value: <span className="font-mono font-medium">{pointsPreview}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidModal(null)}>Cancel</Button>
            <Button
              onClick={handlePlaceBid}
              disabled={!bidSalary || parseInt(bidSalary, 10) <= 0 || (parseInt(bidSalary, 10) % 100000 !== 0)}
            >
              Place Bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
