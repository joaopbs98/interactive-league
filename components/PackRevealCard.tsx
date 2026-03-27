"use client";

import React from "react";
import { Images } from "@/lib/assets";
import { getStatColor } from "@/hooks/getStatColor";

interface PackRevealCardProps {
  player: {
    player_id: string;
    name: string;
    full_name?: string;
    positions: string;
    overall_rating: number;
    image?: string;
    country_name?: string;
  };
  /** Stagger animation delay (ms) */
  revealDelay?: number;
  className?: string;
}

/** FUT-style collectible trading card for pack reveal - clean, minimal, no action clutter */
export function PackRevealCard({ player, revealDelay = 0, className = "" }: PackRevealCardProps) {
  const displayName = player.full_name || player.name;
  const rating = player.overall_rating ?? 0;
  const ratingColor = getStatColor(rating);

  const imageSrc = player.image?.startsWith("http")
    ? `/api/proxy-image?url=${encodeURIComponent(player.image)}`
    : player.image || Images.NoImage.src;

  // Rarity tier: Gold 75+, Silver 65-74, Bronze <65
  const tier =
    rating >= 75 ? "gold" : rating >= 65 ? "silver" : "bronze";

  const tierStyles = {
    gold: {
      bg: "bg-gradient-to-br from-amber-900/90 via-amber-800/95 to-amber-950",
      border: "border-amber-500/60",
      accent: "from-amber-600/40 to-transparent",
    },
    silver: {
      bg: "bg-gradient-to-br from-zinc-700/95 via-zinc-600/95 to-zinc-800",
      border: "border-zinc-400/50",
      accent: "from-zinc-500/30 to-transparent",
    },
    bronze: {
      bg: "bg-gradient-to-br from-amber-950/95 via-amber-900/95 to-amber-950",
      border: "border-amber-700/50",
      accent: "from-amber-800/40 to-transparent",
    },
  };

  const style = tierStyles[tier];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border-2 ${style.border} ${style.bg}
        shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]
        transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5
        aspect-[3/4] min-h-[200px] flex flex-col
        ${className}
      `}
      style={{
        animation: revealDelay > 0 ? `fadeInUp 0.4s ease-out ${revealDelay}ms both` : undefined,
      }}
    >
      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.accent}`} />

      {/* Rating badge - top right corner */}
      <div className="absolute top-3 right-3 z-10">
        <div
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg ${ratingColor} shadow-lg`}
        >
          <span className="text-lg font-black leading-none">{rating}</span>
          <span className="text-[8px] font-bold uppercase tracking-wider opacity-90">OVR</span>
        </div>
      </div>

      {/* Player image - centered, prominent */}
      <div className="flex-1 flex items-center justify-center p-4 pt-6">
        <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-white/20 shadow-xl">
          <img
            src={imageSrc}
            alt={displayName}
            width={96}
            height={96}
            className="object-cover w-full h-full bg-muted"
            onError={(e) => {
              (e.target as HTMLImageElement).src = Images.NoImage.src;
            }}
          />
        </div>
      </div>

      {/* Bottom info strip */}
      <div className="p-3 pt-2 bg-black/30 backdrop-blur-sm">
        <p className="font-bold text-white text-sm truncate text-center">
          {displayName}
        </p>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs font-medium text-white/90 bg-white/10 px-2 py-0.5 rounded">
            {player.positions}
          </span>
          {player.country_name && (
            <span className="text-xs text-white/70 truncate max-w-[80px]">
              {player.country_name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
