"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLeague } from "@/contexts/LeagueContext";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
        <tr className="border-b border-border text-muted-foreground text-left text-[11px] uppercase tracking-wider">
          <th className="p-3 w-10 text-center font-medium">#</th>
          <th className="p-3 font-medium">Club</th>
          {formData && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <th className="p-3 text-center cursor-help font-medium">Form</th>
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
          <ColHeader abbr="Pts" full="Points" />
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const formStr = formData?.form?.[s.team_id] ?? "—";
          const isUserTeam = selectedTeamId === s.team_id;
          return (
          <tr
            key={s.id}
            className={`border-b border-border/60 transition-colors duration-150 hover:bg-surface-3/60 ${
              isUserTeam ? "bg-accent-muted hover:bg-accent-muted" : ""
            }`}
          >
            <td className="p-3 text-center font-bold tabular-nums">
              {i === 0 ? (
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
              {leagueId && s.team_id ? (
                <Link
                  href={`/main/dashboard/team/${s.team_id}/squad?league=${leagueId}`}
                  className="font-medium hover:text-accent transition-colors duration-150"
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
                      <span className="font-mono text-xs tabular-nums">
                        {formStr.split("").map((c, j) => (
                          <span
                            key={j}
                            className={
                              c === "W"
                                ? "text-status-positive"
                                : c === "D"
                                  ? "text-status-warning"
                                  : "text-status-negative"
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

  const myRankIdx = domesticRows.findIndex((s) => s.team_id === selectedTeam?.id);
  const myStanding = myRankIdx >= 0 ? domesticRows[myRankIdx] : null;
  const myForm = formData?.form?.[selectedTeam?.id ?? ""] ?? null;

  const renderContent = () => {
    if (competitionType === "domestic") {
      if (domesticRows.length === 0) {
        return (
          <div className="rounded-lg border border-border-strong bg-surface p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2 text-foreground">No league standings yet</p>
            <p className="text-sm">The host needs to generate a schedule and simulate matchdays first.</p>
          </div>
        );
      }
      return (
        <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
          <div className="px-4 pt-4">
            <h2 className="font-display text-2xl">League Table</h2>
          </div>
          <StandingsTable
            rows={domesticRows}
            formData={formData}
            selectedTeamId={selectedTeam?.id}
            leagueId={selectedLeagueId}
          />
        </div>
      );
    }
    if (compRows.length === 0) {
      return (
        <div className="rounded-lg border border-border-strong bg-surface p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2 text-foreground">No {competitionType.toUpperCase()} standings yet</p>
          <p className="text-sm">Group stage standings will appear after international matches are simulated.</p>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
        <div className="p-4 space-y-6">
          {groups.map((groupName) => (
            <div key={groupName}>
              <h4 className="font-display text-xl mb-2">Group {groupName}</h4>
              <StandingsTable rows={byGroup[groupName]} formData={formData} selectedTeamId={selectedTeam?.id} leagueId={selectedLeagueId} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 flex flex-col gap-6">
      <Breadcrumbs />
      <PageHeader eyebrow="League" title="Standings" />

      {error && <p className="text-status-negative text-sm">{error}</p>}

      {/* Your Position — answers "where do I stand" instantly, without scrolling a 20-row table */}
      {myStanding && (
        <div className="relative overflow-hidden rounded-lg border border-border-strong bg-surface p-6 flex flex-wrap items-end gap-x-10 gap-y-4 glow-blue">
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Your Position</p>
            <p className="font-display text-6xl text-accent tabular-nums leading-none">#{myRankIdx + 1}</p>
            <p className="text-xs text-muted-foreground mt-1.5">of {domesticRows.length} clubs</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Points</p>
            <p className="text-2xl font-bold tabular-nums">{myStanding.points}</p>
          </div>
          <div className="relative">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Record</p>
            <p className="text-2xl font-bold tabular-nums">
              <span className="text-status-positive">{myStanding.wins}W</span>{" "}
              <span className="text-status-warning">{myStanding.draws}D</span>{" "}
              <span className="text-status-negative">{myStanding.losses}L</span>
            </p>
          </div>
          {myForm && (
            <div className="relative">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Form (last 5)</p>
              <p className="font-mono text-lg tabular-nums">
                {myForm.split("").map((c, j) => (
                  <span
                    key={j}
                    className={c === "W" ? "text-status-positive" : c === "D" ? "text-status-warning" : "text-status-negative"}
                  >
                    {c}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      )}

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
