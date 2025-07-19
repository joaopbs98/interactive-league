"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Images } from "@/lib/assets";

type Player = {
  id: number;
  name: string;
  position: string;
  overall: number;
  avatar: any;
  bestOfferTeam: string;
  bestOfferPoints: number;
};

const INITIAL_PLAYERS: Player[] = [
  {
    id: 1,
    name: "João Neves",
    position: "CM",
    overall: 82,
    avatar: Images.JN,
    bestOfferTeam: "None",
    bestOfferPoints: 0,
  },
  {
    id: 2,
    name: "Karim Benzema",
    position: "ST",
    overall: 88,
    avatar: Images.JN,
    bestOfferTeam: "None",
    bestOfferPoints: 0,
  },
  {
    id: 3,
    name: "Neymar Jr",
    position: "LW",
    overall: 91,
    avatar: Images.JN,
    bestOfferTeam: "None",
    bestOfferPoints: 0,
  },
  {
    id: 4,
    name: "Kevin De Bruyne",
    position: "CM",
    overall: 91,
    avatar: Images.JN,
    bestOfferTeam: "None",
    bestOfferPoints: 0,
  },
];

export default function FreeAgencyPage() {
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [offerPlayer, setOfferPlayer] = useState<Player | null>(null);

  const [bonus, setBonus] = useState(0);
  const [wage, setWage] = useState(0);
  const [length, setLength] = useState(1);
  const [guaranteed, setGuaranteed] = useState(50);
  const [noTrade, setNoTrade] = useState(false);

  const contractValue = useMemo(
    () => bonus + wage * length * 12,
    [bonus, wage, length]
  );
  const offerPoints = useMemo(() => {
    const H = contractValue,
      E = length,
      G = guaranteed / 100;
    const base =
      E > 1
        ? (H / 100000) * (1 + 0.8 * Math.sin(((G - 0.5) * Math.PI) / 2))
        : H / 100000;
    return noTrade ? base * 1.1 : base;
  }, [contractValue, length, guaranteed, noTrade]);

  function submitOffer() {
    if (!offerPlayer) return;

    setPlayers((list) =>
      list.map((p) => {
        if (p.id !== offerPlayer.id) return p;
        // Only update if this bid is higher than existing best
        if (offerPoints <= p.bestOfferPoints) return p;
        return {
          ...p,
          bestOfferPoints: parseFloat(offerPoints.toFixed(2)),
          bestOfferTeam: "You",
        };
      })
    );

    setOfferPlayer(null);
    setBonus(0);
    setWage(0);
    setLength(1);
    setGuaranteed(50);
    setNoTrade(false);
  }

  return (
    <div className="p-8 space-y-8 bg-background text-foreground">
      <h1 className="text-2xl font-bold">Current Free Agents</h1>

      <Card className="border-orange-600 bg-orange-50">
        <CardContent className="text-orange-700 space-y-2">
          <p className="font-semibold">Free Agency Rules</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Signing bonuses are paid immediately.</li>
            <li>Wages recur monthly for duration.</li>
            <li>Early release incurs penalty on remaining wages.</li>
            <li>No-trade clause boosts attractiveness (+10%).</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-4">Available Players</h2>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 p-2 rounded hover:bg-muted transition"
                >
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage src={p.avatar} />
                      <AvatarFallback>{p.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.position}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    Time Left: <strong>45m</strong>
                  </div>
                  <div className="text-sm">
                    Best Offer:{" "}
                    <strong>
                      {p.bestOfferTeam} ({p.bestOfferPoints})
                    </strong>
                  </div>
                  <div className="text-sm">
                    Your Position:{" "}
                    <strong
                      className={
                        p.bestOfferTeam === "None"
                          ? ""
                          : p.bestOfferTeam === "You"
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {p.bestOfferTeam === "None"
                        ? "None"
                        : p.bestOfferTeam === "You"
                        ? "Winning"
                        : "Losing"}
                    </strong>
                  </div>
                  <Dialog
                    open={!!offerPlayer}
                    onOpenChange={(o) => !o && setOfferPlayer(null)}
                  >
                    <DialogTrigger asChild>
                      <Button onClick={() => setOfferPlayer(p)}>
                        Make an Offer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Offer Contract – {p.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="bonus">Signing Bonus</Label>
                            <Input
                              id="bonus"
                              type="number"
                              value={bonus}
                              onChange={(e) => setBonus(+e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="wage">Monthly Wage</Label>
                            <Input
                              id="wage"
                              type="number"
                              value={wage}
                              onChange={(e) => setWage(+e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Length (yrs)</Label>
                            <Select
                              value={String(length)}
                              onValueChange={(v) => setLength(+v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="1" />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="guaranteed">% Guaranteed</Label>
                            <Input
                              id="guaranteed"
                              type="number"
                              min={0}
                              max={100}
                              value={guaranteed}
                              onChange={(e) => setGuaranteed(+e.target.value)}
                            />
                          </div>
                          <div className="flex items-center space-x-2 pt-5">
                            <Switch
                              id="noTrade"
                              checked={noTrade}
                              onCheckedChange={setNoTrade}
                            />
                            <Label htmlFor="noTrade">No-Trade</Label>
                          </div>
                        </div>
                        <Separator />
                        <div className="text-sm space-y-1">
                          <p>
                            Total Value:{" "}
                            <strong>${contractValue.toLocaleString()}</strong>
                          </p>
                          <p>
                            Offer Points:{" "}
                            <strong>{offerPoints.toFixed(2)}</strong>
                          </p>
                        </div>
                      </div>
                      <DialogFooter className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setOfferPlayer(null)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={submitOffer}>Offer</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
