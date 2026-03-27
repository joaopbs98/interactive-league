"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { Toaster, toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, Briefcase } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { getBonusConditionLabel, getTransferRequestRankLabel, getCompetitionLabel, getStageLabel } from "@/utils/sponsorLabels";

type SeasonTerm = {
  season: number;
  base_payment: number;
  bonus_amount: number | null;
  bonus_condition_code: string | null;
  bonus_merch_pct: number | null;
  payout_type: string;
  transfer_request_count: number | null;
  transfer_request_rank: number | null;
  merch_modifier: number | null;
  repayment_penalty: number | null;
  payout_tiers?: Array<{
    competition: string;
    stage_pattern: string;
    payout_amount: number;
    merch_modifier?: number | null;
    transfer_request_count: number | null;
    transfer_request_rank: number | null;
  }>;
};

type Sponsor = {
  id: string;
  name: string;
  base_payment: number;
  bonus_amount: number | null;
  bonus_condition: string | null;
  season_base_payment?: number;
  season_bonus_amount?: number | null;
  season_bonus_condition?: string | null;
  bonus_merch_pct?: number | null;
  payout_type?: string;
  contract_window?: string;
  contract_seasons?: number[];
  season_terms?: SeasonTerm[];
  season?: number;
};

function formatMoney(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function SponsorDetailCard({
  sponsor: s,
  isCurrent,
  canChangeSponsor,
  assigning,
  onAssign,
  formatMoney,
}: {
  sponsor: Sponsor;
  isCurrent: boolean;
  canChangeSponsor: boolean;
  assigning: string | null;
  onAssign: (id: string | null) => void;
  formatMoney: (n: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const bonusCond = s.season_bonus_condition ?? s.bonus_condition;
  const bonusAmt = s.season_bonus_amount ?? s.bonus_amount;
  const hasBonus = bonusCond && bonusAmt != null && bonusAmt > 0;
  const basePay = s.season_base_payment ?? s.base_payment;
  const terms = s.season_terms ?? [];

  return (
    <Card className="bg-card border-border">
      <CardContent className="space-y-4 pt-6">
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-lg font-semibold">{s.name}</h4>
          {hasBonus && (
            <Badge variant="outline" className="bg-green-800 text-white text-xs shrink-0">
              {getBonusConditionLabel(bonusCond)}
            </Badge>
          )}
        </div>

        {s.contract_window && (
          <p className="text-sm text-muted-foreground">
            <strong>Contract:</strong> {s.contract_window}
          </p>
        )}

        {/* Per-season payments */}
        {terms.length > 0 && (
          <div className="bg-background p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-2">Payments by season</p>
            {terms.map((t) => (
              <div key={t.season} className="flex justify-between text-sm">
                <span>Season {t.season}</span>
                <span className="font-semibold text-green-500">
                  €{formatMoney(t.base_payment)}
                  {t.bonus_amount != null && t.bonus_amount > 0 && (
                    <span className="text-green-400/90 font-normal"> + €{formatMoney(t.bonus_amount)} bonus</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {terms.length === 0 && (
          <div className="bg-background p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Base (per season)</span>
              <span className="font-semibold text-green-500">€{formatMoney(basePay)}</span>
            </div>
            {bonusAmt != null && bonusAmt > 0 && (
              <div className="flex justify-between text-sm">
                <span>Bonus</span>
                <span className="font-semibold text-green-500">€{formatMoney(bonusAmt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Bonus objectives (per season when different) */}
        {terms.some((t) => t.bonus_condition_code) && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Bonus objectives</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              {terms
                .filter((t) => t.bonus_condition_code)
                .map((t) => (
                  <li key={t.season}>
                    S{t.season}: {getBonusConditionLabel(t.bonus_condition_code)}
                    {t.bonus_merch_pct != null && t.bonus_merch_pct > 0 && (
                      <span className="text-green-500"> (+{t.bonus_merch_pct}% merch)</span>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Failure penalties */}
        {terms.some((t) => (t.transfer_request_count ?? 0) > 0 || (t.repayment_penalty ?? 0) > 0 || (t.merch_modifier ?? 0) < 0) && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-600">Failure penalties</p>
            <ul className="text-sm space-y-1 list-disc list-inside text-amber-200/90">
              {terms.map((t) => {
                const parts: string[] = [];
                if ((t.transfer_request_count ?? 0) > 0 && (t.transfer_request_rank ?? 0) >= 1) {
                  parts.push(`TR from ${getTransferRequestRankLabel(t.transfer_request_rank)}`);
                }
                if ((t.merch_modifier ?? 0) < 0) {
                  parts.push(`${t.merch_modifier}% merchandise`);
                }
                if ((t.repayment_penalty ?? 0) > 0) {
                  parts.push(`€${formatMoney(t.repayment_penalty ?? 0)} repayment`);
                }
                if (parts.length === 0) return null;
                return (
                  <li key={t.season}>
                    S{t.season}: {parts.join("; ")}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Performance tiers (collapsible) */}
        {terms.some((t) => t.payout_type === "performance_tier" && (t.payout_tiers?.length ?? 0) > 0) && (
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Performance-based payout tiers
            </button>
            {expanded && (
              <div className="mt-2 space-y-3 text-sm">
                {terms
                  .filter((t) => t.payout_type === "performance_tier" && (t.payout_tiers?.length ?? 0) > 0)
                  .map((t) => (
                    <div key={t.season} className="bg-background/60 p-3 rounded-lg">
                      <p className="font-medium mb-2">Season {t.season}</p>
                      <div className="space-y-2">
                        {Object.entries(
                          (t.payout_tiers ?? []).reduce<Record<string, NonNullable<SeasonTerm["payout_tiers"]>>>(
                            (acc, tier) => {
                              const k = tier.competition;
                              if (!acc[k]) acc[k] = [];
                              acc[k]!.push(tier);
                              return acc;
                            },
                            {} as Record<string, NonNullable<SeasonTerm["payout_tiers"]>>
                          )
                        ).map(([comp, tiers]) => (
                          <div key={comp}>
                            <p className="text-muted-foreground">{getCompetitionLabel(comp)}</p>
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              {(tiers ?? []).map((tier) => (
                                <div key={`${tier.stage_pattern}`} className="flex justify-between">
                                  <span>{getStageLabel(tier.stage_pattern)}</span>
                                  <span className="text-green-500">€{formatMoney(tier.payout_amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {canChangeSponsor && (
          <Button
            variant={isCurrent ? "secondary" : "default"}
            className="w-full"
            onClick={() => (isCurrent ? onAssign(null) : onAssign(s.id))}
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
}

export default function SponsorsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const { triggerRefresh } = useRefresh();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [currentSponsorId, setCurrentSponsorId] = useState<string | null>(null);
  const [sponsorContractEndsSeason, setSponsorContractEndsSeason] = useState<number | null>(null);
  const [leagueStatus, setLeagueStatus] = useState<string | null>(null);
  const [leagueSeason, setLeagueSeason] = useState<number>(1);
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
          setSponsorContractEndsSeason(data.team?.sponsor_contract_ends_season ?? null);
        }
        if (leagueRes?.ok) {
          const data = await leagueRes.json();
          setLeagueStatus(data.data?.status ?? null);
          setLeagueSeason(data.data?.season ?? 1);
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
        triggerRefresh();
        toast.success(sponsorId ? "Sponsor signed! Base payment added to your balance." : "Sponsor removed");
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
      <div className="p-8">
        <PageSkeleton variant="cards" rows={6} />
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

      {currentSponsor && sponsorContractEndsSeason != null && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4">
            <p className="text-sm font-medium">Contract: {sponsorContractEndsSeason - leagueSeason} season{(sponsorContractEndsSeason - leagueSeason) !== 1 ? "s" : ""} remaining</p>
            {currentSponsor.season_bonus_condition && (
              <p className="text-sm text-muted-foreground mt-1">
                Bonus objective: {getBonusConditionLabel(currentSponsor.season_bonus_condition)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
              {sponsorContractEndsSeason && (
                <p className="text-xs text-muted-foreground">Contract until end of Season {sponsorContractEndsSeason}</p>
              )}
              <div className="flex gap-2 flex-wrap">
                {(currentSponsor.season_bonus_condition ?? currentSponsor.bonus_condition) && (
                  <Badge variant="outline" className="bg-green-800 text-white">
                    Bonus: {currentSponsor.season_bonus_condition ?? currentSponsor.bonus_condition}
                  </Badge>
                )}
              </div>
              <div className="bg-background p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Base payment (per season)</span>
                  <span className="font-semibold text-green-500">
                    €{formatMoney(currentSponsor.season_base_payment ?? currentSponsor.base_payment)}
                  </span>
                </div>
                {((currentSponsor.season_bonus_amount ?? currentSponsor.bonus_amount) != null &&
                  (currentSponsor.season_bonus_amount ?? currentSponsor.bonus_amount)! > 0) && (
                  <div className="flex justify-between">
                    <span>Bonus (if condition met)</span>
                    <span className="font-semibold text-green-500">
                      €{formatMoney(currentSponsor.season_bonus_amount ?? currentSponsor.bonus_amount!)}
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
              <EmptyState
                icon={Briefcase}
                title="No sponsor signed yet"
                description="Sign a sponsor below during offseason to receive base payment and bonuses at end of season."
                action={canChangeSponsor ? { label: "Browse sponsors below", href: "#available" } : undefined}
                className="!border-0 !bg-transparent !py-6"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Available Sponsors */}
      <div id="available">
        <h3 className="text-lg font-medium mb-4">Available Sponsors</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {sponsors.map((s) => (
            <SponsorDetailCard
              key={s.id}
              sponsor={s}
              isCurrent={s.id === currentSponsorId}
              canChangeSponsor={canChangeSponsor}
              assigning={assigning}
              onAssign={handleAssign}
              formatMoney={formatMoney}
            />
          ))}
        </div>
        {sponsors.length === 0 && (
          <EmptyState
            icon={Briefcase}
            title="No sponsors available"
            description="Sponsors are seeded by the league host. If you're the host, run migrations or contact support to add sponsors."
            action={{ label: "Host Controls", href: "/main/dashboard/host-controls" }}
            className="col-span-full"
          />
        )}
      </div>
    </div>
  );
}
