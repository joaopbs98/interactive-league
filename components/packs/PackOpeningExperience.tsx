"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PackRevealCard } from "@/components/PackRevealCard";
import { Package, X } from "lucide-react";

type PackResult = {
  pack: any;
  players: any[];
  remainingBalance?: number;
  newBudget?: number;
  currentSeason?: number;
};

interface PackOpeningExperienceProps {
  packResult: PackResult;
  teamId: string;
  leagueId: string;
  onClose: () => void;
}

const TIER_GLOW: Record<string, string> = {
  Basic: "rgba(148,163,184,0.5)",
  Prime: "rgba(99,102,241,0.55)",
  Elite: "rgba(250,204,21,0.6)",
};

type Stage = "intro" | "burst" | number | "summary";

export function PackOpeningExperience({ packResult, teamId, leagueId, onClose }: PackOpeningExperienceProps) {
  const players = (packResult.players || []).filter(
    (p: any) => !p.player_id?.startsWith?.("placeholder_")
  );
  const packType = packResult.pack?.pack_type || "Basic";
  const glow = TIER_GLOW[packType] || TIER_GLOW.Basic;

  const [stage, setStage] = useState<Stage>("intro");
  const [flipped, setFlipped] = useState<boolean[]>(() => players.map(() => false));
  const [anticipating, setAnticipating] = useState(false);

  // Burst -> first reveal
  useEffect(() => {
    if (stage !== "burst") return;
    const t = setTimeout(() => setStage(players.length > 0 ? 0 : "summary"), 600);
    return () => clearTimeout(t);
  }, [stage, players.length]);

  // Reveal stage progression: anticipation (for high-rated pulls) -> flip -> hold -> advance
  useEffect(() => {
    if (typeof stage !== "number") return;

    let cancelled = false;
    const player = players[stage];
    const rating = player?.overall_rating ?? 0;
    const isHighRated = rating >= 85;

    const run = async () => {
      if (isHighRated) {
        setAnticipating(true);
        await new Promise((r) => setTimeout(r, 900));
        if (cancelled) return;
        setAnticipating(false);
      }

      setFlipped((prev) => {
        const next = [...prev];
        next[stage] = true;
        return next;
      });

      const holdTime = isHighRated ? 1900 : 1300;
      await new Promise((r) => setTimeout(r, holdTime));
      if (cancelled) return;

      if (stage < players.length - 1) {
        setStage(stage + 1);
      } else {
        setStage("summary");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const handleSkip = () => {
    setAnticipating(false);
    setFlipped(players.map(() => true));
    setStage("summary");
  };

  const handleCardTap = () => {
    if (typeof stage !== "number") return;
    if (anticipating || !flipped[stage]) return;
    if (stage < players.length - 1) {
      setStage(stage + 1);
    } else {
      setStage("summary");
    }
  };

  const packVisual = (
    <div
      className="flex items-center justify-center w-48 h-48 rounded-3xl border border-white/10"
      style={{
        background: `radial-gradient(circle at 50% 35%, ${glow}, transparent 70%)`,
      }}
    >
      <Package className="w-24 h-24 text-white/90" strokeWidth={1.25} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
      {stage !== "summary" && (
        <button
          onClick={handleSkip}
          className="absolute top-6 right-6 flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white border border-white/15 hover:border-white/30 rounded-full px-3.5 py-1.5 transition-colors"
        >
          Skip <X className="w-3.5 h-3.5" />
        </button>
      )}

      <AnimatePresence mode="wait">
        {stage === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6 cursor-pointer"
            onClick={() => setStage("burst")}
          >
            <div className="pack-glow-pulse rounded-3xl" style={{ "--pack-glow-color": glow } as React.CSSProperties}>
              {packVisual}
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-white">{packResult.pack?.name || "Pack"}</p>
              <p className="text-sm text-white/60 mt-1 animate-pulse">Tap to open</p>
            </div>
          </motion.div>
        )}

        {stage === "burst" && (
          <motion.div
            key="burst"
            initial={{ opacity: 1 }}
            className="pack-burst rounded-3xl"
            style={{ "--pack-glow-color": glow } as React.CSSProperties}
          >
            {packVisual}
          </motion.div>
        )}

        {typeof stage === "number" && players[stage] && (
          <motion.div
            key={`reveal-${stage}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-5"
          >
            <div
              className={`w-72 cursor-pointer ${anticipating ? "card-anticipation" : ""}`}
              onClick={handleCardTap}
            >
              <PackRevealCard
                player={{
                  player_id: players[stage].player_id,
                  name: players[stage].name,
                  full_name: players[stage].full_name,
                  positions: players[stage].positions || "",
                  overall_rating: players[stage].overall_rating ?? 0,
                  image: players[stage].image,
                  country_name: players[stage].country_name,
                  country_flag: players[stage].country_flag,
                }}
                mode="flip"
                flipped={flipped[stage]}
                className="w-72 h-72"
              />
            </div>
            <p className="text-sm text-white/50 font-medium tracking-wide">
              {stage + 1} / {players.length}
            </p>
          </motion.div>
        )}

        {stage === "summary" && (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-6 max-h-[90vh] overflow-y-auto px-4 py-8"
          >
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">Pack Opened!</h2>
              <p className="text-sm text-white/60">{packResult.pack?.name || "Unknown Pack"}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
              {players.map((player: any, index: number) => (
                <PackRevealCard
                  key={player.player_id || index}
                  player={{
                    player_id: player.player_id,
                    name: player.name,
                    full_name: player.full_name,
                    positions: player.positions || "",
                    overall_rating: player.overall_rating ?? 0,
                    image: player.image,
                    country_name: player.country_name,
                    country_flag: player.country_flag,
                  }}
                  mode="static"
                  revealDelay={index * 100}
                  teamId={teamId}
                  leagueId={leagueId}
                />
              ))}
            </div>

            <p className="text-xs text-white/40">Manage players in the Squad tab</p>

            <Button onClick={onClose} size="lg" className="min-w-[160px]">
              Continue
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
