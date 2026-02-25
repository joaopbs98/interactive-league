"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type LeagueInfo = {
  season?: number;
  total_rounds?: number;
};

type TeamInfo = { id: string; name: string; acronym: string };

type MatchRow = {
  id: string;
  round: number;
  home_team_id: string;
  away_team_id: string;
  match_status: string;
  competition_type?: string;
  group_name?: string;
};

export function ManualScheduleForm({
  leagueId,
  league,
  teams,
  onSuccess,
}: {
  leagueId: string;
  league: LeagueInfo | null;
  teams: TeamInfo[];
  onSuccess: () => void;
}) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [round, setRound] = useState(1);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [competitionType, setCompetitionType] = useState<"domestic" | "ucl" | "uel" | "uecl">("domestic");
  const [groupName, setGroupName] = useState<"A" | "B">("A");
  const [addLoading, setAddLoading] = useState(false);

  const totalRounds =
    league?.total_rounds && league.total_rounds > 0
      ? league.total_rounds
      : Math.max(2, (teams.length - 1) * 2);

  const fetchMatches = async () => {
    if (!leagueId) return;
    try {
      const res = await fetch(
        `/api/league/game?leagueId=${leagueId}&type=schedule&season=${league?.season ?? 1}`
      );
      const json = await res.json();
      setMatches(json.data || []);
    } catch {
      setMatches([]);
    }
  };

  useEffect(() => {
    if (leagueId) fetchMatches();
  }, [leagueId, league?.season]);

  const handleAdd = async () => {
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/league/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          season: league?.season ?? 1,
          round,
          homeTeamId,
          awayTeamId,
          competitionType,
          groupName: competitionType !== "domestic" ? groupName : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHomeTeamId("");
        setAwayTeamId("");
        await fetchMatches();
        onSuccess();
      } else {
        alert(data.error || "Failed to add match");
      }
    } finally {
      setAddLoading(false);
    }
  };

  const matchesInRound = matches.filter((m) => {
    if (m.round !== round || (m.competition_type || "domestic") !== competitionType) return false;
    if (competitionType !== "domestic") return (m.group_name || "A") === groupName;
    return true;
  });
  const scheduledTeamIds = new Set(matchesInRound.flatMap((m) => [m.home_team_id, m.away_team_id]));
  const availableTeams = teams.filter((t) => !scheduledTeamIds.has(t.id));
  const teamsPerRound = competitionType === "domestic" ? teams.length : 6;
  const roundFull = scheduledTeamIds.size >= teamsPerRound;
  const isDuplicateFixture = Boolean(
    homeTeamId &&
    awayTeamId &&
    matchesInRound.some(
      (m) =>
        (m.home_team_id === homeTeamId && m.away_team_id === awayTeamId) ||
        (m.home_team_id === awayTeamId && m.away_team_id === homeTeamId)
    )
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={competitionType}
            onValueChange={(v) => setCompetitionType(v as "domestic" | "ucl" | "uel" | "uecl")}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="domestic">Domestic</SelectItem>
              <SelectItem value="ucl">UCL</SelectItem>
              <SelectItem value="uel">UEL</SelectItem>
              <SelectItem value="uecl">UECL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {competitionType !== "domestic" && (
          <div className="space-y-1">
            <Label className="text-xs">Group</Label>
            <Select value={groupName} onValueChange={(v) => setGroupName(v as "A" | "B")}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Round</Label>
          <Select
            value={String(round)}
            onValueChange={(v) => {
              setRound(parseInt(v, 10));
              setHomeTeamId("");
              setAwayTeamId("");
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Home</Label>
          <Select value={homeTeamId} onValueChange={setHomeTeamId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={roundFull ? "Round full" : "Home team"} />
            </SelectTrigger>
            <SelectContent>
              {availableTeams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
              {availableTeams.length === 0 && (
                <SelectItem value="_none" disabled>
                  No teams available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Away</Label>
          <Select value={awayTeamId} onValueChange={setAwayTeamId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={roundFull ? "Round full" : "Away team"} />
            </SelectTrigger>
            <SelectContent>
              {availableTeams
                .filter((t) => t.id !== homeTeamId)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              {availableTeams.filter((t) => t.id !== homeTeamId).length === 0 && (
                <SelectItem value="_none" disabled>
                  No teams available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleAdd}
          disabled={
            addLoading ||
            !homeTeamId ||
            !awayTeamId ||
            homeTeamId === awayTeamId ||
            teams.length < 2 ||
            roundFull ||
            isDuplicateFixture
          }
          size="sm"
        >
          {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Match"}
        </Button>
      </div>
      {isDuplicateFixture && (
        <p className="text-xs text-amber-500">This fixture already exists in round {round}</p>
      )}
      {roundFull && (
        <p className="text-xs text-muted-foreground">Round {round} is full. Select another round.</p>
      )}
    </div>
  );
}
