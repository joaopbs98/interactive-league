"use client";

import { Position } from "@/lib/formationPositions";
import { TacticsPlayer } from "./types";
import { PlayerToken } from "./PlayerToken";

interface PitchProps {
  positions: Position[];
  players: TacticsPlayer[];
  onOpenDetail: (player: TacticsPlayer) => void;
  getPlayerForPosition: (index: number) => TacticsPlayer;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function Pitch({ positions, onOpenDetail, getPlayerForPosition, selectedIndex, onSelect }: PitchProps) {
  return (
    <div
      className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-border-strong"
      style={{
        background: `
          radial-gradient(ellipse 90% 55% at 50% 0%, rgba(34, 255, 153, 0.16), transparent 70%),
          repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.05) 0,
            rgba(255,255,255,0.05) 10%,
            rgba(255,255,255,0.015) 10%,
            rgba(255,255,255,0.015) 20%
          ),
          #06060a
        `,
      }}
    >
      {/* Pitch markings — broadcast-style hairline geometry, true to a real touchline layout */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-3 border border-border-strong rounded-sm" />
        {/* halfway line + centre circle + spot */}
        <div className="absolute left-3 right-3 top-1/2 border-t border-border-strong" />
        <div className="absolute left-1/2 top-1/2 w-24 h-24 md:w-32 md:h-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border-strong" />
        <div className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong" />

        {/* top penalty box + six-yard box + arc (attacking goal) */}
        <div className="absolute left-1/2 top-3 w-[55%] h-[16%] -translate-x-1/2 border border-t-0 border-border-strong" />
        <div className="absolute left-1/2 top-3 w-[28%] h-[7%] -translate-x-1/2 border border-t-0 border-border-strong" />
        <div className="absolute left-1/2 top-3 w-1 h-1 -translate-x-1/2 translate-y-[15%] rounded-full bg-border-strong" />
        <div
          className="absolute left-1/2 top-3 w-16 h-8 -translate-x-1/2 translate-y-[13%] border-b border-border-strong rounded-b-full"
          style={{ borderTop: "none", borderLeft: "none", borderRight: "none" }}
        />

        {/* bottom penalty box + six-yard box + arc (own goal) */}
        <div className="absolute left-1/2 bottom-3 w-[55%] h-[16%] -translate-x-1/2 border border-b-0 border-border-strong" />
        <div className="absolute left-1/2 bottom-3 w-[28%] h-[7%] -translate-x-1/2 border border-b-0 border-border-strong" />
        <div className="absolute left-1/2 bottom-3 w-1 h-1 -translate-x-1/2 -translate-y-[15%] rounded-full bg-border-strong" />
        <div
          className="absolute left-1/2 bottom-3 w-16 h-8 -translate-x-1/2 -translate-y-[13%] border-t border-border-strong rounded-t-full"
          style={{ borderBottom: "none", borderLeft: "none", borderRight: "none" }}
        />

        {/* corner arcs */}
        <div className="absolute left-3 top-3 w-4 h-4 border-b border-r-0 border-l-0 border-t-0 border-border-strong rounded-bl-full" />
        <div className="absolute right-3 top-3 w-4 h-4 border-b border-border-strong rounded-br-full" />
        <div className="absolute left-3 bottom-3 w-4 h-4 border-t border-border-strong rounded-tl-full" />
        <div className="absolute right-3 bottom-3 w-4 h-4 border-t border-border-strong rounded-tr-full" />
      </div>

      {/* Player tokens */}
      {positions.map((pos, idx) => {
        const player = getPlayerForPosition(idx);
        // Keep labels, rating badges, and focus rings inside the visible pitch while
        // preserving the formation's relative shape and its stored coordinates.
        const displayX = Math.min(86, Math.max(14, pos.x));
        const displayY = Math.min(90, Math.max(9, pos.y));
        return (
          <PlayerToken
            key={idx}
            player={player}
            slotLabel={pos.label}
            style={{ left: `${displayX}%`, top: `${displayY}%` }}
            isSelected={selectedIndex === idx}
            onSelect={() => onSelect(idx)}
            onOpenDetail={onOpenDetail}
          />
        );
      })}
    </div>
  );
}
