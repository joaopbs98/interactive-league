"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gavel, History, Plus, Ticket, UserRound } from "lucide-react";
import { toast, Toaster } from "sonner";
import { calculateUnsoldFee } from "@/lib/auctionRules.mjs";
import { ticketRule } from "@/lib/upgradeTicketRules.mjs";

type Bid = { id: string; amount: number; created_at: string; team: { id: string; name: string } };
type Auction = {
  id: string; mode: "dutch" | "auction_house"; asset_type: "player" | "upgrade_ticket";
  player?: { player_id: string; full_name?: string; player_name?: string; name?: string; rating?: number; overall_rating?: number; positions?: string };
  ticket?: { id: string; tier: string }; seller?: { id: string; name: string }; winner?: { id: string; name: string };
  starting_bid: number; reserve_amount?: number; end_time: string; outcome?: string; unsold_fee?: number;
  winning_amount?: number; currentBid?: number; minimumNextBid: number; leader?: { id: string; name: string };
  bids: Bid[]; isSeller: boolean; viewerBid?: number;
};
type AssetData = { teamId?: string; players: any[]; tickets: any[] };

const money = (value?: number | null) => value == null ? "—" : `$${value.toLocaleString()}`;
const assetName = (auction: Auction) => auction.asset_type === "upgrade_ticket"
  ? `${auction.ticket?.tier?.[0]?.toUpperCase() ?? ""}${auction.ticket?.tier?.slice(1) ?? ""} upgrade ticket`
  : auction.player?.full_name || auction.player?.player_name || auction.player?.name || "Player";

function countdown(endTime: string) {
  const seconds = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
  const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function AuctionsPage() {
  const { selectedLeagueId } = useLeague();
  const [mode, setMode] = useState<"dutch" | "auction_house">("dutch");
  const [view, setView] = useState<"active" | "finished" | "mine">("active");
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidLot, setBidLot] = useState<Auction | null>(null);
  const [bid, setBid] = useState("");
  const [listingOpen, setListingOpen] = useState(false);
  const [assets, setAssets] = useState<AssetData>({ players: [], tickets: [] });
  const [assetKey, setAssetKey] = useState("");
  const [startingBid, setStartingBid] = useState("100000");
  const [reserve, setReserve] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [, tick] = useState(0);

  const fetchAuctions = useCallback(async () => {
    if (!selectedLeagueId) return setLoading(false);
    setLoading(true);
    const status = view === "finished" ? "finished" : "active";
    const response = await fetch(`/api/auctions?leagueId=${selectedLeagueId}&mode=${mode}&status=${status}`);
    const json = await response.json();
    if (!response.ok) toast.error(json.error ?? "Could not load auctions");
    setAuctions(json.auctions ?? []); setLoading(false);
  }, [selectedLeagueId, mode, view]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(id); }, []);
  const visible = useMemo(() => view === "mine" ? auctions.filter((a) => a.isSeller || a.viewerBid != null) : auctions, [auctions, view]);

  async function openListing() {
    if (!selectedLeagueId) return;
    const response = await fetch(`/api/auctions/assets?leagueId=${selectedLeagueId}`);
    const json = await response.json();
    if (!response.ok) return toast.error(json.error ?? "Could not load eligible assets");
    setAssets(json); setListingOpen(true);
  }

  async function placeBid() {
    if (!bidLot || !selectedLeagueId) return;
    const response = await fetch("/api/auctions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auctionId: bidLot.id, amount: Number(bid), leagueId: selectedLeagueId }) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error ?? "Bid failed");
    toast.success("Bid placed"); setBidLot(null); setBid(""); fetchAuctions();
  }

  async function createListing() {
    const [assetType, assetId] = assetKey.split(":");
    const response = await fetch("/api/auctions/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leagueId: selectedLeagueId, teamId: assets.teamId, assetType, assetId, startingBid: Number(startingBid), reserve: Number(reserve), endTime: new Date(deadline).toISOString() }) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error ?? "Listing failed");
    toast.success("Auction listing published"); setListingOpen(false); setAssetKey(""); fetchAuctions();
  }

  async function cancelListing(id: string) {
    const response = await fetch("/api/auctions/listings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auctionId: id }) });
    const json = await response.json();
    if (!response.ok) return toast.error(json.error ?? "Cancellation failed");
    toast.success("Listing cancelled"); fetchAuctions();
  }

  if (loading && auctions.length === 0) return <div className="p-6"><PageSkeleton variant="page" rows={6} /></div>;
  return <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
    <Toaster position="top-center" richColors /><Breadcrumbs />
    <PageHeader eyebrow="Transfer Season" title="Auctions" subtitle="Public bidding with real-world deadlines and $100,000 increments" actions={mode === "auction_house" ? <Button onClick={openListing}><Plus className="h-4 w-4 mr-2" />List an asset</Button> : undefined} />
    {!selectedLeagueId ? <Card><CardContent className="p-6 text-muted-foreground">Choose a league from Saves to view auctions.</CardContent></Card> : <Tabs value={mode} onValueChange={(x) => { setMode(x as any); setView("active"); }}>
      <TabsList><TabsTrigger value="dutch">Dutch Auction</TabsTrigger><TabsTrigger value="auction_house">Auction House</TabsTrigger></TabsList>
      {(["dutch", "auction_house"] as const).map((tabMode) => <TabsContent key={tabMode} value={tabMode} className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Auction view">
          <Button variant={view === "active" ? "default" : "outline"} onClick={() => setView("active")}>Active</Button>
          <Button variant={view === "finished" ? "default" : "outline"} onClick={() => setView("finished")}><History className="h-4 w-4 mr-2" />Finished</Button>
          <Button variant={view === "mine" ? "default" : "outline"} onClick={() => setView("mine")}>My activity</Button>
        </div>
        {visible.length === 0 ? <Card><CardContent className="p-10 text-center"><Gavel className="h-8 w-8 mx-auto mb-3 text-muted-foreground" /><p className="font-medium">No {view === "finished" ? "finished" : "active"} {tabMode === "dutch" ? "Dutch Auction" : "Auction House"} lots</p><p className="text-sm text-muted-foreground mt-1">{tabMode === "dutch" ? "The host publishes verified player pools from Host Controls." : "Teams can list owned players and unused upgrade tickets during transfer season."}</p></CardContent></Card> : <div className="space-y-3">{visible.map((auction) => <Card key={auction.id}><CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 lg:w-72">{auction.asset_type === "player" ? <UserRound className="h-8 w-8 text-muted-foreground" /> : <Ticket className="h-8 w-8 text-accent" />}<div className="min-w-0"><p className="font-semibold truncate">{assetName(auction)}</p><p className="text-xs text-muted-foreground">{auction.asset_type === "player" ? `${auction.player?.rating ?? auction.player?.overall_rating ?? "—"} OVR · ${auction.player?.positions ?? "—"}` : `${ticketRule(auction.ticket?.tier).description} Usable from Squad.`}</p></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 text-sm"><div><p className="text-xs text-muted-foreground">{view === "finished" ? "Final bid" : "Current bid"}</p><p className="font-medium tabular-nums">{money(auction.currentBid ?? auction.winning_amount)}</p></div><div><p className="text-xs text-muted-foreground">Leader</p><p>{auction.leader?.name ?? auction.winner?.name ?? "No bids"}</p></div><div><p className="text-xs text-muted-foreground">{view === "finished" ? "Outcome" : "Deadline"}</p><p><Badge variant="outline">{view === "finished" ? auction.outcome : countdown(auction.end_time)}</Badge></p>{view === "finished" && Number(auction.unsold_fee) > 0 && <p className="mt-1 text-xs text-status-negative tabular-nums">Unsold fee {money(auction.unsold_fee)}</p>}</div><div><p className="text-xs text-muted-foreground">Source</p><p>{auction.seller?.name ?? "Host pool"}</p></div></div>
          <div className="flex gap-2 lg:justify-end">{view !== "finished" && !auction.isSeller && <Button aria-label={`Bid ${money(auction.minimumNextBid)} on ${assetName(auction)}`} className="min-h-11" onClick={() => { setBidLot(auction); setBid(String(auction.minimumNextBid)); }}>Bid {money(auction.minimumNextBid)}</Button>}{view !== "finished" && auction.isSeller && auction.bids.length === 0 && <Button aria-label={`Cancel listing for ${assetName(auction)}`} variant="outline" className="min-h-11" onClick={() => cancelListing(auction.id)}>Cancel</Button>}</div>
          {auction.bids.length > 0 && <details className="lg:w-52"><summary className="cursor-pointer text-sm text-muted-foreground">{auction.bids.length} public bid{auction.bids.length === 1 ? "" : "s"}</summary><ol className="mt-2 space-y-1 text-xs">{auction.bids.map((b) => <li key={b.id} className="flex justify-between gap-2"><span>{b.team?.name}</span><span className="tabular-nums">{money(b.amount)}</span></li>)}</ol></details>}
        </CardContent></Card>)}</div>}
      </TabsContent>)}
    </Tabs>}

    <Dialog open={!!bidLot} onOpenChange={(open) => !open && setBidLot(null)}><DialogContent><DialogHeader><DialogTitle>Place public bid</DialogTitle><DialogDescription>Your team and bid amount will be visible to every manager. Minimum: {money(bidLot?.minimumNextBid)}.</DialogDescription></DialogHeader><Label htmlFor="auction-bid">Bid amount</Label><Input id="auction-bid" type="number" min={bidLot?.minimumNextBid} step={100000} value={bid} onChange={(e) => setBid(e.target.value)} /><DialogFooter><Button variant="outline" onClick={() => setBidLot(null)}>Cancel</Button><Button onClick={placeBid}>Place bid</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={listingOpen} onOpenChange={setListingOpen}><DialogContent><DialogHeader><DialogTitle>List an asset</DialogTitle><DialogDescription>The asset is locked while listed. Unsold assets stay with your club and may incur a fee.</DialogDescription></DialogHeader>
      <div className="space-y-4"><div><Label>Player or unused ticket</Label><Select value={assetKey} onValueChange={setAssetKey}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose an eligible asset" /></SelectTrigger><SelectContent>{assets.players.map((p) => <SelectItem key={p.player_id} value={`player:${p.player_id}`} disabled={!p.eligible}>{p.full_name || p.player_name} · {p.rating} OVR{!p.eligible ? " · already listed" : ""}</SelectItem>)}{assets.tickets.map((t) => <SelectItem key={t.id} value={`upgrade_ticket:${t.id}`} disabled={!t.eligible}>{t.tier} upgrade ticket{!t.eligible ? " · already listed" : ""}</SelectItem>)}</SelectContent></Select>{assets.tickets.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No unused upgrade tickets are available. Tickets earned from packs can be used from Squad or listed here during transfer season.</p>}</div>
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="starting-bid">Starting bid</Label><Input id="starting-bid" type="number" step={100000} min={0} value={startingBid} onChange={(e) => setStartingBid(e.target.value)} /></div><div><Label htmlFor="reserve">Reserve</Label><Input id="reserve" type="number" step={100000} min={0} value={reserve} onChange={(e) => setReserve(e.target.value)} /></div></div><div><Label htmlFor="deadline">Real-world deadline</Label><Input id="deadline" type="datetime-local" value={deadline} onInput={(e) => setDeadline(e.currentTarget.value)} /></div>
      <div className="rounded-md border p-3 text-sm"><p className="font-medium">Unsold fee: {money(calculateUnsoldFee(Number(reserve)))}</p><p className="text-xs text-muted-foreground mt-1">4% of reserve, rounded to $100,000, with a $100,000 minimum. A $0 reserve has no fee.</p></div></div>
      <DialogFooter><Button variant="outline" onClick={() => setListingOpen(false)}>Cancel</Button><Button disabled={!assetKey || !deadline} onClick={createListing}>Publish listing</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
