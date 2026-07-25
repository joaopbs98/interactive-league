"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, Play, RotateCcw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";

type Team = { id: string; name: string; acronym?: string; logo_url?: string | null };
type Fixture = { id: string; round: number; match_status: string; home_score?: number | null; away_score?: number | null; home_team: Team; away_team: Team };
type PlayerLine = { playerId: string; playerName: string; teamId: string; starter: boolean; position?: string; minutes: number; rating: number; goals: number; assists: number; shots: number; shotsOnTarget: number; keyPasses: number; passes: number; completedPasses: number; tackles: number; interceptions: number; fouls: number; yellowCards: number; redCards: number; saves: number };
type MatchEvent = { type: string; minute: number; teamId: string; playerName?: string; secondaryPlayerName?: string; metadata?: { secondYellow?: boolean } };
type PreviewMatch = { matchId: string; homeTeamId: string; awayTeamId: string; homeTeamName: string; awayTeamName: string; homeScore: number; awayScore: number; events: MatchEvent[]; playerStats: PlayerLine[]; teamStats: { home: Record<string, number>; away: Record<string, number> } };
type Preview = { id: string; attempt: number; rerolls_remaining?: number; output_snapshot: { matches: PreviewMatch[]; warnings?: string[] } };
type LeagueInfo = { season: number; current_round: number; total_rounds: number; status: string; is_host: boolean };

const eventIcon = (event: MatchEvent) => event.type === "goal" ? "⚽" : event.type === "yellow_card" ? "🟨" : event.type === "red_card" ? "🟥" : event.type === "injury" ? "✚" : event.type === "substitution" ? "↕" : "•";
const ratingTone = (rating: number) => rating >= 8 ? "text-emerald-400" : rating >= 7 ? "text-lime-400" : rating >= 6 ? "text-amber-300" : "text-orange-400";

function TeamMark({ team, align }: { team: Team; align: "left" | "right" }) {
  const badge = team.logo_url
    ? <img src={team.logo_url} alt="" className="h-9 w-9 shrink-0 object-contain" />
    : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs font-bold">{team.acronym}</div>;

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${align === "right" ? "justify-end" : ""}`}>
      {align === "left" && badge}
      <p className={`${align === "right" ? "text-right" : ""} truncate font-medium`}>{team.name}</p>
      {align === "right" && badge}
    </div>
  );
}

export default function SimulationWorkspacePage() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get("league");
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [activeView, setActiveView] = useState<"events" | "stats">("events");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"preview" | "reroll" | "commit" | null>(null);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const leagueResponse = await fetch(`/api/league/game?leagueId=${leagueId}&type=league_info`);
      const leaguePayload = await leagueResponse.json();
      if (!leaguePayload.success) throw new Error(leaguePayload.error || "Could not load league");
      const nextLeague = leaguePayload.data as LeagueInfo;
      setLeague(nextLeague);
      if (!nextLeague.is_host) throw new Error("Only league hosts can open the simulation workspace");
      const scheduleResponse = await fetch(`/api/league/game?leagueId=${leagueId}&type=schedule&season=${nextLeague.season}&round=${nextLeague.current_round}&competition_type=domestic`);
      const schedulePayload = await scheduleResponse.json();
      if (!schedulePayload.success) throw new Error(schedulePayload.error || "Could not load fixtures");
      setFixtures(schedulePayload.data || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load simulation workspace");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  const simulate = async (fixture: Fixture, reroll = false) => {
    if (!leagueId) return;
    setAction(reroll ? "reroll" : "preview");
    try {
      const response = await fetch("/api/league/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview_matchday", leagueId, competitionType: "domestic", matchId: fixture.id, reroll }) });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "Could not simulate match");
      setPreview(payload.data);
      setActiveView("events");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not simulate match");
    } finally {
      setAction(null);
    }
  };

  const commit = async () => {
    if (!leagueId || !preview) return;
    setAction("commit");
    try {
      const response = await fetch("/api/league/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "commit_matchday_preview", leagueId, previewId: preview.id }) });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error || "Could not commit match");
      setPreview(null);
      await loadWorkspace();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not commit match");
    } finally {
      setAction(null);
    }
  };

  const match = preview?.output_snapshot.matches[0];
  const selectedFixture = match ? fixtures.find((fixture) => fixture.id === match.matchId) : null;
  const sides = useMemo(() => !match ? [] : [
    { id: match.homeTeamId, name: match.homeTeamName, players: match.playerStats.filter((line) => line.teamId === match.homeTeamId && line.starter) },
    { id: match.awayTeamId, name: match.awayTeamName, players: match.playerStats.filter((line) => line.teamId === match.awayTeamId && line.starter) },
  ], [match]);

  if (loading && !league) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return <div className="space-y-6 p-4 md:p-6">
    <Breadcrumbs lastLabel="Simulation" />
    <PageHeader eyebrow={league ? `Season ${league.season} · Round ${league.current_round} of ${league.total_rounds}` : "Match engine"} title="Simulation studio" subtitle="Preview, inspect and commit one fixture at a time." actions={<Link href={`/main/dashboard/host-controls?league=${leagueId}`}><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Host controls</Button></Link>} />
    {error && <div className="rounded-xl border border-status-negative/40 bg-status-negative/10 px-4 py-3 text-sm text-status-negative">{error}</div>}

    {!match ? <div className="grid gap-3 xl:grid-cols-2">
      {fixtures.map((fixture) => <Card key={fixture.id} className="border-border bg-surface"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3"><TeamMark team={fixture.home_team} align="right" /><div className="rounded-lg bg-surface-3 px-3 py-2 font-mono font-bold">{fixture.match_status === "scheduled" ? "vs" : `${fixture.home_score}–${fixture.away_score}`}</div><TeamMark team={fixture.away_team} align="left" /></div>
        {fixture.match_status === "scheduled" ? <Button onClick={() => simulate(fixture)} disabled={action !== null}><Play className="mr-2 h-4 w-4" />Simulate</Button> : <Link href={`/main/dashboard/matches/${fixture.id}?league=${leagueId}&season=${league?.season}`}><Button variant="outline">Report<ChevronRight className="ml-1 h-4 w-4" /></Button></Link>}
      </CardContent></Card>)}
      {fixtures.length === 0 && <Card className="xl:col-span-2"><CardContent className="py-12 text-center text-muted-foreground">No domestic fixtures are available in this round.</CardContent></Card>}
    </div> : <div className="overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_top,_rgba(255,255,255,.06),_transparent_48%),linear-gradient(145deg,#181b20,#0d0f12)] shadow-2xl">
      <div className="border-b border-white/10 px-4 py-5 md:px-8">
        <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-8"><p className="truncate text-right text-base font-semibold md:text-xl">{match.homeTeamName}</p><div className="rounded-xl bg-black/35 px-5 py-3 font-mono text-3xl font-bold tabular-nums text-amber-200 md:text-5xl">{match.homeScore}<span className="mx-2 text-white/40">:</span>{match.awayScore}</div><p className="truncate text-base font-semibold md:text-xl">{match.awayTeamName}</p></div>
        <div className="mt-3 flex justify-center gap-2"><Badge variant="outline">Preview · Attempt {preview.attempt + 1}</Badge><Badge variant="outline">Not committed</Badge></div>
      </div>
      {!!preview.output_snapshot.warnings?.length && <div className="mx-4 mt-4 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning md:mx-8"><ShieldAlert className="mr-2 inline h-4 w-4" />{preview.output_snapshot.warnings.join(" · ")}</div>}
      <div className="grid min-h-[520px] gap-0 lg:grid-cols-[minmax(220px,1fr)_minmax(330px,1.35fr)_minmax(220px,1fr)]">
        {sides.map((side, sideIndex) => <div key={side.id} className={`${sideIndex === 1 ? "lg:order-3" : "lg:order-1"} border-white/10 p-4 md:p-6 lg:border-r`}><p className={`mb-4 text-xs font-semibold uppercase tracking-[.18em] text-white/50 ${sideIndex === 1 ? "lg:text-right" : ""}`}>Starting XI</p><div className="space-y-2">{side.players.map((line) => <div key={line.playerId} className={`flex items-center gap-2 text-sm ${sideIndex === 1 ? "lg:flex-row-reverse" : ""}`}><span className="w-7 text-xs text-white/35">{line.position || ""}</span><span className={`min-w-0 flex-1 truncate ${sideIndex === 1 ? "lg:text-right" : ""}`}>{line.playerName}</span><span className="flex gap-1 text-xs">{line.goals > 0 && `⚽${line.goals}`}{line.yellowCards > 0 && "🟨"}{line.redCards > 0 && "🟥"}</span><strong className={`w-9 text-right tabular-nums ${ratingTone(Number(line.rating))}`}>{Number(line.rating).toFixed(1)}</strong></div>)}</div></div>)}
        <div className="order-3 border-t border-white/10 bg-black/15 p-4 md:p-6 lg:order-2 lg:border-x lg:border-t-0">
          <div className="mb-5 inline-flex w-full rounded-lg bg-black/25 p-1">{(["events", "stats"] as const).map((view) => <button key={view} onClick={() => setActiveView(view)} className={`min-h-9 flex-1 rounded-md text-sm font-medium capitalize transition-colors ${activeView === view ? "bg-white/10 text-white" : "text-white/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"}`}>{view}</button>)}</div>
          {activeView === "events" && <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">{match.events.filter((event) => ["goal", "yellow_card", "red_card", "injury", "substitution"].includes(event.type)).map((event, index) => { const home = event.teamId === match.homeTeamId; return <div key={`${event.minute}-${index}`} className="grid grid-cols-[1fr_48px_1fr] items-center gap-2 py-1.5 text-sm"><div className={`min-w-0 ${home ? "text-right" : ""}`}>{home && <><p className="truncate font-medium">{event.playerName}</p>{event.secondaryPlayerName && <p className="truncate text-xs text-white/40">{event.secondaryPlayerName}</p>}</>}</div><div className="text-center"><span>{eventIcon(event)}</span><span className="ml-1 font-mono text-xs text-white/45">{event.minute}&apos;</span></div><div className="min-w-0">{!home && <><p className="truncate font-medium">{event.playerName}</p>{event.secondaryPlayerName && <p className="truncate text-xs text-white/40">{event.secondaryPlayerName}</p>}</>}</div></div>; })}</div>}
          {activeView === "stats" && <div className="space-y-4">{[["Possession", "possession", "%"], ["xG", "xg", ""], ["Shots", "shots", ""], ["On target", "shotsOnTarget", ""], ["Passes", "passes", ""], ["Fouls", "fouls", ""]].map(([label, key, suffix]) => <div key={key}><div className="grid grid-cols-[1fr_auto_1fr] text-sm"><span className="font-mono">{Number(match.teamStats.home[key] || 0).toFixed(key === "xg" ? 2 : 0)}{suffix}</span><span className="px-3 text-xs text-white/45">{label}</span><span className="text-right font-mono">{Number(match.teamStats.away[key] || 0).toFixed(key === "xg" ? 2 : 0)}{suffix}</span></div></div>)}</div>}
        </div>
      </div>
      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-white/10 bg-[#101216]/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between"><Button variant="ghost" onClick={() => setPreview(null)}>Back to fixtures</Button><div className="flex gap-2"><Button variant="outline" disabled={action !== null || !selectedFixture || preview.rerolls_remaining === 0} onClick={() => selectedFixture && simulate(selectedFixture, true)}>{action === "reroll" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}{preview.rerolls_remaining === 0 ? "Reroll limit reached" : "Reroll match"}</Button><Button disabled={action !== null} onClick={commit} className="bg-emerald-500 text-black hover:bg-emerald-400">{action === "commit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Commit result</Button></div></div>
    </div>}
  </div>;
}
