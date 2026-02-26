"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueSettings } from "@/contexts/LeagueSettingsContext";
import { getStatColor } from "@/hooks/getStatColor";
import { Images } from "@/lib/assets";
import { ArrowLeft, ListPlus, Trash2, DollarSign } from "lucide-react";
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

export default function SquadPlayerPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { selectedTeam, selectedLeagueId } = useLeague();
  const { settings } = useLeagueSettings();
  const playerId = params.playerId as string;
  const teamId = searchParams.get("teamId") || selectedTeam?.id;
  const leagueId = searchParams.get("league") || selectedLeagueId;

  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [listLookingFor, setListLookingFor] = useState("");
  const [listAcceptsTrades, setListAcceptsTrades] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);

  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

  useEffect(() => {
    if (!teamId || !playerId) {
      setError("Missing team or player");
      setLoading(false);
      return;
    }
    fetchPlayer();
  }, [teamId, playerId]);

  const fetchPlayer = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/team/${teamId}/player/${playerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      const p = data.player;
      setPlayer(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferList = async () => {
    if (!teamId) return;
    setActionLoading("transfer");
    try {
      const res = await fetch(`/api/team/${teamId}/player/transfer-list`, {
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
    if (!teamId) return;
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
          teamId,
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
    if (!teamId) return;
    setActionLoading("discard");
    try {
      const res = await fetch(`/api/team/${teamId}/player/discard`, {
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

  if (error || !player) {
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

  const editPlayerUrl = teamId && leagueId && player.leaguePlayerId
    ? `/main/dashboard/add-player?edit=${player.leaguePlayerId}&teamId=${teamId}&league=${leagueId}`
    : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Toaster position="top-center" richColors />
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Squad
      </Button>

      {/* Header - Sofifa style */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="shrink-0">
                <img
                  src={imageSrc}
                  alt={player.full_name || player.name}
                  width={160}
                  height={160}
                  className="rounded-lg object-cover w-40 h-40"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = Images.NoImage.src;
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {player.full_name || player.name}
                </h1>
                <div className="flex flex-wrap gap-2 items-center mt-1">
                  <Badge variant="secondary" className="font-medium">
                    {player.positions}
                  </Badge>
                  {player.age != null && (
                    <span className="text-sm text-muted-foreground">
                      {player.age} y.o.
                    </span>
                  )}
                  {player.height_cm && (
                    <span className="text-sm text-muted-foreground">
                      {player.height_cm} cm
                    </span>
                  )}
                  {player.weight_kg && (
                    <span className="text-sm text-muted-foreground">
                      {player.weight_kg} kg
                    </span>
                  )}
                </div>
                {player.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                    {player.description}
                  </p>
                )}
                {/* Key ratings - Sofifa style boxes */}
                <div className="flex flex-wrap gap-4 mt-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">
                      Overall rating
                    </div>
                    <div
                      className={`inline-flex items-center justify-center w-14 h-14 rounded-lg text-xl font-bold ${getStatColor(
                        Number(overall)
                      )}`}
                    >
                      {overall}
                    </div>
                  </div>
                  {displayValue && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">
                        Value
                      </div>
                      <div className="text-xl font-semibold text-foreground">
                        {displayValue}
                      </div>
                    </div>
                  )}
                  {displayWage && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">
                        Wage
                      </div>
                      <div className="text-xl font-semibold text-foreground">
                        {displayWage}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="w-full lg:w-72 shrink-0">
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isHost && player.leaguePlayerId && editPlayerUrl && (
              <Link href={editPlayerUrl}>
                <Button variant="outline" className="w-full">
                  Edit Player
                </Button>
              </Link>
            )}
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
                <DialogContent>
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
                        className="bg-neutral-800"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Looking For (optional)</Label>
                      <Input
                        placeholder="e.g. 81+ RB, specific player"
                        value={listLookingFor}
                        onChange={(e) => setListLookingFor(e.target.value)}
                        className="bg-neutral-800"
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
          </CardContent>
        </Card>
      </div>

      {/* Profile & Club - Sofifa style columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {player.preferred_foot && (
              <p>
                <span className="text-muted-foreground">Preferred foot </span>
                {player.preferred_foot}
              </p>
            )}
            {player.skill_moves != null && (
              <p>
                <span className="text-muted-foreground">Skill moves </span>
                {player.skill_moves} ★
              </p>
            )}
            {player.weak_foot != null && (
              <p>
                <span className="text-muted-foreground">Weak foot </span>
                {player.weak_foot} ★
              </p>
            )}
            {player.body_type && (
              <p>
                <span className="text-muted-foreground">Body type </span>
                {player.body_type}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">IL RC </span>
              —
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Player specialities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {player.specialities ? (
              <p className="text-sm">{player.specialities}</p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Club (IL)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
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
            {player.positions && (
              <p>
                <span className="text-muted-foreground">Position </span>
                {player.positions.split(",")[0]?.trim() || player.positions}
              </p>
            )}
            {player.ilContract && (
              <p>
                <span className="text-muted-foreground">Contract until </span>
                Season {player.ilContract.contract_until_season ?? "—"}
              </p>
            )}
            {!player.ilTeam?.name && !player.ilLeague?.name && (
              <p className="text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats - Sofifa style by category */}
      <Tabs defaultValue="Attacking" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {Object.keys(statCategories).map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(statCategories).map(([cat, keys]) => (
          <TabsContent key={cat} value={cat} className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {keys.map((stat) => {
                    const val = getStatValue(stat);
                    const safeVal = isNaN(Number(val)) ? 0 : Math.min(99, Math.max(1, Number(val)));
                    return (
                      <div
                        key={stat}
                        className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm text-muted-foreground">
                          {formatStatName(stat)}
                        </span>
                        <Badge
                          className={`min-w-[2.5rem] justify-center ${getStatColor(safeVal)}`}
                        >
                          {safeVal}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* PlayStyles - Sofifa style */}
      {player.play_styles && (
        <Card>
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
