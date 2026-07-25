"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, Package, Sparkles } from "lucide-react";

type Pack = {
  id: number;
  name: string;
  price: number;
  player_count: number;
  season: number;
  pack_type: string;
  description: string;
};

interface PackTierCardProps {
  pack: Pack;
  odds?: { rating: number; pct: string }[];
  onFetchOdds: () => void;
  onOpen: () => void;
  disabled: boolean;
  disabledLabel?: string;
  charging: boolean;
}

const TIER_THEME: Record<
  string,
  { ring: string; glow: string; badge: string; icon: string; shimmer: boolean; label: string }
> = {
  Basic: {
    ring: "border-slate-400/30",
    glow: "rgba(148,163,184,0.35)",
    badge: "bg-slate-600 text-white",
    icon: "text-slate-300",
    shimmer: false,
    label: "Basic",
  },
  Prime: {
    ring: "border-[var(--accent)]/50",
    glow: "rgba(99,102,241,0.5)",
    badge: "bg-[var(--accent)] text-white",
    icon: "text-[var(--accent-hover)]",
    shimmer: false,
    label: "Prime",
  },
  Elite: {
    ring: "border-amber-400/50",
    glow: "rgba(250,204,21,0.55)",
    badge: "bg-amber-400 text-black",
    icon: "text-amber-300",
    shimmer: true,
    label: "Elite",
  },
};

export function PackTierCard({
  pack,
  odds,
  onFetchOdds,
  onOpen,
  disabled,
  disabledLabel,
  charging,
}: PackTierCardProps) {
  const theme = TIER_THEME[pack.pack_type] || TIER_THEME.Basic;

  return (
    <motion.div
      whileHover={!disabled ? { y: -8, scale: 1.015 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      animate={
        charging
          ? { scale: [1, 1.04, 1], boxShadow: [`0 0 30px -8px ${theme.glow}`, `0 0 70px -4px ${theme.glow}`, `0 0 30px -8px ${theme.glow}`] }
          : { boxShadow: `0 0 30px -10px ${theme.glow}` }
      }
      transition={
        charging
          ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
          : { type: "spring", stiffness: 260, damping: 22 }
      }
      className={`relative overflow-hidden rounded-2xl border-2 ${theme.ring} bg-[var(--surface)] flex flex-col h-[600px] w-96 ${
        theme.shimmer ? "shimmer-sweep" : ""
      }`}
      style={{ "--pack-glow-color": theme.glow } as React.CSSProperties}
    >
      {/* Pack visual */}
      <div className="relative flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] border-b border-[var(--border)]">
        <span
          className={`absolute top-4 left-4 text-[11px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${theme.badge}`}
        >
          {theme.label}
        </span>
        <div
          className="flex items-center justify-center w-32 h-32 rounded-2xl border border-white/10"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${theme.glow}, transparent 70%)`,
          }}
        >
          <Package className={`w-16 h-16 ${theme.icon}`} strokeWidth={1.5} />
        </div>
        <Sparkles className={`absolute bottom-6 right-6 w-5 h-5 ${theme.icon} opacity-60`} />
        <Sparkles className={`absolute top-10 right-10 w-3.5 h-3.5 ${theme.icon} opacity-40`} />
      </div>

      {/* Info panel */}
      <div className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{pack.name}</h2>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pack.description}</p>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-status-positive">
            €{pack.price.toLocaleString()}
          </span>
          <span className="text-muted-foreground">{pack.player_count} players</span>
        </div>

        <div className="flex items-center gap-2">
          <Popover onOpenChange={(open) => open && onFetchOdds()}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <Info className="h-4 w-4 mr-1" /> Odds
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <p className="text-sm font-medium mb-2">Rating odds (Season {pack.season})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
                {odds?.length ? (
                  odds.map((o) => (
                    <div key={o.rating} className="flex justify-between">
                      <span>OVR {o.rating}</span>
                      <span>{o.pct}%</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Loading...</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button size="sm" className="flex-[2]" onClick={onOpen} disabled={disabled}>
            {charging ? "Opening..." : disabled && disabledLabel ? disabledLabel : "Open Pack"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
