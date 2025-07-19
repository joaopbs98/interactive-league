"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Images } from "@/lib/assets";

type Pack = {
  id: number;
  name: string;
  price: string;
  img: string;
  userCount: number;
  ratingRange: string;
};

const PACKS: Pack[] = [
  {
    id: 1,
    name: "S6 Basic Pack",
    price: "$9,000,000",
    img: Images.BasicPack,
    userCount: 312,
    ratingRange: "60-70",
  },
  {
    id: 2,
    name: "S6 Prime Pack",
    price: "$18,500,000",
    img: Images.PrimePack,
    userCount: 312,
    ratingRange: "65-75",
  },
  {
    id: 3,
    name: "S6 Elite Pack",
    price: "$28,000,000",
    img: Images.ElitePack,
    userCount: 312,
    ratingRange: "70-80",
  },
];

const GRADIENTS = [
  "from-green-800 via-transparent to-transparent",
  "from-blue-800 via-transparent to-transparent",
  "from-yellow-800 via-transparent to-transparent",
];

export default function PackStorePage() {
  const [tab, setTab] = useState<"history" | "remaining">("history");

  return (
    <div className="p-8 space-y-8 bg-background text-foreground">
      <h1 className="text-2xl font-bold">Pack Store</h1>

      <div className="flex justify-center gap-10">
        {PACKS.map((pack, idx) => (
          <Card
            key={pack.id}
            className="relative overflow-hidden rounded-2xl h-[600px] w-96"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-t ${GRADIENTS[idx]} opacity-80`}
            />

            <CardContent className="relative flex flex-col justify-end h-full p-6">
              <h2 className="text-lg font-semibold text-white">{pack.name}</h2>
              <p className="text-green-400 font-bold">{pack.price}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-white">
                  Player Count: {pack.userCount}
                </span>
                <span className="text-sm text-white">{pack.ratingRange}</span>
                <Button size="sm">Open</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Separator />
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-max bg-muted p-1 rounded-full">
            <TabsTrigger value="history" className="px-4">
              Pack History
            </TabsTrigger>
            <TabsTrigger value="remaining" className="px-4">
              Remaining Players
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="rounded-lg border border-neutral-700 h-64">
          <Tabs>
            <TabsContent value="history" className="p-4 space-y-2">
              {PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center justify-between bg-card p-4 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-yellow-500" />
                    <div>
                      <p>{pack.name}</p>
                      <p className="text-sm text-muted-foreground">Pack</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Manchester City
                    </span>
                    <Image src={Images.Benfica} alt="" width={24} height={24} />
                    <span className="text-sm text-muted-foreground">→</span>
                    <Image src={Images.Benfica} alt="" width={24} height={24} />
                  </div>
                  <p className="font-semibold">{pack.price}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent
              value="remaining"
              className="p-4 text-center text-muted-foreground"
            >
              No remaining players.
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </div>
    </div>
  );
}
