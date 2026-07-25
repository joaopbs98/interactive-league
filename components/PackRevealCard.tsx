"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, ArrowLeftRight, Trash2, Loader2, Shield } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";

interface PackRevealCardProps {
  player: {
    player_id: string;
    name: string;
    full_name?: string;
    positions: string;
    overall_rating: number;
    image?: string;
    country_name?: string;
    country_flag?: string;
  };
  /** "flip" = back/front 3D flip card used during sequential reveal. "static" = front-only, used in summary grid. */
  mode?: "flip" | "static";
  /** Only relevant in "flip" mode - whether the card is currently showing its front face. */
  flipped?: boolean;
  /** Stagger animation delay (ms), used in static mode. */
  revealDelay?: number;
  className?: string;
  /** When provided (with leagueId), renders the View / Transfer List / Discard action row in static mode. */
  teamId?: string;
  leagueId?: string;
}

export function PackRevealCard({
  player,
  mode = "static",
  flipped = true,
  revealDelay = 0,
  className = "",
  teamId,
  leagueId,
}: PackRevealCardProps) {
  const displayName = player.full_name || player.name;
  const rating = player.overall_rating ?? 0;

  const isElite = rating >= 85;
  const isLegendary = rating >= 90;
  const glowColor = isLegendary
    ? "rgba(250,204,21,0.55)"
    : isElite
      ? "rgba(99,102,241,0.5)"
      : "transparent";

  const [actionState, setActionState] = useState<"idle" | "transferred" | "discarded">("idle");
  const [actionLoading, setActionLoading] = useState<"transfer" | "discard" | null>(null);

  const handleTransferList = async () => {
    if (!teamId) return;
    setActionLoading("transfer");
    try {
      const res = await fetch(`/api/team/${teamId}/player/transfer-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.player_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Player added to transfer list");
      setActionState("transferred");
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer list player");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscard = async () => {
    if (!teamId) return;
    setActionLoading("discard");
    try {
      const res = await fetch(`/api/team/${teamId}/player/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.player_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(data.message || "Player discarded");
      setActionState("discarded");
    } catch (err: any) {
      toast.error(err.message || "Failed to discard player");
    } finally {
      setActionLoading(null);
    }
  };

  const cardFace = (
    <div
      className={`relative h-full w-full flex items-center justify-center ${isLegendary ? "shimmer-sweep" : ""}`}
      style={{ "--pack-glow-color": glowColor } as React.CSSProperties}
    >
      <PlayerCard player={player} size="lg" className="w-full" />
    </div>
  );

  const cardBack = (
    <div className="relative overflow-hidden rounded-xl border-2 border-[var(--border-strong)] bg-gradient-to-br from-[var(--surface-2)] via-[var(--surface)] to-[var(--surface-3)] aspect-square min-h-[200px] flex flex-col items-center justify-center h-full w-full shimmer-sweep">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent-muted)] border border-[var(--accent)]/40">
        <Shield className="w-10 h-10 text-[var(--accent)]" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Interactive League
      </p>
    </div>
  );

  if (mode === "flip") {
    return (
      <div className={`relative ${className}`} style={{ perspective: "1400px" }}>
        <div
          className="relative w-full h-full transition-transform duration-700 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            {cardBack}
          </div>
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            {/* outer glow ring for high-rated pulls */}
            {isElite && (
              <div
                className="absolute -inset-1.5 rounded-2xl pack-glow-pulse pointer-events-none"
                style={{ "--pack-glow-color": glowColor } as React.CSSProperties}
              />
            )}
            {cardFace}
          </div>
        </div>
      </div>
    );
  }

  const showActions = !!(teamId && leagueId);

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      style={{
        animation: revealDelay > 0 ? `fadeInUp 0.4s ease-out ${revealDelay}ms both` : undefined,
      }}
    >
      <div className="relative">
        {isElite && (
          <div
            className="absolute -inset-1.5 rounded-2xl pack-glow-pulse pointer-events-none"
            style={{ "--pack-glow-color": glowColor } as React.CSSProperties}
          />
        )}
        <div className="relative">{cardFace}</div>
      </div>

      <div className="text-center">
        <p className="font-bold text-sm uppercase tracking-wide truncate">{displayName}</p>
        {player.country_name && (
          <p className="text-xs text-muted-foreground truncate">{player.country_name}</p>
        )}
      </div>

      {showActions && (
        <div className="flex items-center gap-1.5">
          <Link href={`/main/dashboard/players/${player.player_id}?league=${leagueId}`} className="flex-1">
            <Button size="sm" variant="outline" className="w-full">
              <Eye className="h-3.5 w-3.5 mr-1" /> View
            </Button>
          </Link>

          {actionState === "idle" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={actionLoading !== null}
                onClick={handleTransferList}
              >
                {actionLoading === "transfer" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                )}
                List
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-status-negative hover:text-status-negative"
                disabled={actionLoading !== null}
                onClick={handleDiscard}
              >
                {actionLoading === "discard" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                )}
                Discard
              </Button>
            </>
          )}

          {actionState === "transferred" && (
            <span className="flex-[2] text-center text-xs font-medium rounded-md py-1.5 bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/30">
              Transfer Listed
            </span>
          )}

          {actionState === "discarded" && (
            <span className="flex-[2] text-center text-xs font-medium rounded-md py-1.5 bg-status-negative/10 text-status-negative border border-status-negative/30">
              Discarded
            </span>
          )}
        </div>
      )}
    </div>
  );
}
