"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, Trophy, Calendar } from "lucide-react";

type Standing = {
  id: string;
  team_id: string;
  season: number;
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

type CompetitionStanding = Standing & {
  competition_type: string;
  group_name: string;
};

type Match = {
  id: string;
  round: number;
  season: number;
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  played_at: string | null;
  home_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
  away_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
};

function StandingsTable({ rows }: { rows: Standing[] }) {
  return (
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
        {rows.map((s, i) => (
          <tr
            key={s.id}
            className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 ${
              i === 0 ? "bg-yellow-900/10" : ""
            }`}
          >
            <td className="p-3 text-center font-bold">
              {i < 1 ? (
                <Badge variant="default" className="bg-yellow-600 text-xs">
                  {i + 1}
                </Badge>
              ) : i < 3 ? (
                <Badge variant="secondary" className="text-xs">
                  {i + 1}
                </Badge>
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
  );
}

function CompetitionStandingsContent({
  rows,
  label,
}: {
  rows: CompetitionStanding[];
  label: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-2">No {label} standings yet</p>
        <p className="text-sm">Group stage standings will appear after international matches are simulated.</p>
      </div>
    );
  }
  const byGroup = rows.reduce<Record<string, CompetitionStanding[]>>((acc, s) => {
    const g = s.group_name || "?";
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});
  const groups = Object.keys(byGroup).sort();
  return (
    <div className="space-y-6 p-4">
      {groups.map((groupName) => (
        <div key={groupName}>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">Group {groupName}</h4>
          <StandingsTable rows={byGroup[groupName]} />
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { selectedLeagueId } = useLeague();
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [competitionStandings, setCompetitionStandings] = useState<CompetitionStanding[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedLeagueId) {
      setLoading(false);
      return;
    }
    fetchSeasons();
  }, [selectedLeagueId]);

  const fetchSeasons = async () => {
    if (!selectedLeagueId) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=league_info`);
      const data = await res.json();
      if (data.success && data.data) {
        const currentSeason = data.data.season ?? 1;
        const seasonList = Array.from({ length: currentSeason }, (_, i) => i + 1).reverse();
        setSeasons(seasonList);
        setSelectedSeason(currentSeason);
      } else {
        setSeasons([]);
      }
    } catch (err) {
      setError("Failed to load league info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedLeagueId || !selectedSeason) return;
    fetchStandings();
    fetchCompetitionStandings();
    fetchSchedule();
  }, [selectedLeagueId, selectedSeason]);

  const fetchStandings = async () => {
    if (!selectedLeagueId || !selectedSeason) return;
    try {
      const res = await fetch(
        `/api/league/game?leagueId=${selectedLeagueId}&type=standings&season=${selectedSeason}`
      );
      const data = await res.json();
      if (data.success) {
        setStandings(data.data || []);
      } else {
        setStandings([]);
      }
    } catch {
      setStandings([]);
    }
  };

  const fetchCompetitionStandings = async () => {
    if (!selectedLeagueId || !selectedSeason) return;
    try {
      const res = await fetch(
        `/api/league/game?leagueId=${selectedLeagueId}&type=competition_standings&season=${selectedSeason}`
      );
      const data = await res.json();
      if (data.success) {
        setCompetitionStandings(data.data || []);
      } else {
        setCompetitionStandings([]);
      }
    } catch {
      setCompetitionStandings([]);
    }
  };

  const fetchSchedule = async () => {
    if (!selectedLeagueId || !selectedSeason) return;
    try {
      const res = await fetch(
        `/api/league/game?leagueId=${selectedLeagueId}&type=schedule&season=${selectedSeason}`
      );
      const data = await res.json();
      if (data.success) {
        setMatches(data.data || []);
      } else {
        setMatches([]);
      }
    } catch {
      setMatches([]);
    }
  };

  if (!selectedLeagueId) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">History & Stats</h2>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Select a league and team to continue</p>
            <p className="text-sm">Choose a league from the Saves page to view history and stats.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && seasons.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold">History & Stats</h2>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* Season selector */}
      {seasons.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Season:</span>
          {seasons.map((s) => (
            <Badge
              key={s}
              variant={selectedSeason === s ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedSeason(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
      )}

      {/* Standings with Domestic / UCL / UEL / Conference tabs */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-0">
          <div className="p-4 border-b border-neutral-800 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Season {selectedSeason} Standings</h3>
          </div>
          <Tabs defaultValue="domestic" className="w-full">
            <TabsList className="m-4 mb-0 rounded-lg bg-neutral-800/50">
              <TabsTrigger value="domestic">Domestic</TabsTrigger>
              <TabsTrigger value="ucl">UCL</TabsTrigger>
              <TabsTrigger value="uel">UEL</TabsTrigger>
              <TabsTrigger value="uecl">Conference</TabsTrigger>
            </TabsList>
            <TabsContent value="domestic" className="mt-0">
              {standings.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-2">No domestic standings yet</p>
                  <p className="text-sm">Standings will appear after matches are simulated.</p>
                </div>
              ) : (
                <StandingsTable rows={standings} />
              )}
            </TabsContent>
            <TabsContent value="ucl" className="mt-0">
              <CompetitionStandingsContent
                rows={competitionStandings.filter((s) => s.competition_type === "ucl")}
                label="UCL"
              />
            </TabsContent>
            <TabsContent value="uel" className="mt-0">
              <CompetitionStandingsContent
                rows={competitionStandings.filter((s) => s.competition_type === "uel")}
                label="UEL"
              />
            </TabsContent>
            <TabsContent value="uecl" className="mt-0">
              <CompetitionStandingsContent
                rows={competitionStandings.filter((s) => s.competition_type === "uecl")}
                label="Conference League"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Match results history */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-0">
          <div className="p-4 border-b border-neutral-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Season {selectedSeason} Match Results</h3>
          </div>
          {matches.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">No match results yet</p>
              <p className="text-sm">Results will appear after schedule is generated and matches simulated.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800 max-h-[400px] overflow-y-auto">
              {matches
                .filter((m) => m.match_status === "simulated")
                .map((match) => (
                  <div
                    key={match.id}
                    className="p-4 flex items-center justify-between hover:bg-neutral-800/30"
                  >
                    <div className="flex items-center gap-3 flex-1 justify-end">
                      <span className="font-medium text-right">{match.home_team?.name || "TBD"}</span>
                      {match.home_team?.logo_url && (
                        <img src={match.home_team.logo_url} alt="" className="w-6 h-6 rounded" />
                      )}
                    </div>
                    <div className="mx-6 min-w-[80px] text-center">
                      <span className="text-lg font-bold">
                        {match.home_score} - {match.away_score}
                      </span>
                      <span className="text-xs text-muted-foreground block">R{match.round}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      {match.away_team?.logo_url && (
                        <img src={match.away_team.logo_url} alt="" className="w-6 h-6 rounded" />
                      )}
                      <span className="font-medium">{match.away_team?.name || "TBD"}</span>
                    </div>
                  </div>
                ))}
              {matches.filter((m) => m.match_status === "simulated").length === 0 &&
                matches.length > 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="text-sm">No simulated matches yet.</p>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
