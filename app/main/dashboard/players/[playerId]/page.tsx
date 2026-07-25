"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueSettings } from "@/contexts/LeagueSettingsContext";
import { getStatColor, getStatTextColor } from "@/hooks/getStatColor";
import { PlayerAttributeRadar } from "@/components/dashboard/charts/PlayerAttributeRadar";
import { Images } from "@/lib/assets";
import { ArrowLeft, ListPlus, Trash2, DollarSign, ArrowRightLeft, Users } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast, Toaster } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const statCategories: Record<string, string[]> = {
  Attacking: [
    "crossing",
    "finishing",
    "heading_accuracy",
    "short_passing",
    "volleys",
  ],
  Skill: [
    "dribbling",
    "curve",
    "fk_accuracy",
    "long_passing",
    "ball_control",
  ],
  Movement: [
    "acceleration",
    "sprint_speed",
    "agility",
    "reactions",
    "balance",
  ],
  Power: ["shot_power", "jumping", "stamina", "strength", "long_shots"],
  Mentality: [
    "aggression",
    "interceptions",
    "positioning",
    "vision",
    "penalties",
    "composure",
  ],
  Defending: ["defensive_awareness", "standing_tackle", "sliding_tackle"],
  Goalkeeping: [
    "gk_diving",
    "gk_handling",
    "gk_kicking",
    "gk_positioning",
    "gk_reflexes",
  ],
};

function avg(values: Array<number | undefined>): number {
  const nums = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default function PlayerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { selectedLeagueId } = useLeague();
  const { settings } = useLeagueSettings();
  const playerId = params.playerId as string;
  const leagueId = searchParams.get("league") || selectedLeagueId;

  const [player, setPlayer] = useState<any>(null);
  const [context, setContext] = useState<{ isOwnTeam: boolean; isHost: boolean; isFreeAgent: boolean; teamId: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listLookingFor, setListLookingFor] = useState("");
  const [listAcceptsTrades, setListAcceptsTrades] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);

  useEffect(() => {
    if (!leagueId || !playerId) {
      setError("Missing league or player");
      setLoading(false);
      return;
    }
    fetchPlayer();
  }, [leagueId, playerId]);

  const fetchPlayer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/league/players/${playerId}?leagueId=${leagueId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setPlayer(data.player);
      setContext(data.context);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferList = async () => {
    if (!context?.teamId) return;
    setActionLoading("transfer");
    try {
      const res = await fetch(`/api/team/${context.teamId}/player/transfer-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Player added to transfer list");
      fetchPlayer();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleListForSale = async () => {
    if (!context?.teamId) return;
    const price = parseInt(listPrice, 10);
    if (isNaN(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    setActionLoading("listSale");
    try {
      const res = await fetch("/api/transfer-list/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: context.teamId,
          playerId,
          askingPrice: price,
          lookingFor: listLookingFor || undefined,
          acceptsTrades: listAcceptsTrades,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Player listed for sale");
      setListModalOpen(false);
      setListPrice("");
      setListLookingFor("");
      setListAcceptsTrades(false);
      fetchPlayer();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscard = async () => {
    if (!context?.teamId) return;
    setActionLoading("discard");
    try {
      const res = await fetch(`/api/team/${context.teamId}/player/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Player discarded");
      router.push(`/main/dashboard/squad?league=${leagueId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !player || !context) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="mt-4 text-destructive">{error || "Player not found"}</p>
      </div>
    );
  }

  const imageSrc = player.image?.startsWith("http")
    ? `/api/proxy-image?url=${encodeURIComponent(player.image)}`
    : player.image || Images.NoImage.src;

  const formatStatName = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Safe value/wage formatting - never show NaN
  const displayValue =
    typeof player.value === "number" && !isNaN(player.value)
      ? player.value >= 1_000_000
        ? `€${(player.value / 1_000_000).toFixed(1)}M`
        : player.value >= 1000
          ? `€${(player.value / 1000).toFixed(0)}K`
          : `€${player.value}`
      : null;
  const displayWage =
    typeof player.wage === "number" && !isNaN(player.wage)
      ? player.wage >= 1000
        ? `€${(player.wage / 1000).toFixed(0)}K`
        : `€${player.wage}`
      : null;

  const lp = player.leaguePlayer as Record<string, unknown> | undefined;
  const overall = lp?.rating ?? player.overall_rating ?? player.rating ?? 0;
  const getStatValue = (stat: string) => {
    const v = lp?.[stat] ?? player[stat];
    return typeof v === "number" && !isNaN(v) ? v : 0;
  };

  const editPlayerUrl = context.isHost && leagueId && player.leaguePlayerId && context.teamId
    ? `/main/dashboard/add-player?edit=${player.leaguePlayerId}&teamId=${context.teamId}&league=${leagueId}`
    : null;

  const proposeTradeUrl = context.teamId
    ? `/main/dashboard/trades?league=${leagueId}&proposeTo=${context.teamId}&requestPlayer=${playerId}`
    : null;

  const isGK = (player.positions || "").toUpperCase().includes("GK");
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

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
      <Toaster position="top-center" richColors />
      <div className="flex items-center justify-between">
        <Breadcrumbs lastLabel={player.full_name || player.name} />
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Hero banner */}
      <div className="rounded-lg border border-border bg-surface p-6 flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-4 lg:gap-5 flex-1 min-w-0">
          <img
            src={imageSrc}
            alt={player.full_name || player.name}
            width={96}
            height={96}
            className="rounded-lg object-cover w-24 h-24 ring-1 ring-border bg-surface-2 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = Images.NoImage.src;
            }}
          />
          <div className="min-w-0">
            <h1 className="font-display text-3xl tracking-tight leading-tight truncate">
              {player.full_name || player.name}
            </h1>
            <div className="flex flex-wrap gap-1.5 items-center mt-2">
              {(player.positions || "")
                .split(/[,/]/)
                .map((p: string) => p.trim())
                .filter(Boolean)
                .map((p: string) => (
                  <Badge key={p} variant="outline" className="text-xs">
                    {p}
                  </Badge>
                ))}
              {context.isOwnTeam ? (
                <Badge variant="secondary" className="text-xs">
                  Your Squad
                </Badge>
              ) : context.isFreeAgent ? (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Free Agent
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {player.ilTeam?.name || "Other Team"}
                </Badge>
              )}
              {player.isInjured && (
                <Badge variant="destructive" className="text-xs">
                  {player.injuryType || "Injured"} · {player.gamesRemaining} games out
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
              {player.age != null && <span>{player.age} y.o.</span>}
              {player.height_cm && <span>{player.height_cm} cm</span>}
              {player.weight_kg && <span>{player.weight_kg} kg</span>}
            </div>
            {player.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2 max-w-2xl">
                {player.description}
              </p>
            )}
          </div>
        </div>

        {/* Key ratings */}
        <div className="flex items-center gap-3 lg:gap-4 lg:shrink-0 flex-wrap lg:flex-nowrap lg:pl-6 lg:border-l lg:border-border">
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-lg font-display text-2xl ${getStatColor(
                Number(overall)
              )}`}
            >
              {overall}
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1.5">
              Overall
            </p>
          </div>
          {player.leaguePlayer?.is_youngster && player.leaguePlayer?.potential != null && (
            <div className="text-center">
              <div
                className={`inline-flex items-center justify-center w-16 h-16 rounded-xl text-2xl font-bold ${getStatColor(
                  Number(player.leaguePlayer.potential)
                )}`}
              >
                {player.leaguePlayer.potential}
              </div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1.5">
                Potential
              </p>
            </div>
          )}
          {displayValue && (
            <div className="text-center min-w-[72px]">
              <p className="text-xl font-bold tabular-nums">{displayValue}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                Value
              </p>
            </div>
          )}
          {displayWage && (
            <div className="text-center min-w-[72px]">
              <p className="text-xl font-bold tabular-nums">{displayWage}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                Wage
              </p>
            </div>
          )}
          {player.release_clause && (
            <div className="text-center min-w-[72px]">
              <p className="text-xl font-bold tabular-nums">{player.release_clause}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
                Release Clause
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Attributes + Analysis/Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Attributes - FM style columns */}
        <Card className="bg-surface border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attributes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="columns-1 sm:columns-2 gap-x-8">
              {Object.entries(statCategories)
                .filter(([cat]) => (isGK ? true : cat !== "Goalkeeping"))
                .sort(([a], [b]) => {
                  if (!isGK) return 0;
                  if (a === "Goalkeeping") return -1;
                  if (b === "Goalkeeping") return 1;
                  return 0;
                })
                .map(([cat, keys]) => (
                  <div key={cat} className="break-inside-avoid mb-5">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 pb-1.5 border-b border-border">
                      {cat}
                    </h4>
                    <div>
                      {keys.map((stat) => {
                        const val = getStatValue(stat);
                        const safeVal = isNaN(Number(val)) ? 0 : Math.min(99, Math.max(1, Number(val)));
                        return (
                          <div
                            key={stat}
                            className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0"
                          >
                            <span className="text-sm text-muted-foreground">
                              {formatStatName(stat)}
                            </span>
                            <span className={`text-sm font-semibold tabular-nums ${getStatTextColor(safeVal)}`}>
                              {safeVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Attribute analysis + Actions */}
        <div className="flex flex-col gap-6">
          <Card className="bg-surface border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Attribute Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerAttributeRadar data={mainStats} />
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {editPlayerUrl && (
                <Link href={editPlayerUrl}>
                  <Button variant="outline" className="w-full">
                    Edit Player
                  </Button>
                </Link>
              )}

              {context.isOwnTeam && (
                <>
                  <Button
                    variant={player.isOnTransferList ? "secondary" : "outline"}
                    className="w-full"
                    onClick={handleTransferList}
                    disabled={actionLoading !== null}
                  >
                    <ListPlus className="mr-2 h-4 w-4" />
                    {player.isOnTransferList
                      ? "Remove from Transfer List"
                      : "Transfer List"}
                  </Button>
                  {settings.transferWindowOpen && (
                    <Dialog open={listModalOpen} onOpenChange={setListModalOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={actionLoading !== null || player.isListedForSale}
                        >
                          <DollarSign className="mr-2 h-4 w-4" />
                          {player.isListedForSale ? "Listed for Sale" : "List for Sale"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-surface border-border">
                        <DialogHeader>
                          <DialogTitle>List for Sale</DialogTitle>
                          <DialogDescription>
                            Set an asking price. Other teams in your league can buy this player.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Asking Price (€)</Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="e.g. 5000000"
                              value={listPrice}
                              onChange={(e) => setListPrice(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Looking For (optional)</Label>
                            <Input
                              placeholder="e.g. 81+ RB, specific player"
                              value={listLookingFor}
                              onChange={(e) => setListLookingFor(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="accepts-trades"
                              checked={listAcceptsTrades}
                              onCheckedChange={(v) => setListAcceptsTrades(!!v)}
                            />
                            <Label htmlFor="accepts-trades" className="text-sm font-normal cursor-pointer">
                              Trades or cash
                            </Label>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setListModalOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={handleListForSale}
                            disabled={actionLoading === "listSale"}
                          >
                            {actionLoading === "listSale" ? (
                              <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Listing...
                              </span>
                            ) : (
                              "List for Sale"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleDiscard}
                    disabled={actionLoading !== null}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Discard Player
                  </Button>
                </>
              )}

              {!context.isOwnTeam && !context.isFreeAgent && proposeTradeUrl && (
                <Link href={proposeTradeUrl}>
                  <Button variant="outline" className="w-full">
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Propose Trade
                  </Button>
                </Link>
              )}

              {context.isFreeAgent && (
                <div className="rounded-lg border border-border bg-surface-2 p-3 flex gap-2.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    This player is a <span className="text-foreground font-medium">Free Agent</span> —
                    not currently on a team. Free agents are distributed via packs, free agency, or the draft,
                    and cannot be acquired directly.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Profile & Club — one panel, three columns, instead of three separate cards repeating the same chrome */}
      <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
        <div className="px-6 pt-5 pb-1">
          <h2 className="font-display text-2xl">Profile &amp; Club</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border mt-3">
          <div className="p-6 pt-3 space-y-2 text-sm">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Profile</p>
            {player.preferred_foot && (
              <p>
                <span className="text-muted-foreground">Preferred foot </span>
                {player.preferred_foot}
              </p>
            )}
            {player.skill_moves != null && player.skill_moves !== "" && (
              <p>
                <span className="text-muted-foreground">Skill moves </span>
                {!isNaN(Number(player.skill_moves)) ? `${player.skill_moves} ★` : player.skill_moves}
              </p>
            )}
            {player.weak_foot != null && player.weak_foot !== "" && (
              <p>
                <span className="text-muted-foreground">Weak foot </span>
                {!isNaN(Number(player.weak_foot)) ? `${player.weak_foot} ★` : player.weak_foot}
              </p>
            )}
            {player.body_type && (
              <p>
                <span className="text-muted-foreground">Body type </span>
                {player.body_type}
              </p>
            )}
            {(() => {
              const irMatch = String(player.international_reputation || "").match(/\d+/);
              return irMatch ? (
                <p>
                  <span className="text-muted-foreground">International reputation </span>
                  {irMatch[0]} ★
                </p>
              ) : null;
            })()}
            {!player.preferred_foot &&
              !player.skill_moves &&
              !player.weak_foot &&
              !player.body_type &&
              !player.international_reputation && (
                <p className="text-muted-foreground">—</p>
              )}
          </div>
          <div className="p-6 pt-3 space-y-2 text-sm">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              {player.specialities ? "Player Specialities" : "Real-world Club"}
            </p>
            {player.specialities ? (
              <p>{player.specialities}</p>
            ) : player.club_name ? (
              <>
                <p className="font-medium">{player.club_name}</p>
                {player.club_position && (
                  <p>
                    <span className="text-muted-foreground">Position </span>
                    {player.club_position}
                  </p>
                )}
                {player.club_kit_number && (
                  <p>
                    <span className="text-muted-foreground">Kit number </span>
                    {player.club_kit_number}
                  </p>
                )}
                {player.club_joined && (
                  <p>
                    <span className="text-muted-foreground">Joined </span>
                    {player.club_joined}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
          <div className="p-6 pt-3 space-y-2 text-sm">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Club (IL)</p>
            {player.ilTeam?.name && (
              <p className="font-medium">{player.ilTeam.name}</p>
            )}
            {player.ilLeague?.name && (
              <p>
                <span className="text-muted-foreground">League </span>
                {player.ilLeague.name}
              </p>
            )}
            {player.ilLeague?.season && (
              <p>
                <span className="text-muted-foreground">Season </span>
                {player.ilLeague.season}
              </p>
            )}
            {player.ilContract && (
              <p>
                <span className="text-muted-foreground">Contract until </span>
                Season {player.ilContract.contract_until_season ?? "—"}
              </p>
            )}
            {!player.ilTeam?.name && !player.ilLeague?.name && (
              <p className="text-muted-foreground">
                {context.isFreeAgent ? "Free Agent" : "—"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* PlayStyles - Sofifa style */}
      {player.play_styles && (
        <Card className="bg-surface border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              PlayStyles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {String(player.play_styles)
                .split(/[,;]/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((style) => (
                  <Badge key={style} variant="secondary">
                    {style}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
