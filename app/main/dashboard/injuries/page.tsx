"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Images } from "@/lib/assets";
import { ScrollArea } from "@/components/ui/scroll-area";

type Injury = {
  id: number;
  name: string;
  position: string;
  overall: number;
  gamesRemaining: number;
};

const MOCK_INJURIES: Injury[] = [
  { id: 1, name: "João Neves", position: "CM", overall: 82, gamesRemaining: 1 },
  { id: 2, name: "João Neves", position: "CM", overall: 82, gamesRemaining: 1 },
  { id: 3, name: "João Neves", position: "CM", overall: 82, gamesRemaining: 1 },
  { id: 4, name: "João Neves", position: "CM", overall: 82, gamesRemaining: 2 },
  { id: 5, name: "João Neves", position: "CM", overall: 82, gamesRemaining: 3 },
  { id: 6, name: "João Neves", position: "CM", overall: 82, gamesRemaining: 1 },
];

const StatsCard = ({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) => (
  <Card className="justify-center h-fit">
    <CardContent className="flex flex-col p-4 gap-1 justify-center">
      <p className="text-xl text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-2">
        <div className="text-xl font-semibold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </CardContent>
  </Card>
);

const InjuryCard = ({ injury }: { injury: Injury }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-neutral-800">
    <div className="flex items-center gap-4">
      <div className="rounded-full bg-white">
        <Image
          src={Images.JN}
          alt="Avatar"
          width={54}
          height={54}
          className="rounded-full"
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold">{injury.name}</p>
          <Badge className="bg-green-700 text-white">{injury.overall}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{injury.position}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-sm font-light">
        {injury.gamesRemaining} Game{injury.gamesRemaining > 1 ? "s" : ""}{" "}
        Remaining
      </p>
    </div>
  </div>
);

const InjuryList = ({ injuries }: { injuries: Injury[] }) => (
  <div className="p-4">
    {injuries.map((injury) => (
      <InjuryCard key={injury.id} injury={injury} />
    ))}
  </div>
);

const InjuriesPage = () => {
  const allInjuries = MOCK_INJURIES;
  const recoveringSoon = MOCK_INJURIES.filter(
    (injury) => injury.gamesRemaining === 1
  );

  return (
    <div className="p-8 flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Injuries</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Active Injuries"
          value={`${allInjuries.length}`}
          subtitle="+20.1% from last season"
        />
        <StatsCard
          title="Recovering Soon"
          value={`${recoveringSoon.length}`}
          subtitle="+180.1% from last season"
        />
        <StatsCard
          title="Wage Bill"
          value="$93,000,000"
          subtitle="+19% from last season"
        />
        <StatsCard
          title="Health"
          value="Above Average"
          subtitle="12% Higher than other clubs"
        />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full flex">
          <TabsTrigger value="all" className="flex-1">
            All Injuries ({allInjuries.length})
          </TabsTrigger>
          <TabsTrigger value="recovering" className="flex-1">
            Recovering Soon ({recoveringSoon.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-lg font-semibold mb-4">All Injuries</h4>
              <ScrollArea className="h-[400px]">
                <InjuryList injuries={allInjuries} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovering">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-lg font-semibold mb-4">Recovering Soon</h4>
              <ScrollArea className="h-[400px]">
                <InjuryList injuries={recoveringSoon} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InjuriesPage;
