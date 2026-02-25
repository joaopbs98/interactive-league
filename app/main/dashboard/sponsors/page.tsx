"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { Toaster, toast } from "sonner";
import { Loader2 } from "lucide-react";

type Sponsor = {
  id: string;
  name: string;
  base_payment: number;
  bonus_amount: number | null;
  bonus_condition: string | null;
};

function formatMoney(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export default function SponsorsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [currentSponsorId, setCurrentSponsorId] = useState<string | null>(null);
  const [leagueStatus, setLeagueStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const canChangeSponsor = leagueStatus === "OFFSEASON";

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedTeam?.id || !selectedLeagueId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [sponsorsRes, teamRes, leagueRes] = await Promise.all([
          fetch(`/api/sponsors${selectedLeagueId ? `?leagueId=${selectedLeagueId}` : ""}`),
          fetch(`/api/user/team/${selectedLeagueId}`),
          fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=league_info`).catch(() => null),
        ]);
        if (sponsorsRes.ok) {
          const { sponsors: list } = await sponsorsRes.json();
          setSponsors(list || []);
        }
        if (teamRes.ok) {
          const data = await teamRes.json();
          setCurrentSponsorId(data.team?.sponsor_id ?? null);
        }
        if (leagueRes?.ok) {
          const data = await leagueRes.json();
          setLeagueStatus(data.data?.status ?? null);
        }
      } catch (err) {
        toast.error("Failed to load sponsors");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedLeagueId, selectedTeam?.id]);

  const currentSponsor = currentSponsorId
    ? sponsors.find((s) => s.id === currentSponsorId)
    : null;

  const handleAssign = async (sponsorId: string | null) => {
    if (!selectedTeam?.id) return;
    setAssigning(sponsorId ?? "clear");
    try {
      const res = await fetch(`/api/team/${selectedTeam.id}/sponsor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId }),
      });
      if (res.ok) {
        setCurrentSponsorId(sponsorId);
        toast.success(sponsorId ? "Sponsor signed!" : "Sponsor removed");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to update sponsor");
      }
    } catch {
      toast.error("Failed to update sponsor");
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedTeam) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-semibold">Sponsorships</h2>
        <p className="text-muted-foreground mt-4">Select a league and team to manage sponsors.</p>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <Toaster position="top-center" richColors />
      <h2 className="text-2xl font-semibold">Sponsorships</h2>

      {!canChangeSponsor && (
        <p className="text-sm text-amber-500">
          Sponsor changes are only allowed during OFFSEASON. Current phase: {leagueStatus ?? "—"}
        </p>
      )}

      {/* Current Sponsor */}
      <div>
        <h3 className="text-lg font-medium mb-4">Current Sponsor</h3>
        {currentSponsor ? (
          <Card className="bg-card border-border max-w-md">
            <CardContent className="space-y-4 pt-6">
              <h4 className="text-xl font-semibold">{currentSponsor.name}</h4>
              <div className="flex gap-2 flex-wrap">
                {currentSponsor.bonus_condition && (
                  <Badge variant="outline" className="bg-green-800 text-white">
                    Bonus: {currentSponsor.bonus_condition}
                  </Badge>
                )}
              </div>
              <div className="bg-background p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Base payment (per season)</span>
                  <span className="font-semibold text-green-500">
                    €{formatMoney(currentSponsor.base_payment)}
                  </span>
                </div>
                {currentSponsor.bonus_amount != null && currentSponsor.bonus_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Bonus (if condition met)</span>
                    <span className="font-semibold text-green-500">
                      €{formatMoney(currentSponsor.bonus_amount)}
                    </span>
                  </div>
                )}
              </div>
              {canChangeSponsor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAssign(null)}
                  disabled={!!assigning}
                >
                  {assigning === "clear" ? "Removing…" : "Remove Sponsor"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border max-w-md border-dashed">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No sponsor signed yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Sign a sponsor below to receive base payment and bonuses at end of season.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Available Sponsors */}
      <div>
        <h3 className="text-lg font-medium mb-4">Available Sponsors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sponsors.map((s) => {
            const isCurrent = s.id === currentSponsorId;
            const hasBonus = s.bonus_condition && s.bonus_amount != null && s.bonus_amount > 0;
            return (
              <Card key={s.id} className="bg-card border-border">
                <CardContent className="space-y-4 pt-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">{s.name}</h4>
                    {hasBonus && (
                      <Badge variant="outline" className="bg-green-800 text-white text-xs">
                        {s.bonus_condition}
                      </Badge>
                    )}
                  </div>
                  <div className="bg-background p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Base (per season)</span>
                      <span className="font-semibold text-green-500">
                        €{formatMoney(s.base_payment)}
                      </span>
                    </div>
                    {s.bonus_amount != null && s.bonus_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Bonus</span>
                        <span className="font-semibold text-green-500">
                          €{formatMoney(s.bonus_amount)}
                        </span>
                      </div>
                    )}
                  </div>
                  {canChangeSponsor && (
                    <Button
                      variant={isCurrent ? "secondary" : "default"}
                      className="w-full"
                      onClick={() => (isCurrent ? handleAssign(null) : handleAssign(s.id))}
                      disabled={!!assigning}
                    >
                      {assigning === s.id
                        ? "Signing…"
                        : assigning === "clear"
                          ? "…"
                          : isCurrent
                            ? "Current"
                            : "Sign Sponsor"}
                    </Button>
                  )}
                  {!canChangeSponsor && isCurrent && (
                    <p className="text-xs text-muted-foreground">Your current sponsor</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {sponsors.length === 0 && (
          <p className="text-muted-foreground">No sponsors available. Run migrations to seed data.</p>
        )}
      </div>
    </div>
  );
}
