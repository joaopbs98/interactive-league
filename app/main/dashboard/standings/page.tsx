"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLeague } from "@/contexts/LeagueContext";
import { PageSkeleton } from "@/components/PageSkeleton";

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

type CompetitionStanding = Standing & { group_name?: string };

type FormData = {
  form: Record<string, string>;
  h2h: Record<string, Record<string, { w: number; d: number; l: number }>>;
};

const ColHeader = ({ abbr, full }: { abbr: string; full: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <th className="p-3 text-center cursor-help">{abbr}</th>
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

function StandingsTable({
  rows,
  formData,
  selectedTeamId,
  leagueId,
}: {
  rows: Standing[];
  formData: FormData | null;
  selectedTeamId?: string;
  leagueId?: string | null;
}) {
  const getH2hVs = (teamId: string, opponentId: string) => {
    if (!formData?.h2h) return null;
    const pairKey = [teamId, opponentId].sort().join("-");
    const pair = formData.h2h[pairKey];
    if (!pair || !pair[teamId]) return null;
    const s = pair[teamId];
    return `${s.w}-${s.d}-${s.l}`;
  };

  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
    <table className="w-full text-sm min-w-[600px]">
      <thead>
        <tr className="border-b border-neutral-800 text-muted-foreground text-left">
          <th className="p-3 w-10 text-center">#</th>
          <th className="p-3">Club</th>
          {formData && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <th className="p-3 text-center cursor-help">Form</th>
                </TooltipTrigger>
                <TooltipContent>Last 5 results (W=Win, D=Draw, L=Loss)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <ColHeader abbr="P" full="Played" />
          <ColHeader abbr="W" full="Wins" />
          <ColHeader abbr="D" full="Draws" />
          <ColHeader abbr="L" full="Losses" />
          <ColHeader abbr="GF" full="Goals For" />
          <ColHeader abbr="GA" full="Goals Against" />
          <ColHeader abbr="GD" full="Goal Difference" />
          <th className="p-3 text-center font-bold">
            <ColHeader abbr="Pts" full="Points" />
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const formStr = formData?.form?.[s.team_id] ?? "—";
          const isUserTeam = selectedTeamId === s.team_id;
          return (
          <tr
            key={s.id}
            className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 ${
              i === 0 ? "bg-yellow-900/10" : ""
            } ${isUserTeam ? "ring-1 ring-blue-500/50" : ""}`}
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
              {leagueId && s.team_id ? (
                <Link
                  href={`/main/dashboard/team/${s.team_id}/squad?league=${leagueId}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {s.team?.name || "Unknown"}
                </Link>
              ) : (
                <span className="font-medium">{s.team?.name || "Unknown"}</span>
              )}
              <span className="text-muted-foreground text-xs">({s.team?.acronym})</span>
            </td>
            {formData && (
              <td className="p-3 text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono text-xs">
                        {formStr.split("").map((c, j) => (
                          <span
                            key={j}
                            className={
                              c === "W"
                                ? "text-green-400"
                                : c === "D"
                                  ? "text-yellow-400"
                                  : "text-red-400"
                            }
                          >
                            {c}
                          </span>
                        ))}
                        {formStr === "—" ? "—" : ""}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p>Last 5: {formStr || "—"}</p>
                        {formData.h2h && rows.slice(0, 5).some((r) => r.team_id !== s.team_id) && (
                          <p className="text-xs mt-1">H2H vs top 5: {rows.slice(0, 5).filter((r) => r.team_id !== s.team_id).map((r) => {
                            const h = getH2hVs(s.team_id, r.team_id);
                            return h ? `${r.team?.acronym || "?"} ${h}` : null;
                          }).filter(Boolean).join(" · ") || "—"}</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </td>
            )}
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
        );})}
      </tbody>
    </table>
    </div>
  );
}

export default function StandingsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [competitionType, setCompetitionType] = useState<"domestic" | "ucl" | "uel" | "uecl">("domestic");
  const [standings, setStandings] = useState<Standing[]>([]);
  const [competitionStandings, setCompetitionStandings] = useState<CompetitionStanding[]>([]);
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedLeagueId) return;
    fetchStandings();
  }, [selectedLeagueId, competitionType]);

  useEffect(() => {
    if (!selectedLeagueId || competitionType !== "domestic") return;
    fetch(`/api/league/standings/form?leagueId=${selectedLeagueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) setFormData(d.data);
        else setFormData(null);
      })
      .catch(() => setFormData(null));
  }, [selectedLeagueId, competitionType]);

  const fetchStandings = async () => {
    try {
      setLoading(true);
      setError("");
      if (competitionType === "domestic") {
        const res = await fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=standings`);
        const data = await res.json();
        if (data.success) {
          setStandings(data.data || []);
          setCompetitionStandings([]);
        } else {
          setError(data.error || "Failed to load standings");
        }
      } else {
        const res = await fetch(
          `/api/league/game?leagueId=${selectedLeagueId}&type=competition_standings&competitionType=${competitionType}`
        );
        const data = await res.json();
        if (data.success) {
          setCompetitionStandings(data.data || []);
          setStandings([]);
        } else {
          setError(data.error || "Failed to load standings");
        }
      }
    } catch (err) {
      setError("Failed to load standings");
    } finally {
      setLoading(false);
    }
  };

  const domesticRows = standings;
  const compRows = competitionStandings;
  const byGroup = compRows.reduce<Record<string, CompetitionStanding[]>>((acc, s) => {
    const g = s.group_name || "?";
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});
  const groups = Object.keys(byGroup).sort();

  if (loading) {
    return (
      <div className="p-6">
        <PageSkeleton variant="table" rows={14} />
      </div>
    );
  }

  const hasDomestic = domesticRows.length > 0;
  const hasComp = compRows.length > 0;
  const isEmpty = competitionType === "domestic" ? !hasDomestic : !hasComp;

  const renderContent = () => {
    if (competitionType === "domestic") {
      if (domesticRows.length === 0) {
        return (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">No league standings yet</p>
              <p className="text-sm">The host needs to generate a schedule and simulate matchdays first.</p>
            </CardContent>
          </Card>
        );
      }
      return (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-0">
            <StandingsTable
              rows={domesticRows}
              formData={formData}
              selectedTeamId={selectedTeam?.id}
              leagueId={selectedLeagueId}
            />
          </CardContent>
        </Card>
      );
    }
    if (compRows.length === 0) {
      return (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">No {competitionType.toUpperCase()} standings yet</p>
            <p className="text-sm">Group stage standings will appear after international matches are simulated.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-0">
          <div className="p-4 space-y-6">
            {groups.map((groupName) => (
              <div key={groupName}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Group {groupName}</h4>
                <StandingsTable rows={byGroup[groupName]} formData={formData} selectedTeamId={selectedTeam?.id} leagueId={selectedLeagueId} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Standings</h2>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Tabs value={competitionType} onValueChange={(v) => setCompetitionType(v as typeof competitionType)}>
        <TabsList>
          <TabsTrigger value="domestic">Domestic</TabsTrigger>
          <TabsTrigger value="ucl">UCL</TabsTrigger>
          <TabsTrigger value="uel">UEL</TabsTrigger>
          <TabsTrigger value="uecl">UECL</TabsTrigger>
        </TabsList>
        <TabsContent value="domestic" className="mt-4">{renderContent()}</TabsContent>
        <TabsContent value="ucl" className="mt-4">{renderContent()}</TabsContent>
        <TabsContent value="uel" className="mt-4">{renderContent()}</TabsContent>
        <TabsContent value="uecl" className="mt-4">{renderContent()}</TabsContent>
      </Tabs>
    </div>
  );
}
