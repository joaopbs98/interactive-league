"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Images } from "@/lib/assets";

type Sponsor = {
  id: number;
  name: string;
  type: "Main" | "Kit";
  risk: "Low" | "High";
  payout: string;
  season5: string;
  season6: string;
  total2: string;
  totalLabel: string;
  bonus?: string;
};

const PRIMARY_SPONSORS: Sponsor[] = [
  {
    id: 1,
    name: "Vodafone",
    type: "Main",
    risk: "Low",
    payout: "Low",
    season5: "67.5M",
    season6: "85.0M",
    total2: "152.5M",
    totalLabel: "2-Season Total (Estimated)",
    bonus: "1% Merchandise Revenue if Qualified for Champions League",
  },
  {
    id: 2,
    name: "Puma",
    type: "Kit",
    risk: "Low",
    payout: "",
    season5: "—",
    season6: "—",
    total2: "",
    totalLabel: "",
    bonus: undefined,
  },
];

const NEXT_SPONSORS: Sponsor[] = [
  {
    id: 3,
    name: "Spotify",
    type: "Main",
    risk: "Low",
    payout: "Low",
    season5: "67.5M",
    season6: "85.0M",
    total2: "152.5M",
    totalLabel: "2-Season Total (Estimated)",
  },
  {
    id: 4,
    name: "Qatar",
    type: "Main",
    risk: "High",
    payout: "High",
    season5: "95M",
    season6: "Performance Based",
    total2: "95M",
    totalLabel: "2-Season Total (Estimated)",
  },
  {
    id: 5,
    name: "Crypto.com",
    type: "Main",
    risk: "High",
    payout: "Variable",
    season5: "70M",
    season6: "Stock Price Dependant",
    total2: "70M",
    totalLabel: "2-Season Total (Estimated)",
  },
];

export default function SponsorsPage() {
  const [tab, setTab] = useState<"main" | "kit">("main");

  return (
    <div className="p-8 flex flex-col gap-8">
      <h2 className="text-2xl font-semibold">Sponsorships</h2>

      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Sponsor Card */}
        <Card className="bg-card border-border">
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Main Sponsor</p>
            <h3 className="text-xl font-semibold">Vodafone</h3>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-800 text-white">
                Low Risk
              </Badge>
              <Badge variant="outline" className="bg-green-800 text-white">
                Low Payout
              </Badge>
            </div>
            <div className="bg-background p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Season 5 Income</span>
                <span className="font-semibold text-green-500">67.5M</span>
              </div>
              <div className="flex justify-between">
                <span>Season 6 Income</span>
                <span className="font-semibold text-green-500">85.0M</span>
              </div>
              <div className="flex justify-between">
                <span>{PRIMARY_SPONSORS[0].totalLabel}</span>
                <span className="font-semibold text-green-500">152.5M</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Active Bonuses:</span>{" "}
              {PRIMARY_SPONSORS[0].bonus}
            </p>
          </CardContent>
        </Card>

        {/* Kit Supplier Card */}
        <Card className="bg-card border-border">
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Kit Supplier</p>
            <h3 className="text-xl font-semibold">Puma</h3>
            <div className="bg-background p-4 rounded-lg space-y-2">
              <p className="text-sm uppercase text-muted-foreground">
                Merchandise Income
              </p>
              <h4 className="text-lg font-semibold text-orange-500">
                Standard Merchandise Revenue
              </h4>
              <div className="flex justify-between text-sm">
                <span>Season 5</span>
                <span>2.5% increase in merchandise revenue</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Season 6</span>
                <span>2.5% increase in merchandise revenue</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Season Sponsors Tabs */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Next Season Sponsors</h2>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="rounded-full bg-muted p-1 flex space-x-2 w-max">
            <TabsTrigger
              value="main"
              className="flex-1 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Main Sponsors
            </TabsTrigger>
            <TabsTrigger
              value="kit"
              className="flex-1 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Kit Sponsors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {NEXT_SPONSORS.map((s) => (
                <Card key={s.id} className="bg-card border-border">
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">{s.name}</h3>
                      <div className="flex gap-2">
                        <Badge
                          variant="outline"
                          className={
                            s.risk === "Low"
                              ? "bg-green-800 text-white"
                              : "bg-red-700 text-white"
                          }
                        >
                          {s.risk} Risk
                        </Badge>
                        {s.payout && (
                          <Badge
                            variant="outline"
                            className="bg-green-800 text-white"
                          >
                            {s.payout} Payout
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span>Season 5 Income</span>
                        <span className="font-semibold text-green-500">
                          {s.season5}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Season 6 Income</span>
                        <span
                          className={`font-semibold ${
                            s.risk === "High"
                              ? "text-yellow-400"
                              : "text-green-500"
                          }`}
                        >
                          {s.season6}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{s.totalLabel}</span>
                        <span className="font-semibold text-green-500">
                          {s.total2}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full">
                      Check Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="kit">
            {/* Kit sponsors content (similar structure) */}
            <div className="text-center py-8 text-muted-foreground">
              No kit sponsors yet.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
