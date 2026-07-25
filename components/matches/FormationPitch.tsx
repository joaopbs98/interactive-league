"use client";

import { Badge } from "@/components/ui/badge";
import { formationPositions } from "@/lib/formationPositions";
import type { AnalyticalPlayerLine } from "./PlayerAnalysisSheet";

type TacticalAssignment = {
  slotIndex: number;
  slotPosition: string;
  playerId: string;
};

export function FormationPitch({ players, formation = "4-3-3", assignments = [], onSelect }: {
  players: AnalyticalPlayerLine[];
  formation?: string;
  assignments?: TacticalAssignment[];
  onSelect: (line: AnalyticalPlayerLine) => void;
}) {
  const starters = players.filter((line) => line.starter).slice(0, 11);
  const slots = formationPositions[formation] || formationPositions["4-3-3"];
  const playerMap = new Map(starters.map((line) => [line.player_id, line]));
  const orderedAssignments = [...assignments].sort((a, b) => a.slotIndex - b.slotIndex);
  const fallbackPlayers = starters.filter((line) => !orderedAssignments.some((assignment) => assignment.playerId === line.player_id));
  const lineup = slots.slice(0, 11).map((slot, slotIndex) => {
    const assignment = orderedAssignments.find((item) => item.slotIndex === slotIndex);
    const player = assignment ? playerMap.get(assignment.playerId) : fallbackPlayers.shift() || starters[slotIndex];
    return { slot, player, label: assignment?.slotPosition || slot.label };
  });
  const safeCoordinate = (value: number) => 8 + value * 0.84;
  const ratingColor = (rating: number) => rating >= 8
    ? "border-transparent bg-status-positive text-white"
    : rating >= 7
      ? "border-transparent bg-emerald-600 text-white"
      : rating >= 6
        ? "border-transparent bg-status-warning text-black"
        : "border-transparent bg-status-negative text-white";

  return <div className="relative aspect-[4/3] min-h-[360px] overflow-hidden rounded-xl border border-white/15 bg-[#143d2b]">
    <div className="absolute inset-x-[8%] top-0 h-[17%] border border-t-0 border-white/20" />
    <div className="absolute inset-x-[8%] bottom-0 h-[17%] border border-b-0 border-white/20" />
    <div className="absolute inset-x-0 top-1/2 border-t border-white/20" />
    <div className="absolute left-1/2 top-[43%] h-[14%] w-[20%] -translate-x-1/2 rounded-full border border-white/20" />
    {lineup.map(({ slot, player, label }, slotIndex) => {
      if (!player) return <div key={`missing-${slotIndex}`} className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: `${safeCoordinate(slot.x)}%`, top: `${safeCoordinate(slot.y)}%` }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-status-negative/70 bg-background/70 text-[10px] font-semibold text-status-negative">{label}</span>
        <span className="mt-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] text-status-negative">Missing player</span>
      </div>;
      return <button key={`${slotIndex}-${player.player_id}`} onClick={() => onSelect(player)} className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ left: `${safeCoordinate(slot.x)}%`, top: `${safeCoordinate(slot.y)}%` }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-surface-3 text-[10px] font-semibold shadow">{label}</span>
        <span className="mt-1 max-w-20 truncate rounded bg-background/85 px-1.5 py-0.5 text-[10px]">{player.player?.player_name || player.player_id}</span>
        <Badge className={`mt-1 h-5 px-1.5 text-[10px] ${ratingColor(Number(player.rating))}`}>{Number(player.rating).toFixed(1)}</Badge>
      </button>;
    })}
  </div>;
}
