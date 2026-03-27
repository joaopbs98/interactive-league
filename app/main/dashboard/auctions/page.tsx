// app/(dashboard)/auctions/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Sonner imports
import { Toaster, toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";

type Auction = {
  id: string;
  player: {
    player_id?: string;
    id?: string;
    name?: string;
    full_name?: string;
    positions?: string;
    position?: string;
    image?: string;
    overall_rating?: number;
    rating?: number;
  };
  timeLeft: string;
  bestOffer: { teamName: string; rating: number } | null;
  yourPosition: { status: "winning" | "losing" | "none"; rating?: number };
  finished?: boolean;
};

// Helper to parse "45m" / "1h 10m" into seconds
function parseTimeLeft(str: string) {
  let secs = 0;
  const h = str.match(/(\d+)h/);
  if (h) secs += +h[1] * 3600;
  const m = str.match(/(\d+)m/);
  if (m) secs += +m[1] * 60;
  return secs;
}

export default function AuctionsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"current" | "finished">("current");
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Auction | null>(null);
  const [bonus, setBonus] = useState("");
  const [wage, setWage] = useState("");

  // Load auctions data
  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ status: tab === "current" ? "active" : "finished" });
        if (selectedLeagueId) params.set("leagueId", selectedLeagueId);
        const response = await fetch(`/api/auctions?${params}`);
        if (response.ok) {
          const data = await response.json();
          const list = data.auctions ?? data.data ?? [];
          setAuctions(Array.isArray(list) ? list : []);
        } else {
          setAuctions([]);
        }
      } catch (error) {
        console.error("Error fetching auctions:", error);
        setAuctions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAuctions();
  }, [tab, selectedLeagueId]);

  // Setup countdowns
  useEffect(() => {
    const init: Record<string, number> = {};
    auctions.forEach((a) => {
      if (!a.finished) init[a.id] = parseTimeLeft(a.timeLeft);
    });
    setTimers(init);
  }, [auctions]);

  // Tick timer every second
  useEffect(() => {
    const iv = setInterval(() => {
      setTimers((t) => {
        const c = { ...t };
        Object.keys(c).forEach((k) => {
          if (c[k] > 0) c[k]--;
        });
        return c;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const getPlayerName = (p: Auction["player"]) =>
    p?.full_name || p?.name || "Unknown";

  // Filter lists
  const currentList = useMemo(
    () =>
      auctions.filter(
        (a) =>
          !a.finished &&
          getPlayerName(a.player).toLowerCase().includes(filter.toLowerCase())
      ),
    [auctions, filter]
  );
  const finishedList = useMemo(
    () =>
      auctions.filter(
        (a) =>
          a.finished &&
          getPlayerName(a.player).toLowerCase().includes(filter.toLowerCase())
      ),
    [auctions, filter]
  );

  const openOfferModal = (auc: Auction) => {
    setSelected(auc);
    setBonus("");
    setWage("");
    setDialogOpen(true);
  };

  const confirmOffer = async () => {
    if (!selected || !bonus || !wage) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch('/api/auctions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionId: selected.id,
          amount: parseInt(bonus) + parseInt(wage),
          leagueId: selectedLeagueId ?? undefined,
        })
      });

      if (response.ok) {
        toast.success(`Bid placed for ${selected.player.name}!`);
        setDialogOpen(false);
        
        // Refresh auctions list
        const refreshParams = new URLSearchParams({ status: tab === 'current' ? 'active' : 'finished' });
        if (selectedLeagueId) refreshParams.set('leagueId', selectedLeagueId);
        const refreshResponse = await fetch(`/api/auctions?${refreshParams}`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setAuctions(data.auctions || []);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to place bid");
      }
    } catch (error) {
      toast.error("An error occurred while placing the bid");
    }
  };

  if (!selectedLeagueId || !selectedTeam) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Auctions</h2>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Select a league and team to continue</p>
            <p className="text-sm">Choose a league from the Saves page to view auctions.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Sonner Toaster */}
      <Toaster richColors position="top-center" />

      {/* Header & Search */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Auctions</h2>
        <Input
          placeholder="Search player..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="current">
            Current ({currentList.length})
          </TabsTrigger>
          <TabsTrigger value="finished">
            Finished ({finishedList.length})
          </TabsTrigger>
        </TabsList>

        {/* Current Auctions */}
        <TabsContent value="current">
          {loading ? (
            <div className="p-6">
              <PageSkeleton variant="table" rows={6} />
            </div>
          ) : currentList.length === 0 ? (
            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-8 text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">No active auctions.</p>
                <p className="text-sm">Check back when the transfer window opens.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="overflow-auto">
                <Table className="min-w-full table-auto">
                  <TableHeader className="sticky top-0 bg-[#1F1F1F]">
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Time Left</TableHead>
                      <TableHead>Best Offer</TableHead>
                      <TableHead>Your Position</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentList.map((auc) => {
                      const idStr = String(auc.id);
                      const secs = timers[idStr] || 0;
                      const total = parseTimeLeft(auc.timeLeft);
                      const pct = total > 0 ? (secs / total) * 100 : 0;
                      const mins = Math.floor(secs / 60);
                      const hrs = Math.floor(mins / 60);
                      const remM = mins % 60;
                      const disp =
                        secs > 0
                          ? hrs
                            ? `${hrs}h ${remM}m`
                            : `${remM}m`
                          : "0m";
                      const rating = auc.player?.overall_rating ?? auc.player?.rating ?? 0;
                      const pos = auc.player?.positions ?? auc.player?.position ?? "—";
                      const imgSrc = auc.player?.image || "/assets/noImage.jpeg";

                      return (
                        <TableRow key={auc.id} className="hover:bg-[#2A2A2A]">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12">
                                <Image
                                  src={imgSrc}
                                  alt={getPlayerName(auc.player)}
                                  fill
                                  className="rounded-full object-cover"
                                />
                                <span className="absolute -top-1 -right-1">
                                  <Badge variant="secondary">{rating}</Badge>
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">
                                  {getPlayerName(auc.player)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {pos}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="space-y-1">
                            <p className="text-sm">{disp}</p>
                            <Progress
                              value={pct}
                              className="h-2 bg-[#333] rounded-full"
                            />
                          </TableCell>

                          <TableCell>
                            {auc.bestOffer ? (
                              <>
                                <p>{auc.bestOffer.teamName}</p>
                                <Badge variant="secondary">
                                  {auc.bestOffer.rating}
                                </Badge>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {auc.yourPosition.status === "winning" ? (
                              <Badge variant="default">
                                Winning ({auc.yourPosition.rating})
                              </Badge>
                            ) : auc.yourPosition.status === "losing" ? (
                              <Badge variant="destructive">
                                Losing ({auc.yourPosition.rating})
                              </Badge>
                            ) : (
                              <Badge variant="outline">None</Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => openOfferModal(auc)}
                              disabled={secs === 0}
                            >
                              Make Offer
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Finished Auctions */}
        <TabsContent value="finished">
          {loading ? (
            <div className="p-6">
              <PageSkeleton variant="table" rows={6} />
            </div>
          ) : finishedList.length === 0 ? (
            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-8 text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">No finished auctions</p>
                <p className="text-sm">Completed auctions will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="overflow-auto">
                <Table className="min-w-full table-auto">
                  <TableHeader className="sticky top-0 bg-[#1F1F1F]">
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Final Offer</TableHead>
                      <TableHead>Your Bid</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finishedList.map((auc) => (
                      <TableRow key={auc.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Image
                              src={auc.player?.image || "/assets/noImage.jpeg"}
                              alt={getPlayerName(auc.player)}
                              width={32}
                              height={32}
                              className="rounded-full object-cover"
                            />
                            <span>{getPlayerName(auc.player)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{auc.bestOffer?.rating ?? "—"}</TableCell>
                        <TableCell>
                          {auc.yourPosition.status === "none"
                            ? "—"
                            : auc.yourPosition.rating}
                        </TableCell>
                        <TableCell>
                          {auc.yourPosition.status === "winning" ? (
                            <Badge variant="default">Won</Badge>
                          ) : auc.yourPosition.status === "losing" ? (
                            <Badge variant="destructive">Lost</Badge>
                          ) : (
                            <Badge variant="outline">—</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Offer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              Submit a sealed bid for{" "}
              <span className="font-semibold">{selected?.player.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="bonus">Signing Bonus (€)</Label>
              <Input
                id="bonus"
                type="number"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                className="col-span-2"
                placeholder="e.g. 5,000,000"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="wage">Annual Wage (€)</Label>
              <Input
                id="wage"
                type="number"
                value={wage}
                onChange={(e) => setWage(e.target.value)}
                className="col-span-2"
                placeholder="e.g. 3,000,000"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmOffer}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
