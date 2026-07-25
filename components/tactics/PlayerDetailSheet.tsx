"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlayerAvatar } from "./PlayerAvatar";
import { TacticsPlayer } from "./types";
import { formatPlayerName } from "@/utils/playerUtils";
import { getStatColor } from "@/hooks/getStatColor";

const statCategories: Record<string, string[]> = {
  Attacking: ["crossing", "finishing", "heading_accuracy", "short_passing", "volleys"],
  Skill: ["dribbling", "curve", "fk_accuracy", "long_passing", "ball_control"],
  Movement: ["acceleration", "sprint_speed", "agility", "reactions", "balance"],
  Power: ["shot_power", "jumping", "stamina", "strength", "long_shots"],
  Mentality: ["aggression", "interceptions", "positioning", "vision", "penalties", "composure"],
  Defending: ["defensive_awareness", "standing_tackle", "sliding_tackle"],
  Goalkeeping: ["gk_diving", "gk_handling", "gk_kicking", "gk_positioning", "gk_reflexes"],
};

const formatStatName = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function avg(values: Array<number | undefined>): number {
  const nums = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

interface PlayerDetailSheetProps {
  player: TacticsPlayer | null;
  teamId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerDetailSheet({ player, teamId, open, onOpenChange }: PlayerDetailSheetProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !player || !teamId) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/team/${teamId}/player/${player.player_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.player) setDetails(d.player);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, player, teamId]);

  if (!player) return null;

  const lp = details?.leaguePlayer as Record<string, unknown> | undefined;
  const getStatValue = (stat: string) => {
    const v = lp?.[stat] ?? details?.[stat];
    return typeof v === "number" && !isNaN(v) ? v : 0;
  };

  const isGK = player.positions?.toUpperCase().includes("GK");

  const mainStats = isGK
    ? [
        { label: "DIV", value: getStatValue("gk_diving") },
        { label: "HAN", value: getStatValue("gk_handling") },
        { label: "KIC", value: getStatValue("gk_kicking") },
        { label: "REF", value: getStatValue("gk_reflexes") },
        { label: "SPD", value: avg([getStatValue("acceleration"), getStatValue("sprint_speed")]) },
        { label: "POS", value: getStatValue("gk_positioning") },
      ]
    : [
        { label: "PAC", value: avg([getStatValue("acceleration"), getStatValue("sprint_speed")]) },
        {
          label: "SHO",
          value: avg([
            getStatValue("finishing"),
            getStatValue("shot_power"),
            getStatValue("long_shots"),
            getStatValue("volleys"),
            getStatValue("penalties"),
          ]),
        },
        {
          label: "PAS",
          value: avg([
            getStatValue("vision"),
            getStatValue("crossing"),
            getStatValue("fk_accuracy"),
            getStatValue("short_passing"),
            getStatValue("long_passing"),
            getStatValue("curve"),
          ]),
        },
        {
          label: "DRI",
          value: avg([
            getStatValue("agility"),
            getStatValue("balance"),
            getStatValue("reactions"),
            getStatValue("ball_control"),
            getStatValue("dribbling"),
            getStatValue("composure"),
          ]),
        },
        {
          label: "DEF",
          value: avg([
            getStatValue("interceptions"),
            getStatValue("heading_accuracy"),
            getStatValue("defensive_awareness"),
            getStatValue("standing_tackle"),
            getStatValue("sliding_tackle"),
          ]),
        },
        {
          label: "PHY",
          value: avg([
            getStatValue("jumping"),
            getStatValue("stamina"),
            getStatValue("strength"),
            getStatValue("aggression"),
          ]),
        },
      ];

  const overall = (lp?.rating as number | undefined) ?? player.overall_rating;

  const displayValue =
    typeof details?.value === "number" && !isNaN(details.value)
      ? details.value >= 1_000_000
        ? `€${(details.value / 1_000_000).toFixed(1)}M`
        : details.value >= 1000
          ? `€${(details.value / 1000).toFixed(0)}K`
          : `€${details.value}`
      : typeof details?.value === "string"
        ? details.value
        : null;

  const displayWage =
    typeof details?.wage === "number" && !isNaN(details.wage)
      ? details.wage >= 1000
        ? `€${(details.wage / 1000).toFixed(0)}K`
        : `€${details.wage}`
      : typeof details?.wage === "string"
        ? details.wage
        : null;

  const positionList = (player.positions || "")
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full max-h-[88vh] overflow-y-auto bg-surface border-border p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Player details</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col">
          {/* Header band */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6 pb-5 border-b border-border bg-surface-2/60">
            <div className="w-28 h-28 rounded-lg bg-surface-3 overflow-hidden border border-border shrink-0">
              <PlayerAvatar src={player.image} alt={player.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h3 className="text-xl font-bold">{formatPlayerName(player.full_name || player.name)}</h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2">
                {positionList.map((p) => (
                  <Badge key={p} variant="outline" className="text-xs">
                    {p}
                  </Badge>
                ))}
                {player.isInjured && (
                  <Badge variant="destructive" className="text-xs">
                    {player.injuryType || "Injured"} · {player.gamesRemaining} games out
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Overall</p>
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl text-2xl font-bold ${getStatColor(Number(overall))}`}>
                    {overall}
                  </div>
                </div>
                {displayValue && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Value</p>
                    <p className="text-lg font-semibold">{displayValue}</p>
                  </div>
                )}
                {displayWage && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Wage</p>
                    <p className="text-lg font-semibold">{displayWage}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 pt-5 flex flex-col gap-6">
            {/* Main FIFA-style stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {mainStats.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-surface-2 border border-border">
                  <Badge className={`min-w-[2.5rem] justify-center text-sm ${getStatColor(s.value)}`}>{s.value}</Badge>
                  <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>

            {loading && <p className="text-sm text-muted-foreground text-center">Loading attributes...</p>}

            {!loading && details && (
              <Tabs defaultValue={isGK ? "Goalkeeping" : "Attacking"} className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1">
                  {Object.keys(statCategories).map((cat) => (
                    <TabsTrigger key={cat} value={cat} className="text-xs">
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(statCategories).map(([cat, keys]) => (
                  <TabsContent key={cat} value={cat} className="mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {keys.map((stat) => {
                        const val = getStatValue(stat);
                        const safeVal = isNaN(Number(val)) ? 0 : Math.min(99, Math.max(0, Number(val)));
                        return (
                          <div key={stat} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-2 border border-border">
                            <span className="text-xs text-muted-foreground">{formatStatName(stat)}</span>
                            <Badge className={`min-w-[2.25rem] justify-center ${getStatColor(safeVal)}`}>{safeVal}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
