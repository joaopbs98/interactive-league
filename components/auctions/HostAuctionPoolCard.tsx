"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gavel, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Candidate = { player_id: string; player_name?: string; full_name?: string; rating?: number; positions?: string; endTime?: string };

export function HostAuctionPoolCard({ leagueId, disabled }: { leagueId: string; disabled: boolean }) {
  const [minRating, setMinRating] = useState("60"); const [maxRating, setMaxRating] = useState("85");
  const [position, setPosition] = useState(""); const [count, setCount] = useState("5");
  const [startingBid, setStartingBid] = useState("100000"); const [deadline, setDeadline] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]); const [verified, setVerified] = useState(false); const [loading, setLoading] = useState(false);
  const [emptyResult, setEmptyResult] = useState(false);

  async function generate() {
    setLoading(true);
    const params = new URLSearchParams({ leagueId, minRating, maxRating, count }); if (position) params.set("position", position);
    const response = await fetch(`/api/league/auction-pool?${params}`); const json = await response.json(); setLoading(false);
    if (!response.ok) return toast.error(json.error ?? "Could not generate pool");
    const matches = json.candidates ?? [];
    setCandidates(matches.map((x: Candidate) => ({ ...x, endTime: deadline }))); setEmptyResult(matches.length === 0); setVerified(false);
  }

  async function publish() {
    if (!candidates.every((x) => x.endTime)) return toast.error("Every lot needs a real-world deadline");
    try {
      setLoading(true);
      const lots = candidates.map((x) => {
        const endTime = new Date(x.endTime!);
        if (Number.isNaN(endTime.getTime())) throw new Error(`Invalid deadline for ${x.full_name || x.player_name}`);
        return { playerId: x.player_id, startingBid: Number(startingBid), endTime: endTime.toISOString() };
      });
      const response = await fetch("/api/league/auction-pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leagueId, verified, lots }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not publish pool");
      toast.success(`${candidates.length} Dutch Auction lot(s) published`); setCandidates([]); setVerified(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish pool");
    } finally {
      setLoading(false);
    }
  }

  async function resolve() {
    const response = await fetch("/api/league/auctions/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leagueId }) });
    const json = await response.json(); if (!response.ok) return toast.error(json.error ?? "Resolution failed");
    toast.success(`${json.resolved ?? 0} expired auction(s) resolved`);
  }

  return <Card className="bg-surface border-border">
    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gavel className="h-4 w-4" />Dutch Auction Pool</CardTitle><CardDescription>Generate a proposed player pool, review every lot, then assign real deadlines and publish.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2"><Input aria-label="Minimum rating" type="number" min={0} max={99} value={minRating} onChange={(e) => setMinRating(e.target.value)} placeholder="Min OVR" /><Input aria-label="Maximum rating" type="number" min={0} max={99} value={maxRating} onChange={(e) => setMaxRating(e.target.value)} placeholder="Max OVR" /><Input aria-label="Position filter" value={position} onChange={(e) => setPosition(e.target.value.toUpperCase())} placeholder="Position (optional)" /><Input aria-label="Player count" type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} /><Button variant="outline" onClick={generate} disabled={disabled || loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}Generate proposal</Button></div>
      <div className="grid md:grid-cols-2 gap-3"><div><Label htmlFor="pool-start">Starting bid for all lots</Label><Input id="pool-start" type="number" min={0} step={100000} value={startingBid} onChange={(e) => setStartingBid(e.target.value)} /></div><div><Label htmlFor="pool-deadline">Set default real-world deadline</Label><Input id="pool-deadline" type="datetime-local" value={deadline} onInput={(e) => { const value = e.currentTarget.value; setDeadline(value); setCandidates((all) => all.map((x) => ({ ...x, endTime: value }))); }} /></div></div>
      {emptyResult && <p role="status" className="text-sm text-muted-foreground">No unassigned players match these filters. Broaden the rating or position range and try again.</p>}
      {candidates.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">Private proposal · {candidates.length} player(s)</p>{candidates.map((p) => <div key={p.player_id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-2"><div className="flex-1"><p className="text-sm font-medium">{p.full_name || p.player_name}</p><p className="text-xs text-muted-foreground">{p.rating} OVR · {p.positions}</p></div><Input aria-label={`Deadline for ${p.full_name || p.player_name}`} className="sm:w-56" type="datetime-local" value={p.endTime ?? ""} onInput={(e) => { const value = e.currentTarget.value; setCandidates((all) => all.map((x) => x.player_id === p.player_id ? { ...x, endTime: value } : x)); }} /><Button size="icon" variant="ghost" aria-label={`Remove ${p.full_name || p.player_name}`} onClick={() => setCandidates((all) => all.filter((x) => x.player_id !== p.player_id))}><Trash2 className="h-4 w-4" /></Button></div>)}<label className="flex items-start gap-2 text-sm"><Checkbox checked={verified} onCheckedChange={(x) => setVerified(x === true)} /><span>I reviewed this pool and verified every player and deadline.</span></label><Button onClick={publish} disabled={!verified || loading}>Publish verified pool</Button></div>}
      {disabled && <p className="text-xs text-muted-foreground">Dutch Auctions are available only during transfer season (OFFSEASON).</p>}
      <Button variant="outline" onClick={resolve}><Gavel className="h-4 w-4 mr-2" />Resolve expired auctions</Button>
    </CardContent>
  </Card>;
}
