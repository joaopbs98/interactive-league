// app/(dashboard)/auctions/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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

type Auction = {
  id: number;
  player: {
    id: number;
    name: string;
    position: string;
    image: string;
    rating: number;
  };
  timeLeft: string;
  bestOffer: { teamName: string; rating: number };
  yourPosition: { status: "winning" | "losing" | "none"; rating?: number };
  finished?: boolean;
};

// Mock data
const mockAuctions: Auction[] = [
  {
    id: 1,
    player: {
      id: 101,
      name: "João Neves",
      position: "CM",
      image: "/images/players/joao-neves.jpg",
      rating: 82,
    },
    timeLeft: "45m",
    bestOffer: { teamName: "Southampton", rating: 87.5 },
    yourPosition: { status: "losing", rating: 81.5 },
  },
  {
    id: 2,
    player: {
      id: 102,
      name: "Pedro Silva",
      position: "ST",
      image: "/images/players/pedro-silva.jpg",
      rating: 79,
    },
    timeLeft: "30m",
    bestOffer: { teamName: "Benfica", rating: 81.2 },
    yourPosition: { status: "winning", rating: 81.2 },
  },
  {
    id: 3,
    player: {
      id: 103,
      name: "Miguel Costa",
      position: "CB",
      image: "/images/players/miguel-costa.jpg",
      rating: 80,
    },
    timeLeft: "1h 10m",
    bestOffer: { teamName: "Southampton", rating: 85.0 },
    yourPosition: { status: "none" },
  },
  {
    id: 4,
    player: {
      id: 104,
      name: "Finished Player",
      position: "GK",
      image: "/images/players/joao-neves.jpg",
      rating: 75,
    },
    timeLeft: "0m",
    bestOffer: { teamName: "Benfica", rating: 80 },
    yourPosition: { status: "none" },
    finished: true,
  },
];

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
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"current" | "finished">("current");
  const [timers, setTimers] = useState<Record<number, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Auction | null>(null);
  const [bonus, setBonus] = useState("");
  const [wage, setWage] = useState("");

  // Load mock data
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setAuctions(mockAuctions);
      setLoading(false);
    }, 800);
  }, []);

  // Setup countdowns
  useEffect(() => {
    const init: Record<number, number> = {};
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
        Object.entries(c).forEach(([k, v]) => {
          if (v > 0) c[+k]!--;
        });
        return c;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Filter lists
  const currentList = useMemo(
    () =>
      auctions.filter(
        (a) =>
          !a.finished &&
          a.player.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [auctions, filter]
  );
  const finishedList = useMemo(
    () =>
      auctions.filter(
        (a) =>
          a.finished &&
          a.player.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [auctions, filter]
  );

  const openOfferModal = (auc: Auction) => {
    setSelected(auc);
    setBonus("");
    setWage("");
    setDialogOpen(true);
  };

  const confirmOffer = () => {
    // TODO: call Supabase Edge Function here
    setDialogOpen(false);
    toast.success(`Offer placed for ${selected?.player.name}!`);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Sonner Toaster */}
      <Toaster richColors position="top-center" />

      {/* Header & Search */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Auctions</h1>
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
            <Skeleton className="h-96 w-full" />
          ) : currentList.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              No current auctions.
            </p>
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
                      const secs = timers[auc.id] || 0;
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

                      return (
                        <TableRow key={auc.id} className="hover:bg-[#2A2A2A]">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12">
                                <Image
                                  src={auc.player.image}
                                  alt={auc.player.name}
                                  fill
                                  className="rounded-full object-cover"
                                />
                                <span className="absolute -top-1 -right-1">
                                  <Badge variant="secondary">
                                    {auc.player.rating}
                                  </Badge>
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-white">
                                  {auc.player.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {auc.player.position}
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
                            <p>{auc.bestOffer.teamName}</p>
                            <Badge variant="secondary">
                              {auc.bestOffer.rating}
                            </Badge>
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
            <Skeleton className="h-96 w-full" />
          ) : finishedList.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              No finished auctions.
            </p>
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
                              src={auc.player.image}
                              alt={auc.player.name}
                              width={32}
                              height={32}
                              className="rounded-full"
                            />
                            <span>{auc.player.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{auc.bestOffer.rating}</TableCell>
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
