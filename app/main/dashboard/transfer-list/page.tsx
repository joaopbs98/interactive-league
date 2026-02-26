"use client";

import React, { useEffect, useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { useLeagueSettings } from "@/contexts/LeagueSettingsContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Images } from "@/lib/assets";
import { Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { toast, Toaster } from "sonner";

type Listing = {
  id: string;
  player_id: string;
  team_id: string;
  asking_price: number;
  listed_at: string;
  looking_for?: string | null;
  accepts_trades?: boolean;
  seller_team: { id: string; name: string; acronym?: string };
  player_name: string;
  positions: string;
  rating: number;
  club_position?: string | null;
  club_rating?: string | null;
  image?: string | null;
};

export default function TransferListPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const { triggerRefresh } = useRefresh();
  const { settings } = useLeagueSettings();
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const transferWindowOpen = settings.transferWindowOpen;

  useEffect(() => {
    if (!selectedLeagueId) {
      setListings([]);
      setMyListings([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/transfer-list?leagueId=${encodeURIComponent(selectedLeagueId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          const all = json.data as Listing[];
          setListings(all.filter((l) => l.team_id !== selectedTeam?.id));
          setMyListings(all.filter((l) => l.team_id === selectedTeam?.id));
        } else {
          setListings([]);
          setMyListings([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListings([]);
          setMyListings([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLeagueId, selectedTeam?.id]);

  const handleBuy = async (listing: Listing) => {
    if (!selectedTeam?.id) return;
    setActionLoading(listing.id);
    try {
      const res = await fetch("/api/transfer-list/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          buyerTeamId: selectedTeam.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to buy");
      toast.success("Player purchased!");
      triggerRefresh();
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (listing: Listing) => {
    setActionLoading(listing.id);
    try {
      const res = await fetch("/api/transfer-list/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      toast.success("Listing removed");
      triggerRefresh();
      setMyListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const formatPrice = (n: number) =>
    n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `€${(n / 1000).toFixed(0)}K` : `€${n}`;

  const imageSrc = (img: string | null | undefined) =>
    img?.startsWith("http")
      ? `/api/proxy-image?url=${encodeURIComponent(img)}`
      : img || Images.NoImage.src;

  if (!selectedLeagueId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Transfer List</h1>
        <p className="text-muted-foreground">Select a league to view the transfer list.</p>
      </div>
    );
  }

  if (!transferWindowOpen) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Transfer List</h1>
        <p className="text-muted-foreground">
          The transfer window is closed. Listings are only available during the off-season.
        </p>
      </div>
    );
  }

  const PlayerCard = ({
    listing,
    onBuy,
    onRemove,
    isOwn,
  }: {
    listing: Listing;
    onBuy?: () => void;
    onRemove?: () => void;
    isOwn: boolean;
  }) => (
    <Card className="bg-neutral-900 border-neutral-800 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          <img
            src={imageSrc(listing.image)}
            alt={listing.player_name}
            className="w-16 h-16 rounded object-cover shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = Images.NoImage.src;
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{listing.player_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">
                {listing.positions}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {listing.club_position && listing.club_rating
                  ? `${listing.rating} (${listing.club_rating} ${listing.club_position})`
                  : `${listing.rating} OVR`}
              </span>
            </div>
            {listing.looking_for && (
              <p className="text-xs text-muted-foreground mt-0.5">Looking for: {listing.looking_for}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {listing.seller_team?.name || "Unknown"}
              {listing.accepts_trades && (
                <span className="ml-1 text-xs text-green-500">• Trades or cash</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end justify-between shrink-0">
            <p className="font-bold text-lg">{formatPrice(listing.asking_price)}</p>
            {isOwn && onRemove && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onRemove}
                disabled={actionLoading === listing.id}
              >
                {actionLoading === listing.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </>
                )}
              </Button>
            )}
            {!isOwn && onBuy && (
              <Button
                size="sm"
                onClick={onBuy}
                disabled={actionLoading === listing.id}
              >
                {actionLoading === listing.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Buy
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-8 space-y-6">
      <Toaster position="top-center" richColors />
      <h1 className="text-2xl font-bold">Transfer List</h1>
      <p className="text-muted-foreground">
        Buy and sell players with other teams in your league. List players from your Squad page.
      </p>

      {loading ? (
        <div className="p-6">
          <PageSkeleton variant="table" rows={6} />
        </div>
      ) : (
        <>
          {myListings.length > 0 && (
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-lg">My Listings</CardTitle>
                <CardDescription>Players you have listed for sale</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {myListings.map((l) => (
                  <PlayerCard
                    key={l.id}
                    listing={l}
                    isOwn
                    onRemove={() => handleRemove(l)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-lg">Marketplace</CardTitle>
              <CardDescription>Players listed by other teams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {listings.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground text-lg font-medium mb-2">No players listed.</p>
                  <p className="text-sm text-muted-foreground">
                    List players from your Squad when the transfer window is open.
                  </p>
                </div>
              ) : (
                listings.map((l) => (
                  <PlayerCard
                    key={l.id}
                    listing={l}
                    isOwn={false}
                    onBuy={() => handleBuy(l)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
