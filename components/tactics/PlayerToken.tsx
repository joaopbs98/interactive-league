"use client";

import { CircleAlert, Info, Plus } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";
import { TacticsPlayer } from "./types";
import { formatPlayerName } from "@/utils/playerUtils";
import { getPositionFit, POSITION_FIT_RING } from "@/lib/positionFit";
import { getRatingColorClasses } from "@/utils/ratingColors";

interface PlayerTokenProps {
  player: TacticsPlayer;
  slotLabel: string;
  style: { left: string; top: string };
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetail: (player: TacticsPlayer) => void;
}

export function PlayerToken({ player, slotLabel, style, isSelected, onSelect, onOpenDetail }: PlayerTokenProps) {
  const isEmpty = player.player_id?.startsWith("empty-");
  const fit = getPositionFit(player.positions, slotLabel);
  const displayName = isEmpty ? "Empty slot" : formatPlayerName(player.full_name || player.name);

  return (
    <div
      className={`absolute z-10 flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center sm:w-20 ${
        isSelected ? "z-20" : "hover:z-20 focus-within:z-20"
      }`}
      style={{ left: style.left, top: style.top }}
    >
      <div className="group relative">
        {isEmpty ? (
          <button
            type="button"
            onClick={onSelect}
            className={`flex size-10 items-center justify-center rounded-full border border-dashed bg-surface-3/95 text-muted-foreground ring-1 transition-[border-color,color,box-shadow] duration-150 sm:size-11 ${
              isSelected
                ? "border-accent text-accent ring-2 ring-accent/40"
                : "border-border-strong ring-border-strong hover:border-accent/70 hover:text-foreground hover:ring-accent/30"
            }`}
            aria-label={`Select empty ${slotLabel} position`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onSelect}
              className={`relative size-10 overflow-hidden rounded-full border bg-surface-2 ring-2 transition-[border-color,box-shadow,filter] duration-150 sm:size-11 ${
                isSelected
                  ? "border-accent ring-accent shadow-[0_0_0_3px_rgba(59,158,255,0.18)]"
                  : `border-border-strong ${POSITION_FIT_RING[fit]} hover:border-accent hover:ring-accent`
              }`}
              aria-label={`Select ${displayName}, ${player.overall_rating} rated ${slotLabel}${player.isInjured ? ", unavailable" : ""}`}
              aria-pressed={isSelected}
            >
              <PlayerAvatar
                src={player.image}
                alt=""
                className={`size-full object-cover object-top ${player.isInjured ? "grayscale opacity-55" : ""}`}
              />
            </button>

            <span
              className={`pointer-events-none absolute -left-2 -top-1 flex h-[1.375rem] min-w-[1.375rem] items-center justify-center rounded-md border px-1 text-[10px] font-bold tabular-nums shadow-sm ${getRatingColorClasses(
                player.overall_rating ?? 0,
              )}`}
              aria-hidden="true"
            >
              {player.overall_rating ?? "–"}
            </span>

            {player.isInjured && (
              <span
                className="pointer-events-none absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-status-negative/60 bg-surface-3 text-status-negative"
                title={player.injuryType || "Unavailable"}
              >
                <CircleAlert className="size-3" aria-hidden="true" />
              </span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(player);
              }}
              className="absolute -bottom-1 -right-2 flex size-5 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-muted-foreground opacity-0 shadow-sm transition-[color,border-color,opacity] duration-150 hover:border-accent/60 hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Open details for ${displayName}`}
            >
              <Info className="size-3" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div
        className={`mt-1 max-w-full rounded-md border bg-surface-3/95 px-1.5 py-0.5 text-center shadow-sm transition-colors duration-150 ${
          isSelected ? "border-accent/70" : "border-border-strong"
        }`}
      >
        <p className={`truncate text-[10px] font-semibold leading-tight sm:text-[11px] ${isEmpty ? "text-muted-foreground" : "text-foreground"}`}>
          {displayName}
        </p>
        <p className={`text-[9px] font-medium leading-tight ${isSelected ? "text-accent" : "text-muted-foreground"}`}>
          {slotLabel}
        </p>
      </div>
    </div>
  );
}
