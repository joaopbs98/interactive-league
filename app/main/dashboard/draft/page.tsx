"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Images } from "@/lib/assets";

type ClubPick = { club: string; pickNumber: number; picked?: Player };
type Player = {
  id: number;
  name: string;
  position: string;
  overall: number;
  avatar: any;
};

const INITIAL_ORDER: ClubPick[] = [
  { club: "AC Milan", pickNumber: 1 },
  { club: "AS Roma", pickNumber: 2 },
  { club: "SL Benfica", pickNumber: 3 },
  { club: "Inter Miami", pickNumber: 4 },
];

const INITIAL_PLAYERS: Player[] = [
  { id: 1, name: "João Neves", position: "CM", overall: 82, avatar: Images.JN },
  {
    id: 2,
    name: "Karim Benzema",
    position: "ST",
    overall: 88,
    avatar: Images.JN,
  },
  {
    id: 3,
    name: "Neymar Jr",
    position: "LW",
    overall: 91,
    avatar: Images.JN,
  },
  {
    id: 4,
    name: "Kevin De Bruyne",
    position: "CM",
    overall: 91,
    avatar: Images.JN,
  },
];

export default function DraftPage() {
  const [order, setOrder] = useState<ClubPick[]>(INITIAL_ORDER);
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dialogPlayer, setDialogPlayer] = useState<Player | null>(null);

  const currentPick = order[currentIndex];
  const nextPick = order[currentIndex + 1];

  const confirm = () => {
    if (!dialogPlayer) return;
    const newOrder = [...order];
    newOrder[currentIndex] = {
      ...newOrder[currentIndex],
      picked: dialogPlayer,
    };
    setOrder(newOrder);
    setPlayers((p) => p.filter((x) => x.id !== dialogPlayer.id));
    setDialogPlayer(null);
    setCurrentIndex((i) => Math.min(i + 1, order.length - 1));
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Season 6 Draft</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Current Club</p>
            <h2 className="text-lg font-semibold">{currentPick.club}</h2>
            <p className="text-xs text-muted-foreground">
              Time Remaining: 45:56
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Next Pick</p>
            <h2 className="text-lg font-semibold">{nextPick?.club ?? "—"}</h2>
            <p className="text-xs text-muted-foreground">
              Pick #{nextPick?.pickNumber}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Available Players</p>
            <h2 className="text-lg font-semibold">{players.length}</h2>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </CardContent>
        </Card>
      </div>
      <Separator />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Draft Order */}
        <Card className="p-0">
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">Draft Order</h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {order.map((o, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded ${
                      idx === currentIndex
                        ? "bg-accent/20"
                        : o.picked
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar>
                        <AvatarImage />
                        <AvatarFallback>{o.club[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{o.club}</p>
                        <p className="text-xs text-muted-foreground">
                          Pick #{o.pickNumber}
                        </p>
                      </div>
                    </div>
                    <div>
                      {o.picked ? (
                        <p className="font-medium">{o.picked.name}</p>
                      ) : idx === currentIndex ? (
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
            <h3 className="text-lg font-semibold mb-4">Available Players</h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded hover:bg-secondary cursor-pointer ${
                      order[currentIndex].club !== currentPick.club
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    onClick={() => {
                      if (order[currentIndex].club === currentPick.club) {
                        setDialogPlayer(p);
                      }
                    }}
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
                    <Badge className="bg-green-600">{p.overall}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={!!dialogPlayer}
        onOpenChange={(open) => !open && setDialogPlayer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Pick</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Pick <strong>{dialogPlayer?.name}</strong> for{" "}
            <strong>{currentPick.club}</strong>?
          </p>
          <DialogFooter className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDialogPlayer(null)}>
              Cancel
            </Button>
            <Button onClick={confirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
