"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";
import { Trophy, Calendar } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
  competition_type: string | null;
  group_name?: string | null;
  home_score: number | null;
  away_score: number | null;
  match_status: string;
  played_at: string | null;
  home_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
  away_team: { id: string; name: string; acronym: string; logo_url: string | null } | null;
};

type StageOption = { round: number; label: string };

type WinnerEntry = {
  team_id: string;
  count: number;
  team: { name: string; acronym: string; logo_url: string | null };
};

function StandingsTable({ rows }: { rows: Standing[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-muted-foreground text-left text-[11px] uppercase tracking-wider">
          <th className="p-3 w-10 text-center font-medium">#</th>
          <th className="p-3 font-medium">Club</th>
          <th className="p-3 text-center font-medium">P</th>
          <th className="p-3 text-center font-medium">W</th>
          <th className="p-3 text-center font-medium">D</th>
          <th className="p-3 text-center font-medium">L</th>
          <th className="p-3 text-center font-medium">GF</th>
          <th className="p-3 text-center font-medium">GA</th>
          <th className="p-3 text-center font-medium">GD</th>
          <th className="p-3 text-center font-medium">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => (
          <tr
            key={s.id}
            className={`border-b border-border/50 hover:bg-surface-3/60 transition-colors duration-150 ${
              i === 0 ? "bg-gold/[0.06]" : ""
            }`}
          >
            <td className="p-3 text-center font-bold tabular-nums">
              {i < 1 ? (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold bg-gold/15 text-gold">{i + 1}</span>
              ) : i < 3 ? (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold bg-surface-3 text-foreground">{i + 1}</span>
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
            <td className="p-3 text-center tabular-nums">{s.played}</td>
            <td className="p-3 text-center tabular-nums text-status-positive">{s.wins}</td>
            <td className="p-3 text-center tabular-nums text-status-warning">{s.draws}</td>
            <td className="p-3 text-center tabular-nums text-status-negative">{s.losses}</td>
            <td className="p-3 text-center tabular-nums">{s.goals_for}</td>
            <td className="p-3 text-center tabular-nums">{s.goals_against}</td>
            <td className="p-3 text-center font-medium tabular-nums">
              {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
            </td>
            <td className="p-3 text-center font-bold text-lg tabular-nums">{s.points}</td>
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
        <p className="text-lg font-medium mb-2 text-foreground">No {label} standings yet</p>
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

const WINNER_COLUMNS: { key: "ucl" | "uel" | "uecl" | "domestic"; label: string; color: string }[] = [
  { key: "ucl", label: "Most UCL Winners", color: "text-accent" },
  { key: "uel", label: "Most UEL Winners", color: "text-status-warning" },
  { key: "uecl", label: "Most UECL Winners", color: "text-status-positive" },
  { key: "domestic", label: "Most Domestic Champions", color: "text-gold" },
];

export default function StatsPage() {
  const { selectedLeagueId } = useLeague();
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [competitionStandings, setCompetitionStandings] = useState<CompetitionStanding[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [winners, setWinners] = useState<{
    ucl: WinnerEntry[];
    uel: WinnerEntry[];
    uecl: WinnerEntry[];
    domestic: WinnerEntry[];
  } | null>(null);
  const [roundFrom, setRoundFrom] = useState<number | "">("");
  const [roundTo, setRoundTo] = useState<number | "">("");
  const [matchCompetitionFilter, setMatchCompetitionFilter] = useState<string>("all");
  const [selectedStageRound, setSelectedStageRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedLeagueId) {
      setLoading(false);
      return;
    }
    fetchSeasons();
    fetchWinners();
  }, [selectedLeagueId]);

  const fetchWinners = async () => {
    if (!selectedLeagueId) return;
    try {
      const res = await fetch(
        `/api/league/game?leagueId=${selectedLeagueId}&type=competition_winners`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setWinners(data.data);
      } else {
        setWinners(null);
      }
    } catch {
      setWinners(null);
    }
  };

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
      setStandings(data.success ? data.data || [] : []);
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
      setCompetitionStandings(data.success ? data.data || [] : []);
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
      setMatches(data.success ? data.data || [] : []);
    } catch {
      setMatches([]);
    }
  };

  if (!selectedLeagueId) {
    return (
      <div className="p-8 flex flex-col gap-6">
        <Breadcrumbs />
        <PageHeader eyebrow="League" title="History & Stats" />
        <div className="rounded-lg border border-border-strong bg-surface p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2 text-foreground">Select a league and team to continue</p>
          <p className="text-sm">Choose a league from the Saves page to view history and stats.</p>
        </div>
      </div>
    );
  }

  if (loading && seasons.length === 0) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  const compLabel = (ct: string | null) => {
    if (!ct || ct === "domestic") return "";
    const map: Record<string, string> = { ucl: "UCL", uel: "UEL", uecl: "UECL", supercup: "SC" };
    return map[ct] || ct;
  };

  const matchesByCompetition = matches.filter((m) => {
    const ct = m.competition_type ?? "domestic";
    if (matchCompetitionFilter === "all") return true;
    if (matchCompetitionFilter === "domestic") return ct === "domestic" || !m.competition_type;
    return ct === matchCompetitionFilter;
  });

  const isInternationalMatchFilter = ["ucl", "uel", "uecl"].includes(matchCompetitionFilter);
  const stageOptions: StageOption[] = isInternationalMatchFilter
    ? (() => {
        const rounds = [...new Set(matchesByCompetition.map((m) => m.round))].sort((a, b) => a - b);
        return rounds.map((r) => {
          const roundMatches = matchesByCompetition.filter((m) => m.round === r);
          const hasGroup = roundMatches.some((m) => m.group_name);
          if (hasGroup) {
            return { round: r, label: `Group Stage R${r}` };
          }
          const cnt = roundMatches.length;
          const knockoutLabel =
            cnt >= 8 ? "Round of 16" : cnt >= 4 ? "Quarter-finals" : cnt >= 2 ? "Semifinals" : "Final";
          return { round: r, label: knockoutLabel };
        });
      })()
    : [];

  const displayedMatches = matchesByCompetition.filter((m) => {
    if (isInternationalMatchFilter && selectedStageRound != null) {
      return m.round === selectedStageRound;
    }
    if (roundFrom !== "" || roundTo !== "") {
      const from = roundFrom !== "" ? roundFrom : 1;
      const to = roundTo !== "" ? roundTo : 999;
      return m.round >= from && m.round <= to;
    }
    return true;
  });

  return (
    <div className="p-8 flex flex-col gap-6">
      <Breadcrumbs />
      <PageHeader eyebrow="League" title="History & Stats" />

      {error && <p className="text-status-negative text-sm">{error}</p>}

      {/* All-time winners — one panel, four columns, instead of four near-identical cards */}
      {winners && (
        <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-border">
            {WINNER_COLUMNS.map(({ key, label, color }) => {
              const list = winners[key];
              return (
                <div key={key} className="p-4">
                  <h4 className={`text-[11px] font-semibold uppercase tracking-wide mb-2 ${color}`}>{label}</h4>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <div className="space-y-1">
                      {list.slice(0, 3).map((w, i) => (
                        <div key={w.team_id} className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm w-5">{i + 1}.</span>
                          {w.team.logo_url && <img src={w.team.logo_url} alt="" className="w-5 h-5 rounded" />}
                          <span className="font-medium truncate">{w.team.name}</span>
                          <Badge variant="secondary" className="text-xs ml-auto shrink-0">{w.count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
      <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
        <div className="px-6 pt-5 pb-1 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-2xl">Season {selectedSeason} Standings</h2>
        </div>
        <Tabs defaultValue="domestic" className="w-full mt-3">
          <TabsList className="mx-6">
            <TabsTrigger value="domestic">Domestic</TabsTrigger>
            <TabsTrigger value="ucl">UCL</TabsTrigger>
            <TabsTrigger value="uel">UEL</TabsTrigger>
            <TabsTrigger value="uecl">Conference</TabsTrigger>
          </TabsList>
          <TabsContent value="domestic" className="mt-3">
            {standings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2 text-foreground">No domestic standings yet</p>
                <p className="text-sm">Standings will appear after matches are simulated.</p>
              </div>
            ) : (
              <StandingsTable rows={standings} />
            )}
          </TabsContent>
          <TabsContent value="ucl" className="mt-3">
            <CompetitionStandingsContent
              rows={competitionStandings.filter((s) => s.competition_type === "ucl")}
              label="UCL"
            />
          </TabsContent>
          <TabsContent value="uel" className="mt-3">
            <CompetitionStandingsContent
              rows={competitionStandings.filter((s) => s.competition_type === "uel")}
              label="UEL"
            />
          </TabsContent>
          <TabsContent value="uecl" className="mt-3">
            <CompetitionStandingsContent
              rows={competitionStandings.filter((s) => s.competition_type === "uecl")}
              label="Conference League"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Match results history */}
      <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
        <div className="px-6 pt-5 pb-4 flex flex-wrap items-center gap-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-display text-2xl">Season {selectedSeason} Match Results</h2>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select
              value={matchCompetitionFilter}
              onValueChange={(v) => {
                setMatchCompetitionFilter(v);
                setSelectedStageRound(null);
              }}
            >
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue placeholder="Competition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All competitions</SelectItem>
                <SelectItem value="domestic">Domestic</SelectItem>
                <SelectItem value="ucl">UCL</SelectItem>
                <SelectItem value="uel">UEL</SelectItem>
                <SelectItem value="uecl">Conference</SelectItem>
              </SelectContent>
            </Select>
            {isInternationalMatchFilter && stageOptions.length > 0 ? (
              <Select
                value={selectedStageRound != null ? String(selectedStageRound) : "all"}
                onValueChange={(v) => setSelectedStageRound(v === "all" ? null : parseInt(v, 10))}
              >
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {stageOptions.map((s) => (
                    <SelectItem key={s.round} value={String(s.round)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Rounds:</span>
                <Input
                  type="number"
                  placeholder="From"
                  min={1}
                  value={roundFrom}
                  onChange={(e) =>
                    setRoundFrom(e.target.value === "" ? "" : parseInt(e.target.value) || "")
                  }
                  className="w-20 h-8 text-sm"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  placeholder="To"
                  min={1}
                  value={roundTo}
                  onChange={(e) =>
                    setRoundTo(e.target.value === "" ? "" : parseInt(e.target.value) || "")
                  }
                  className="w-20 h-8 text-sm"
                />
                {(roundFrom !== "" || roundTo !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setRoundFrom("");
                      setRoundTo("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {matches.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2 text-foreground">No match results yet</p>
            <p className="text-sm">Results will appear after schedule is generated and matches simulated.</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {displayedMatches
              .filter((m) => m.match_status === "simulated")
              .map((match) => (
                <div
                  key={match.id}
                  className="p-4 flex items-center justify-between hover:bg-surface-3/60 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="font-medium text-right">{match.home_team?.name || "TBD"}</span>
                    {match.home_team?.logo_url && (
                      <img src={match.home_team.logo_url} alt="" className="w-6 h-6 rounded" />
                    )}
                  </div>
                  <div className="mx-6 min-w-[80px] text-center">
                    <span className="text-lg font-bold tabular-nums">
                      {match.home_score} - {match.away_score}
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      R{match.round}{compLabel(match.competition_type) ? ` ${compLabel(match.competition_type)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    {match.away_team?.logo_url && (
                      <img src={match.away_team.logo_url} alt="" className="w-6 h-6 rounded" />
                    )}
                    <span className="font-medium">{match.away_team?.name || "TBD"}</span>
                  </div>
                </div>
              ))}
            {displayedMatches.filter((m) => m.match_status === "simulated").length === 0 &&
              displayedMatches.length > 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No simulated matches yet.</p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
