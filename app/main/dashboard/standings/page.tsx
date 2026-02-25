"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2 } from "lucide-react";

type Standing = {
  id: string;
  team_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  team: {
    id: string;
    name: string;
    acronym: string;
    logo_url: string | null;
  };
};

export default function StandingsPage() {
  const { selectedLeagueId } = useLeague();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedLeagueId) return;
    fetchStandings();
  }, [selectedLeagueId]);

  const fetchStandings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=standings`);
      const data = await res.json();
      if (data.success) {
        setStandings(data.data || []);
      } else {
        setError(data.error || "Failed to load standings");
      }
    } catch (err) {
      setError("Failed to load standings");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className="p-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">No standings yet</p>
            <p className="text-sm">The host needs to generate a schedule and simulate matchdays first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold">League Standings</h2>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-muted-foreground text-left">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Club</th>
                <th className="p-3 text-center">P</th>
                <th className="p-3 text-center">W</th>
                <th className="p-3 text-center">D</th>
                <th className="p-3 text-center">L</th>
                <th className="p-3 text-center">GF</th>
                <th className="p-3 text-center">GA</th>
                <th className="p-3 text-center">GD</th>
                <th className="p-3 text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 ${
                    i === 0 ? "bg-yellow-900/10" : ""
                  }`}
                >
                  <td className="p-3 text-center font-bold">
                    {i < 1 ? (
                      <Badge variant="default" className="bg-yellow-600 text-xs">{i + 1}</Badge>
                    ) : i < 3 ? (
                      <Badge variant="secondary" className="text-xs">{i + 1}</Badge>
                    ) : (
                      <span className="text-muted-foreground">{i + 1}</span>
                    )}
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    {s.team?.logo_url && (
                      <img src={s.team.logo_url} alt="" className="w-6 h-6 rounded" />
                    )}
                    <span className="font-medium">{s.team?.name || "Unknown"}</span>
                    <span className="text-muted-foreground text-xs">({s.team?.acronym})</span>
                  </td>
                  <td className="p-3 text-center">{s.played}</td>
                  <td className="p-3 text-center text-green-400">{s.wins}</td>
                  <td className="p-3 text-center text-yellow-400">{s.draws}</td>
                  <td className="p-3 text-center text-red-400">{s.losses}</td>
                  <td className="p-3 text-center">{s.goals_for}</td>
                  <td className="p-3 text-center">{s.goals_against}</td>
                  <td className="p-3 text-center font-medium">
                    {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                  </td>
                  <td className="p-3 text-center font-bold text-lg">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
