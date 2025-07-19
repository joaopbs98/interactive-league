"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";

type TeamStanding = {
  position: number;
  club: string;
  played: number;
  won: number;
  draw: number;
  loss: number;
  gf: number;
  ga: number;
  gd: string;
  points: number;
  form: string[];
};

const MOCK_STANDINGS: TeamStanding[] = [
  {
    position: 1,
    club: "AC Milan",
    played: 22,
    won: 19,
    draw: 2,
    loss: 1,
    gf: 45,
    ga: 12,
    gd: "+33",
    points: 59,
    form: ["W", "W", "W"],
  },
  {
    position: 2,
    club: "Valencia",
    played: 22,
    won: 18,
    draw: 2,
    loss: 2,
    gf: 40,
    ga: 15,
    gd: "+25",
    points: 56,
    form: ["W", "W", "D"],
  },
  {
    position: 3,
    club: "Lazio",
    played: 22,
    won: 16,
    draw: 4,
    loss: 2,
    gf: 38,
    ga: 18,
    gd: "+20",
    points: 52,
    form: ["W", "D", "W"],
  },
  {
    position: 4,
    club: "Feyenoord",
    played: 22,
    won: 15,
    draw: 5,
    loss: 2,
    gf: 36,
    ga: 17,
    gd: "+19",
    points: 50,
    form: ["W", "W", "W"],
  },
  {
    position: 5,
    club: "Leicester City",
    played: 22,
    won: 14,
    draw: 4,
    loss: 4,
    gf: 34,
    ga: 20,
    gd: "+14",
    points: 46,
    form: ["L", "W", "W"],
  },
  {
    position: 6,
    club: "Villarreal",
    played: 22,
    won: 12,
    draw: 6,
    loss: 4,
    gf: 30,
    ga: 22,
    gd: "+8",
    points: 42,
    form: ["W", "D", "L"],
  },
  {
    position: 7,
    club: "Sporting CP",
    played: 22,
    won: 11,
    draw: 5,
    loss: 6,
    gf: 28,
    ga: 25,
    gd: "+3",
    points: 38,
    form: ["D", "W", "L"],
  },
  {
    position: 8,
    club: "Bologna",
    played: 22,
    won: 10,
    draw: 5,
    loss: 7,
    gf: 29,
    ga: 27,
    gd: "+2",
    points: 35,
    form: ["L", "W", "W"],
  },
  {
    position: 9,
    club: "Celta Vigo",
    played: 22,
    won: 9,
    draw: 6,
    loss: 7,
    gf: 27,
    ga: 28,
    gd: "-1",
    points: 33,
    form: ["W", "L", "D"],
  },
  {
    position: 10,
    club: "Everton",
    played: 22,
    won: 8,
    draw: 5,
    loss: 9,
    gf: 25,
    ga: 29,
    gd: "-4",
    points: 29,
    form: ["L", "L", "W"],
  },
  {
    position: 11,
    club: "Burnley",
    played: 22,
    won: 7,
    draw: 5,
    loss: 10,
    gf: 23,
    ga: 31,
    gd: "-8",
    points: 26,
    form: ["W", "D", "L"],
  },
  {
    position: 12,
    club: "Real Sociedad",
    played: 22,
    won: 6,
    draw: 4,
    loss: 12,
    gf: 20,
    ga: 34,
    gd: "-14",
    points: 22,
    form: ["L", "L", "D"],
  },
  {
    position: 13,
    club: "Sampdoria",
    played: 22,
    won: 4,
    draw: 6,
    loss: 12,
    gf: 19,
    ga: 36,
    gd: "-17",
    points: 18,
    form: ["D", "L", "L"],
  },
  {
    position: 14,
    club: "Stoke City",
    played: 22,
    won: 2,
    draw: 4,
    loss: 16,
    gf: 15,
    ga: 42,
    gd: "-27",
    points: 10,
    form: ["L", "D", "L"],
  },
];

const FormBadge = ({ result }: { result: string }) => {
  const color =
    result === "W"
      ? "bg-green-700 text-white"
      : result === "L"
      ? "bg-red-700 text-white"
      : "bg-yellow-500 text-black";
  return <Badge className={color}>{result}</Badge>;
};

const LeagueStandingsPage = () => {
  return (
    <div className="p-8 flex flex-col gap-8">
      <h2 className="text-lg font-semibold">League Table and Positions</h2>

      <Tabs defaultValue="interactive" className="w-full">
        <TabsList className="w-full flex">
          <TabsTrigger value="interactive" className="flex-1">
            Interactive League
          </TabsTrigger>
          <TabsTrigger value="champions" className="flex-1">
            Champions League
          </TabsTrigger>
          <TabsTrigger value="europa" className="flex-1">
            Europa League
          </TabsTrigger>
          <TabsTrigger value="conference" className="flex-1">
            Conference League
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interactive">
          <Card>
            <CardContent className="p-4 overflow-x-auto">
              <h4 className="text-lg font-semibold mb-4">League Standings</h4>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="py-2">#</th>
                    <th>Club</th>
                    <th>Played</th>
                    <th>Won</th>
                    <th>Draw</th>
                    <th>Loss</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Points</th>
                    <th>Form</th>
                    <th>Chart</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_STANDINGS.map((team) => (
                    <tr
                      key={team.position}
                      className="border-b border-neutral-800"
                    >
                      <td className="py-2">{team.position}</td>
                      <td>{team.club}</td>
                      <td>{team.played}</td>
                      <td>{team.won}</td>
                      <td>{team.draw}</td>
                      <td>{team.loss}</td>
                      <td>{team.gf}</td>
                      <td>{team.ga}</td>
                      <td>{team.gd}</td>
                      <td className="font-semibold">{team.points}</td>
                      <td>
                        <div className="flex gap-1">
                          {team.form.map((result, idx) => (
                            <FormBadge key={idx} result={result} />
                          ))}
                        </div>
                      </td>
                      <td>
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LeagueStandingsPage;
