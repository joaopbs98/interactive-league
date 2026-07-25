"use client";

import { Info } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";
import { TacticsPlayer } from "./types";
import { formatPlayerName } from "@/utils/playerUtils";
import { getRatingColorClasses } from "@/utils/ratingColors";

interface SquadCardProps {
  player: TacticsPlayer;
  onOpenDetail: (player: TacticsPlayer) => void;
  isSelected: boolean;
  onSelect: () => void;
}

export function SquadCard({ player, onOpenDetail, isSelected, onSelect }: SquadCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-2.5 border rounded-lg transition-colors duration-150 text-left ${
        isSelected
          ? "bg-accent-muted border-accent ring-2 ring-accent/40"
          : "bg-surface-2 border-border hover:bg-surface-3"
      }`}
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
        <PlayerCard player={player} size="sm" className="w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`shrink-0 flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold leading-none ${getRatingColorClasses(player.overall_rating ?? 0)}`}
          >
            {player.overall_rating ?? "-"}
          </span>
          <p className="font-medium text-sm truncate">{formatPlayerName(player.full_name || player.name)}</p>
        </div>
        <p className="text-xs text-muted-foreground">{player.positions}</p>
      </div>

      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail(player);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            onOpenDetail(player);
          }
        }}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-surface-3 transition-colors duration-150"
        aria-label="Player details"
      >
        <Info className="w-4 h-4" />
      </span>
    </button>
  );
}
