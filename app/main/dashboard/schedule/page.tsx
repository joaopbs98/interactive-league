"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarPop } from "@/components/calendarPop";
import Image from "next/image";
import { Images } from "@/lib/assets";
import { Badge } from "@/components/ui/badge";

type Match = {
  date: string;
  homeClub: string;
  homeLogo: any;
  homeScore: number;
  awayClub: string;
  awayLogo: any;
  awayScore: number;
};

type Competition = {
  key: string;
  label: string;
  matches: Match[];
};

const COMPETITIONS: Competition[] = [
  {
    key: "interactive",
    label: "Interactive League",
    matches: [
      {
        date: "2025-07-11",
        homeClub: "SL Benfica",
        homeLogo: Images.Benfica,
        homeScore: 2,
        awayClub: "FC Porto",
        awayLogo: Images.Benfica,
        awayScore: 1,
      },
      {
        date: "2025-07-12",
        homeClub: "Sporting CP",
        homeLogo: Images.Benfica,
        homeScore: 3,
        awayClub: "SL Benfica",
        awayLogo: Images.Benfica,
        awayScore: 2,
      },
      {
        date: "2025-07-12",
        homeClub: "Sporting CP",
        homeLogo: Images.Benfica,
        homeScore: 3,
        awayClub: "SL Benfica",
        awayLogo: Images.Benfica,
        awayScore: 2,
      },
      {
        date: "2025-07-12",
        homeClub: "Sporting CP",
        homeLogo: Images.Benfica,
        homeScore: 3,
        awayClub: "SL Benfica",
        awayLogo: Images.Benfica,
        awayScore: 2,
      },
      {
        date: "2025-07-12",
        homeClub: "Sporting CP",
        homeLogo: Images.Benfica,
        homeScore: 3,
        awayClub: "SL Benfica",
        awayLogo: Images.Benfica,
        awayScore: 2,
      },
    ],
  },
  {
    key: "champions",
    label: "Champions League",
    matches: [
      {
        date: "2025-07-13",
        homeClub: "Real Madrid",
        homeLogo: Images.Benfica,
        homeScore: 1,
        awayClub: "Bayern München",
        awayLogo: Images.Benfica,
        awayScore: 1,
      },
      {
        date: "2025-07-14",
        homeClub: "Liverpool",
        homeLogo: Images.Benfica,
        homeScore: 0,
        awayClub: "Manchester City",
        awayLogo: Images.Benfica,
        awayScore: 2,
      },
    ],
  },
  {
    key: "europa",
    label: "Europa League",
    matches: [
      {
        date: "2025-07-15",
        homeClub: "Atalanta",
        homeLogo: Images.Benfica,
        homeScore: 2,
        awayClub: "Roma",
        awayLogo: Images.Benfica,
        awayScore: 0,
      },
      {
        date: "2025-07-16",
        homeClub: "Lazio",
        homeLogo: Images.Benfica,
        homeScore: 1,
        awayClub: "Inter Milan",
        awayLogo: Images.Benfica,
        awayScore: 3,
      },
    ],
  },
  {
    key: "conference",
    label: "Conference League",
    matches: [
      {
        date: "2025-07-17",
        homeClub: "West Ham United",
        homeLogo: Images.Benfica,
        homeScore: 2,
        awayClub: "Feyenoord",
        awayLogo: Images.Benfica,
        awayScore: 2,
      },
      {
        date: "2025-07-18",
        homeClub: "Roma",
        homeLogo: Images.Benfica,
        homeScore: 1,
        awayClub: "Marseille",
        awayLogo: Images.Benfica,
        awayScore: 1,
      },
    ],
  },
  {
    key: "supercup",
    label: "SuperCup",
    matches: [
      {
        date: "2025-07-19",
        homeClub: "Liverpool",
        homeLogo: Images.Benfica,
        homeScore: 1,
        awayClub: "Chelsea",
        awayLogo: Images.Benfica,
        awayScore: 0,
      },
    ],
  },
];

const page = () => {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    new Date()
  );

  return (
    <div className="p-8 flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Schedule</h2>
        <div className="flex items-center gap-4">
          <CalendarPop />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        </div>
      </header>

      <Tabs defaultValue="interactive" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          {COMPETITIONS.map((comp) => (
            <TabsTrigger
              key={comp.key}
              value={comp.key}
              className="text-center"
            >
              {comp.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex gap-4">
          {COMPETITIONS.map((comp) => (
            <TabsContent key={comp.key} value={comp.key}>
              <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 px-8 shadow-sm">
                {comp.matches.map((m, idx) => (
                  <Card key={idx} className="flex">
                    <CardContent className="w-32 text-gray-500">
                      {new Date(m.date).toLocaleDateString()}
                    </CardContent>
                    <CardContent className="flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Image
                          src={m.homeLogo}
                          alt={m.homeClub}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                        <span>{m.homeClub}</span>
                      </div>
                      <span className="font-bold">
                        {m.homeScore} – {m.awayScore}
                      </span>
                      <div className="flex items-center gap-2">
                        <Image
                          src={m.awayLogo}
                          alt={m.awayClub}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                        <span>{m.awayClub}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}

          <div className="w-2/5 flex flex-col gap-4">
            <Card className="justify-center h-fit px-8 py-10">
              <p className="font-bold text-xl">Best Players of the Season</p>
              <div className="flex flex-col gap-4 p-4 border border-neutral-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-4 w-full">
                    <div className="flex gap-2 justify-center">
                      <p className="font-semibold whitespace-nowrap">
                        João Neves
                      </p>
                      <Badge className="bg-green-800 text-white">84</Badge>
                    </div>
                    <div className="flex justify-between mx-4">
                      {[
                        { label: "Goals", value: 1 },
                        { label: "Assists", value: 2 },
                        { label: "Average", value: 9.8 },
                      ].map((stat, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center gap-2"
                        >
                          <p className="text-neutral-300">{stat.label}</p>
                          <Badge>{stat.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Image
                    src={Images.Benfica}
                    height={100}
                    width={100}
                    alt="Logo"
                  />
                  <Image
                    src={Images.JN}
                    height={100}
                    width={100}
                    alt="Avatar"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4 p-4 border border-neutral-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-4 w-full">
                    <div className="flex gap-2 justify-center">
                      <p className="font-semibold whitespace-nowrap">
                        João Neves
                      </p>
                      <Badge className="bg-green-800 text-white">84</Badge>
                    </div>
                    <div className="flex justify-between mx-4">
                      {[
                        { label: "Goals", value: 1 },
                        { label: "Assists", value: 2 },
                        { label: "Average", value: 9.8 },
                      ].map((stat, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center gap-2"
                        >
                          <p className="text-neutral-300">{stat.label}</p>
                          <Badge>{stat.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Image
                    src={Images.Benfica}
                    height={100}
                    width={100}
                    alt="Logo"
                  />
                  <Image
                    src={Images.JN}
                    height={100}
                    width={100}
                    alt="Avatar"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4 p-4 border border-neutral-800 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-4 w-full">
                    <div className="flex gap-2 justify-center">
                      <p className="font-semibold whitespace-nowrap">
                        João Neves
                      </p>
                      <Badge className="bg-green-800 text-white">84</Badge>
                    </div>
                    <div className="flex justify-between mx-4">
                      {[
                        { label: "Goals", value: 1 },
                        { label: "Assists", value: 2 },
                        { label: "Average", value: 9.8 },
                      ].map((stat, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col items-center gap-2"
                        >
                          <p className="text-neutral-300">{stat.label}</p>
                          <Badge>{stat.value}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Image
                    src={Images.Benfica}
                    height={100}
                    width={100}
                    alt="Logo"
                  />
                  <Image
                    src={Images.JN}
                    height={100}
                    width={100}
                    alt="Avatar"
                  />
                </div>
              </div>
            </Card>
            <Card className="flex flex-col items-center bg-none border-none">
              <h2 className="font-bold text-xl">Ranking</h2>
              <Button
                variant={"outline"}
                className="w-full flex flex-col h-fit font-mono"
              >
                <Image
                  src={Images.logo2}
                  height={60}
                  width={120}
                  alt="logo"
                  className="object-cover"
                ></Image>
                Check HOF Points
              </Button>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  );
};

export default page;
