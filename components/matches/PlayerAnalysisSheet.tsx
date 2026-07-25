"use client";

import { Activity, Footprints, Goal, Shield, Target, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export type AnalyticalPlayerLine = {
  player_id: string; team_id: string; starter: boolean; role?: string | null; minutes: number; rating: number;
  slot_position?: string | null;
  goals: number; assists: number; shots: number; shots_on_target: number; key_passes: number; passes: number;
  completed_passes: number; tackles: number; interceptions: number; saves: number; fouls: number;
  yellow_cards: number; red_cards: number; xg?: number; xgot?: number; xa?: number; big_chances?: number;
  big_chances_missed?: number; progressive_passes?: number; crosses?: number; completed_crosses?: number;
  touches?: number; carries?: number; progressive_carries?: number; dribbles?: number; successful_dribbles?: number;
  dispossessed?: number; pressures?: number; recoveries?: number; blocks?: number; clearances?: number;
  shots_faced?: number; goals_conceded?: number; goals_prevented?: number;
  offsides?: number; fouled?: number; long_balls?: number; completed_long_balls?: number;
  passes_own_third?: number; passes_middle_third?: number; passes_final_third?: number;
  claims?: number; successful_claims?: number; punches?: number; sweeper_actions?: number;
  errors_leading_to_shot?: number; errors_leading_to_goal?: number;
  duels?: number; duels_won?: number; aerial_duels?: number; aerial_duels_won?: number;
  distance_km?: number; high_speed_distance_km?: number; sprint_distance_km?: number;
  max_speed_kmh?: number; sprint_count?: number; heatmap?: number[]; shot_map?: Array<Record<string, number | string | boolean>>;
  pass_map?: Array<Record<string, number | string | boolean>>; rating_components?: Record<string, number>;
  average_position?: { x?: number; y?: number } | null;
  engine_version?: string; analytics_source?: string;
  player?: { player_name: string; positions: string } | null;
};

const value = (input: unknown, digits = 0) => Number(input || 0).toFixed(digits);
const signedValue = (input: unknown) => `${Number(input || 0) >= 0 ? "+" : ""}${Number(input || 0).toFixed(2)}`;
const ratio = (won?: number, total?: number) => `${Number(won || 0)}/${Number(total || 0)}`;
const ratingColor = (rating: number) => rating >= 8
  ? "border-transparent bg-status-positive text-white"
  : rating >= 7
    ? "border-transparent bg-emerald-600 text-white"
    : rating >= 6
      ? "border-transparent bg-status-warning text-black"
      : "border-transparent bg-status-negative text-white";

function StatGroup({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: Array<[string, React.ReactNode]> }) {
  return <section className="border-t border-border py-4 first:border-t-0">
    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">{icon}{title}</h3>
    <div className="space-y-2">{rows.map(([label, stat]) => <div key={label} className="flex items-baseline justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-mono font-medium tabular-nums">{stat}</span></div>)}</div>
  </section>;
}

function Heatmap({ bins = [] }: { bins?: number[] }) {
  if (bins.length !== 24) return <div className="flex h-44 items-center justify-center rounded-lg border border-border bg-surface-2 text-xs text-muted-foreground">Tracking unavailable for this match</div>;
  return <div className="relative grid h-44 grid-cols-6 overflow-hidden rounded-lg border border-white/15 bg-[#143d2b] p-1" aria-label="Player heatmap">
    <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-white/25" />
    <span className="pointer-events-none absolute left-1/2 inset-y-0 border-l border-white/25" />
    {bins.map((bin, index) => <span key={index} style={{ backgroundColor: `rgba(99,102,241,${Math.max(.04, Number(bin) * .82)})` }} />)}
  </div>;
}

function ShotMap({ shots = [] }: { shots?: Array<Record<string, number | string | boolean>> }) {
  return <div className="relative h-40 overflow-hidden rounded-lg border border-white/15 bg-[#143d2b]">
    <span className="absolute inset-x-[18%] top-0 h-14 border border-t-0 border-white/25" />
    <span className="absolute left-1/2 top-0 h-full border-l border-white/15" />
    {shots.map((shot, index) => <span key={index} title={`${shot.outcome} · xG ${shot.xg}`} className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${shot.outcome === "goal" ? "bg-status-positive" : shot.onTarget ? "bg-status-warning" : "bg-muted-foreground"}`} style={{ left: `${shot.y}%`, top: `${100 - Number(shot.x)}%` }} />)}
    {shots.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-xs text-white/55">No shots</span>}
  </div>;
}

export function PlayerAnalysisSheet({ line, onClose }: { line: AnalyticalPlayerLine | null; onClose: () => void }) {
  if (!line) return null;
  const completion = line.passes ? Math.round(line.completed_passes / line.passes * 100) : 0;
  const advanced = line.engine_version === "fc25-il-2";
  const isGoalkeeper = line.slot_position === "GK" || String(line.player?.positions || "").split(",")[0] === "GK";
  const shotsFaced = Number(line.shots_faced || 0);
  const savePercentage = shotsFaced ? Math.round(Number(line.saves || 0) / shotsFaced * 100) : 0;
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="fixed inset-y-0 right-0 left-auto top-0 h-dvh w-full max-w-[440px] translate-x-0 translate-y-0 overflow-y-auto rounded-none border-y-0 border-r-0 bg-background p-0 shadow-2xl data-[state=open]:slide-in-from-right sm:rounded-none">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground" aria-label="Close player statistics"><X className="h-4 w-4" /></button>
        <div className="flex items-center gap-3 pr-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-sm font-semibold">{(line.player?.player_name || "?").slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><DialogTitle className="truncate text-base">{line.player?.player_name || line.player_id}</DialogTitle><DialogDescription>{line.player?.positions || "Position unavailable"} · {line.minutes}&apos;</DialogDescription></div>
          <Badge className={`text-base tabular-nums ${ratingColor(line.rating)}`}>{value(line.rating, 1)}</Badge>
        </div>
      </div>
      <div className="px-5 pb-8">
        {!advanced && <div className="my-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">Legacy match: advanced spatial and physical analytics were not recorded.</div>}
        <div className="grid grid-cols-3 gap-2 py-4">
          {(isGoalkeeper
            ? [["Saves", line.saves], ["Save rate", `${savePercentage}%`], ["Goals prevented", value(line.goals_prevented, 2)]]
            : [["Goals", line.goals], ["Assists", line.assists], ["xG + xA", value(Number(line.xg || 0) + Number(line.xa || 0), 2)]]
          ).map(([label, stat]) => <div key={label} className="rounded-lg bg-surface-2 p-3 text-center"><p className="font-mono text-lg font-semibold">{stat}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>)}
        </div>
        {isGoalkeeper ? <>
          <StatGroup title="Goalkeeping" icon={<Shield className="h-4 w-4 text-accent" />} rows={[
            ["Shots faced", shotsFaced], ["Saves", line.saves], ["Goals conceded", line.goals_conceded || 0],
            ["Save percentage", `${savePercentage}%`], ["Goals prevented", value(line.goals_prevented, 2)],
            ["Clean sheet", Number(line.goals_conceded || 0) === 0 ? "Yes" : "No"],
            ["Claims", ratio(line.successful_claims, line.claims)], ["Punches", line.punches || 0],
          ]} />
          <StatGroup title="Distribution & sweeping" icon={<Goal className="h-4 w-4 text-accent" />} rows={[
            ["Accurate passes", `${line.completed_passes}/${line.passes} (${completion}%)`],
            ["Long balls", ratio(line.completed_long_balls, line.long_balls)],
            ["Progressive passes", line.progressive_passes || 0], ["Sweeper actions", line.sweeper_actions || 0],
            ["Touches", line.touches || 0], ["Clearances", line.clearances || 0], ["Recoveries", line.recoveries || 0],
          ]} />
        </> : <>
          <StatGroup title="Shooting" icon={<Target className="h-4 w-4 text-accent" />} rows={[
            ["Goals", line.goals], ["Expected goals (xG)", value(line.xg, 2)], ["xG on target", value(line.xgot, 2)],
            ["Shots", line.shots], ["On target", line.shots_on_target], ["Big chances missed", line.big_chances_missed || 0],
          ]} />
          <ShotMap shots={line.shot_map} />
          <StatGroup title="Passing & creation" icon={<Goal className="h-4 w-4 text-accent" />} rows={[
            ["Assists", line.assists], ["Expected assists (xA)", value(line.xa, 2)], ["Key passes", line.key_passes],
            ["Passes", `${line.completed_passes}/${line.passes} (${completion}%)`], ["Progressive passes", line.progressive_passes || 0],
            ["Long balls", ratio(line.completed_long_balls, line.long_balls)], ["Crosses", ratio(line.completed_crosses, line.crosses)],
            ["Passes: own third", line.passes_own_third || 0], ["Passes: middle third", line.passes_middle_third || 0],
            ["Passes: final third", line.passes_final_third || 0],
          ]} />
          <StatGroup title="Possession & progression" icon={<Activity className="h-4 w-4 text-accent" />} rows={[
            ["Touches", line.touches || 0], ["Carries", line.carries || 0], ["Progressive carries", line.progressive_carries || 0],
            ["Successful dribbles", ratio(line.successful_dribbles, line.dribbles)], ["Dispossessed", line.dispossessed || 0],
          ]} />
          <StatGroup title="Defending & duels" icon={<Shield className="h-4 w-4 text-accent" />} rows={[
            ["Pressures", line.pressures || 0], ["Tackles", line.tackles], ["Interceptions", line.interceptions],
            ["Recoveries", line.recoveries || 0], ["Blocks", line.blocks || 0], ["Clearances", line.clearances || 0],
            ["Ground duels won", ratio(line.duels_won, line.duels)], ["Aerial duels won", ratio(line.aerial_duels_won, line.aerial_duels)],
            ["Errors leading to shot", line.errors_leading_to_shot || 0], ["Errors leading to goal", line.errors_leading_to_goal || 0],
            ["Fouls committed", line.fouls], ["Fouls won", line.fouled || 0], ["Offsides", line.offsides || 0],
          ]} />
        </>}
        <StatGroup title="Physical output" icon={<Footprints className="h-4 w-4 text-accent" />} rows={[
          ["Distance", `${value(line.distance_km, 2)} km`], ["High-speed running", `${value(line.high_speed_distance_km, 2)} km`],
          ["Sprint distance", `${value(line.sprint_distance_km, 2)} km`], ["Maximum speed", `${value(line.max_speed_kmh, 1)} km/h`],
          ["Sprints", line.sprint_count || 0],
        ]} />
        {line.rating_components && <StatGroup title="Rating breakdown" icon={<Activity className="h-4 w-4 text-accent" />} rows={[
          ["Base", value(line.rating_components.base, 2)], ["Scoring", signedValue(line.rating_components.scoring)],
          ["Possession", signedValue(line.rating_components.possession)], ["Defending", signedValue(line.rating_components.defending)],
          ["Discipline, errors & fit", signedValue(line.rating_components.discipline)],
        ]} />}
        <div className="pt-2"><h3 className="mb-3 text-xs font-semibold">Tracking heatmap</h3><Heatmap bins={line.heatmap} /><p className="mt-2 text-[11px] text-muted-foreground">Built from recorded match positions and normalized left-to-right. Tactical line, role, focus and possession phase affect the shape.</p></div>
      </div>
    </DialogContent>
  </Dialog>;
}
