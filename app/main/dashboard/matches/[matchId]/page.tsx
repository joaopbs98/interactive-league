"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, CircleDot, Clock3, Loader2, Map, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FormationPitch } from "@/components/matches/FormationPitch";
import { PlayerAnalysisSheet, type AnalyticalPlayerLine } from "@/components/matches/PlayerAnalysisSheet";

type Team = { id: string; name: string; acronym: string; logo_url?: string | null };
type TeamStats = Record<string, number | string | object> & { team_id: string; possession: number; shots: number; shots_on_target: number; xg: number; xgot?: number; field_tilt?: number; passes: number; completed_passes: number; corners: number; fouls: number; offsides: number; saves: number };
type Event = { id: string; minute: number; team_id: string; player_id?: string | null; event_type: string; metadata?: Record<string, unknown>; player?: { player_name: string } | null; secondary_player?: { player_name: string } | null };
type Detail = {
  provenance: "simulated" | "manual" | "manual_constrained" | "legacy"; engineVersion?: string; calibrationVersion?: string;
  match: { id: string; season: number; round: number; competition_type?: string | null; group_name?: string | null; home_score: number; away_score: number; home_team: Team; away_team: Team };
  events: Event[]; teamStats: TeamStats[]; playerStats: AnalyticalPlayerLine[];
  formations?: Record<string, { tactic?: { formation?: string; assignments?: Array<{ slotIndex: number; slotPosition: string; playerId: string }> } }>;
};
type Tab = "overview" | "lineups" | "statistics" | "momentum";

const eventVisual: Record<string, string> = { goal: "⚽", penalty_goal: "⚽", own_goal: "⚽", yellow_card: "■", red_card: "■", injury: "✚", substitution: "↕" };
const competitionLabel = (value?: string | null) => !value || value === "domestic" ? "Domestic league" : value === "supercup" ? "Super Cup" : value.toUpperCase();
const number = (input: unknown) => Number(input || 0);
const enrichTeamStats = (row?: TeamStats): (TeamStats & { pass_accuracy: number }) | undefined => row ? {
  ...row,
  pass_accuracy: number(row.passes) ? number(row.completed_passes) / number(row.passes) * 100 : 0,
} : undefined;
const ratingColor = (rating: number) => rating >= 8
  ? "border-transparent bg-status-positive text-white"
  : rating >= 7
    ? "border-transparent bg-emerald-600 text-white"
    : rating >= 6
      ? "border-transparent bg-status-warning text-black"
      : "border-transparent bg-status-negative text-white";

function TeamMark({ team, large = false }: { team: Team; large?: boolean }) {
  const size = large ? "h-16 w-16 md:h-20 md:w-20" : "h-8 w-8";
  return team.logo_url ? <img src={team.logo_url} alt={`${team.name} badge`} className={`${size} object-contain`} /> : <div className={`${size} flex items-center justify-center rounded-lg bg-surface-3 text-xs font-semibold`}>{team.acronym}</div>;
}

function ComparisonRow({ label, home, away, format = (value) => String(value) }: { label: string; home: number; away: number; format?: (value: number) => string }) {
  const total = Math.max(1, home + away);
  return <div className="space-y-1.5">
    <div className="grid grid-cols-[1fr_auto_1fr] items-baseline text-sm"><span className="font-mono font-semibold">{format(home)}</span><span className="px-3 text-xs text-muted-foreground">{label}</span><span className="text-right font-mono font-semibold">{format(away)}</span></div>
    <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-3"><span className="bg-accent" style={{ width: `${home / total * 100}%` }} /><span className="bg-muted-foreground/45" style={{ width: `${away / total * 100}%` }} /></div>
  </div>;
}

function MomentumChart({ events, homeId }: { events: Event[]; homeId: string }) {
  const bars = Array.from({ length: 30 }, (_, index) => {
    const start = index * 3;
    const nearby = events.filter((event) => event.minute >= start && event.minute < start + 3);
    return nearby.reduce((sum, event) => {
      const weight = event.event_type === "goal" ? 4
        : event.event_type === "shot" ? 1 + number(event.metadata?.xg) * 3
          : event.event_type === "save" ? 0.45 : 0;
      return sum + weight * (event.team_id === homeId ? 1 : -1);
    }, 0);
  });
  return <div className="flex h-48 items-center gap-1" aria-label="Match momentum">
    {bars.map((bar, index) => <span key={index} className={`w-full rounded-sm ${bar >= 0 ? "bg-accent" : "bg-muted-foreground/50"}`} style={{ height: `${Math.max(4, Math.abs(bar) * 18)}px`, transform: `translateY(${bar >= 0 ? -Math.max(2, Math.abs(bar) * 9) : Math.max(2, Math.abs(bar) * 9)}px)` }} />)}
  </div>;
}

export default function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const searchParams = useSearchParams();
  const leagueId = searchParams.get("league");
  const returnSeason = searchParams.get("season");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedPlayer, setSelectedPlayer] = useState<AnalyticalPlayerLine | null>(null);

  useEffect(() => {
    if (!matchId || !leagueId) return;
    fetch(`/api/league/game?leagueId=${leagueId}&type=match_detail&matchId=${matchId}`)
      .then((response) => response.json())
      .then((payload) => { if (!payload.success) throw new Error(payload.error || "Could not load match"); setDetail(payload.data); })
      .catch((reason) => setError(reason.message || "Could not load match"));
  }, [leagueId, matchId]);

  const stats = useMemo(() => !detail ? null : ({
    home: enrichTeamStats(detail.teamStats.find((row) => row.team_id === detail.match.home_team.id)),
    away: enrichTeamStats(detail.teamStats.find((row) => row.team_id === detail.match.away_team.id)),
  }), [detail]);

  if (error) return <div className="p-6 text-status-negative">{error}</div>;
  if (!detail) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  const { match } = detail;
  const events = detail.events.filter((event) => eventVisual[event.event_type]);
  const homePlayers = detail.playerStats.filter((line) => line.team_id === match.home_team.id && line.minutes > 0);
  const awayPlayers = detail.playerStats.filter((line) => line.team_id === match.away_team.id && line.minutes > 0);
  const topPlayers = [...detail.playerStats].filter((line) => line.minutes > 0).sort((a, b) => b.rating - a.rating).slice(0, 5);
  const scheduleHref = `/main/dashboard/schedule?league=${leagueId}${returnSeason ? `&season=${returnSeason}` : ""}`;
  const sourceLabel = detail.provenance === "manual_constrained" ? "Synthetic analytics · manual score" : detail.engineVersion === "fc25-il-2" ? "Adaptive simulation · v2" : detail.provenance === "manual" ? "Manual result" : "Legacy simulation";

  const statRows: Array<[string, string, (value: number) => string]> = [
    ["Possession", "possession", (v) => `${v.toFixed(0)}%`], ["Field tilt", "field_tilt", (v) => `${v.toFixed(0)}%`],
    ["Expected goals", "xg", (v) => v.toFixed(2)], ["xG on target", "xgot", (v) => v.toFixed(2)],
    ["Shots", "shots", String], ["Shots on target", "shots_on_target", String], ["Big chances", "big_chances", String],
    ["Passes", "passes", String], ["Pass accuracy", "pass_accuracy", (v) => `${v.toFixed(0)}%`],
    ["Passes · own third", "passes_own_third", String], ["Passes · middle third", "passes_middle_third", String],
    ["Passes · final third", "passes_final_third", String], ["Progressive passes", "progressive_passes", String],
    ["Long balls", "long_balls", String], ["Accurate long balls", "completed_long_balls", String],
    ["Crosses", "crosses", String], ["Accurate crosses", "completed_crosses", String],
    ["Carries", "carries", String], ["Successful dribbles", "successful_dribbles", String], ["Pressures", "pressures", String],
    ["Tackles", "tackles", String], ["Interceptions", "interceptions", String], ["Recoveries", "recoveries", String],
    ["Blocks", "blocks", String], ["Clearances", "clearances", String], ["Duels won", "duels_won", String],
    ["Aerial duels won", "aerial_duels_won", String], ["Fouls", "fouls", String],
    ["Yellow cards", "yellow_cards", String], ["Red cards", "red_cards", String],
    ["Offsides", "offsides", String], ["Corners", "corners", String], ["Saves", "saves", String],
  ];

  return <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
    <Breadcrumbs lastLabel={`${match.home_team.acronym} vs ${match.away_team.acronym}`} />
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs text-muted-foreground">{competitionLabel(match.competition_type)} · Season {match.season} · Round {match.round}</p><h1 className="mt-1 text-xl font-semibold">Match analysis</h1></div>
      <Link href={scheduleHref}><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Schedule</Button></Link>
    </div>

    <section className="overflow-hidden rounded-2xl border border-border-strong bg-surface">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-7 md:gap-12 md:px-10">
        {[match.home_team, match.away_team].map((team, index) => <div key={team.id} className={`row-start-1 flex min-w-0 flex-col items-center gap-3 ${index === 0 ? "col-start-1 md:items-end" : "col-start-3 md:items-start"}`}><TeamMark team={team} large /><p className="max-w-full truncate text-center font-semibold md:text-lg">{team.name}</p></div>)}
        <div className="col-start-2 row-start-1 flex flex-col items-center"><div className="font-mono text-4xl font-bold tabular-nums md:text-6xl">{match.home_score}<span className="mx-3 text-muted-foreground">–</span>{match.away_score}</div><p className="mt-2 text-xs text-muted-foreground">Full time</p></div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border bg-surface-2 px-4 py-2.5 text-xs text-muted-foreground"><Badge variant="outline">{sourceLabel}</Badge>{match.group_name && <span>{match.group_name}</span>}</div>
    </section>

    <nav className="sticky top-0 z-20 flex overflow-x-auto rounded-xl border border-border bg-background/95 p-1 backdrop-blur" aria-label="Match analysis sections">
      {([
        ["overview", CircleDot], ["lineups", Users], ["statistics", BarChart3], ["momentum", Map],
      ] as const).map(([tab, Icon]) => <button key={tab} onClick={() => setActiveTab(tab)} className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${activeTab === tab ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{tab}</button>)}
    </nav>

    {(detail.provenance === "manual" || detail.playerStats.length === 0) && <Card><CardContent className="py-10 text-center"><Clock3 className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="font-medium">Detailed analytics are unavailable</p><p className="mt-1 text-sm text-muted-foreground">This match predates the analytical engine or was saved without a detailed report.</p></CardContent></Card>}

    {detail.playerStats.length > 0 && activeTab === "overview" && <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <Card><CardHeader><CardTitle className="text-base">Match flow</CardTitle></CardHeader><CardContent>
        {events.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No notable events.</p> : <div>{events.map((event) => { const home = event.team_id === match.home_team.id; return <div key={event.id} className="grid grid-cols-[1fr_54px_1fr] items-center gap-2 border-t border-border/60 py-3 first:border-0"><div className={`text-sm ${home ? "text-right" : "text-muted-foreground"}`}>{home && <button onClick={() => setSelectedPlayer(detail.playerStats.find((line) => line.player_id === event.player_id) || null)}>{event.player?.player_name}</button>}</div><div className="text-center"><span className={event.event_type === "red_card" ? "text-status-negative" : event.event_type === "yellow_card" ? "text-status-warning" : ""}>{eventVisual[event.event_type]}</span><span className="block font-mono text-[11px] text-muted-foreground">{event.minute}&apos;</span></div><div className={`text-sm ${!home ? "" : "text-muted-foreground"}`}>{!home && <button onClick={() => setSelectedPlayer(detail.playerStats.find((line) => line.player_id === event.player_id) || null)}>{event.player?.player_name}</button>}</div></div>; })}</div>}
      </CardContent></Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Top performers</CardTitle></CardHeader><CardContent className="space-y-1">{topPlayers.map((line, index) => <button key={line.player_id} onClick={() => setSelectedPlayer(line)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{line.player?.player_name || line.player_id}</p><p className="text-xs text-muted-foreground">{line.goals} goals · {line.assists} assists · {line.minutes}&apos;</p></div><Badge className={ratingColor(line.rating)}>{line.rating.toFixed(1)}</Badge></button>)}</CardContent></Card>
        {stats?.home && stats.away && <Card><CardHeader><CardTitle className="text-base">Match snapshot</CardTitle></CardHeader><CardContent className="space-y-4">{statRows.slice(0, 5).map(([label, key, format]) => <ComparisonRow key={key} label={label} home={number(stats.home?.[key])} away={number(stats.away?.[key])} format={format} />)}</CardContent></Card>}
      </div>
    </div>}

    {detail.playerStats.length > 0 && activeTab === "lineups" && <div className="grid gap-4 xl:grid-cols-2">
      {[[match.home_team, homePlayers], [match.away_team, awayPlayers]].map(([team, players]) => {
        const typedTeam = team as Team; const typedPlayers = players as AnalyticalPlayerLine[];
        const tacticalSnapshot = detail.formations?.[typedTeam.id]?.tactic;
        const starters = typedPlayers.filter((line) => line.starter);
        return <Card key={typedTeam.id}><CardHeader className="flex-row items-center gap-3"><TeamMark team={typedTeam} /><div className="min-w-0 flex-1"><CardTitle className="truncate text-base">{typedTeam.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{tacticalSnapshot?.formation || "4-3-3"} · Starting XI {starters.length}/11</p></div></CardHeader><CardContent><FormationPitch players={typedPlayers} formation={tacticalSnapshot?.formation} assignments={tacticalSnapshot?.assignments} onSelect={setSelectedPlayer} /><div className="mt-4 space-y-1"><p className="pb-1 text-xs font-semibold text-muted-foreground">Substitutes</p>{typedPlayers.filter((line) => !line.starter).map((line) => <button key={line.player_id} onClick={() => setSelectedPlayer(line)} className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-surface-2"><span>{line.player?.player_name || line.player_id} <span className="text-muted-foreground">· {line.minutes}&apos;</span></span><Badge className={ratingColor(line.rating)}>{line.rating.toFixed(1)}</Badge></button>)}</div></CardContent></Card>;
      })}
    </div>}

    {detail.playerStats.length > 0 && activeTab === "statistics" && stats?.home && stats.away && <div className="grid gap-4 lg:grid-cols-[1fr_.85fr]">
      <Card><CardHeader><CardTitle className="text-base">Team statistics</CardTitle></CardHeader><CardContent className="space-y-5">{statRows.map(([label, key, format]) => <ComparisonRow key={key} label={label} home={number(stats.home?.[key])} away={number(stats.away?.[key])} format={format} />)}</CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Shot quality</CardTitle></CardHeader><CardContent className="space-y-5"><ComparisonRow label="xG" home={number(stats.home.xg)} away={number(stats.away.xg)} format={(v) => v.toFixed(2)} /><ComparisonRow label="xG on target" home={number(stats.home.xgot)} away={number(stats.away.xgot)} format={(v) => v.toFixed(2)} /><ComparisonRow label="Big chances" home={number(stats.home.big_chances)} away={number(stats.away.big_chances)} /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Passing territory</CardTitle></CardHeader><CardContent className="space-y-5"><ComparisonRow label="Own third" home={number(stats.home.passes_own_third)} away={number(stats.away.passes_own_third)} /><ComparisonRow label="Middle third" home={number(stats.home.passes_middle_third)} away={number(stats.away.passes_middle_third)} /><ComparisonRow label="Final third" home={number(stats.home.passes_final_third)} away={number(stats.away.passes_final_third)} /><p className="text-xs text-muted-foreground">Counts come from the phase and location of every attempted pass—not a visual estimate.</p></CardContent></Card></div>
    </div>}

    {detail.playerStats.length > 0 && activeTab === "momentum" && <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><Card><CardHeader><CardTitle className="text-base">Match momentum</CardTitle></CardHeader><CardContent><MomentumChart events={detail.events} homeId={match.home_team.id} /><div className="flex justify-between text-xs text-muted-foreground"><span>{match.home_team.acronym}</span><span>90&apos;</span><span>{match.away_team.acronym}</span></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">How to read this</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Bars above the line show periods controlled by {match.home_team.name}; bars below show {match.away_team.name}.</p><p>Shots, dangerous transitions and goals carry more weight than harmless possession.</p><p>Open a player from the lineup or performers list for their complete analytical report.</p></CardContent></Card></div>}

    <PlayerAnalysisSheet line={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
  </div>;
}
