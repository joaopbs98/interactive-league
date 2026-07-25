"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { Toaster, toast } from "sonner";
import { ChevronDown, ChevronUp, Briefcase, Lock, Clock } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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
    <div className={`rounded-lg border bg-surface overflow-hidden flex flex-col ${isCurrent ? "border-accent/40" : "border-border"}`}>
      <div className="p-5 space-y-4 flex-1">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-display text-xl text-foreground">{s.name}</h4>
          {hasBonus && (
            <Badge className="bg-status-positive/15 text-status-positive border border-status-positive/30 text-xs shrink-0">
              {getBonusConditionLabel(bonusCond)}
            </Badge>
          )}
        </div>

        {s.contract_window && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Contract:</span> {s.contract_window}
          </p>
        )}

        {/* Per-season payments */}
        {terms.length > 0 && (
          <div className="bg-surface-2 border border-border p-3 rounded-lg space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Payments by season</p>
            {terms.map((t) => (
              <div key={t.season} className="flex justify-between text-sm">
                <span className="text-muted-foreground">Season {t.season}</span>
                <span className="font-semibold text-status-positive tabular-nums">
                  €{formatMoney(t.base_payment)}
                  {t.bonus_amount != null && t.bonus_amount > 0 && (
                    <span className="text-status-positive/80 font-normal"> + €{formatMoney(t.bonus_amount)} bonus</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {terms.length === 0 && (
          <div className="bg-surface-2 border border-border p-3 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base (per season)</span>
              <span className="font-semibold text-status-positive tabular-nums">€{formatMoney(basePay)}</span>
            </div>
            {bonusAmt != null && bonusAmt > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bonus</span>
                <span className="font-semibold text-status-positive tabular-nums">€{formatMoney(bonusAmt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Bonus objectives (per season when different) */}
        {terms.some((t) => t.bonus_condition_code) && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bonus objectives</p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {terms
                .filter((t) => t.bonus_condition_code)
                .map((t) => (
                  <li key={t.season}>
                    S{t.season}: {getBonusConditionLabel(t.bonus_condition_code)}
                    {t.bonus_merch_pct != null && t.bonus_merch_pct > 0 && (
                      <span className="text-status-positive"> (+{t.bonus_merch_pct}% merch)</span>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Failure penalties */}
        {terms.some((t) => (t.transfer_request_count ?? 0) > 0 || (t.repayment_penalty ?? 0) > 0 || (t.merch_modifier ?? 0) < 0) && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-status-warning">Failure penalties</p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
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
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
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
                    <div key={t.season} className="bg-surface-3 p-3 rounded-lg">
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
                                  <span className="text-status-positive tabular-nums">€{formatMoney(tier.payout_amount)}</span>
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
      </div>

      {canChangeSponsor && (
        <div className="px-5 pb-5">
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
        </div>
      )}
      {!canChangeSponsor && isCurrent && (
        <p className="px-5 pb-5 text-xs text-muted-foreground">Your current sponsor</p>
      )}
    </div>
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

  const seasonsRemaining = sponsorContractEndsSeason != null ? sponsorContractEndsSeason - leagueSeason : null;

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
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader eyebrow="Bank & Balance" title="Sponsorships" />

      {!canChangeSponsor && (
        <div className="flex items-center gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          <Lock className="h-4 w-4 shrink-0" />
          Sponsor changes are only allowed during OFFSEASON. Current phase: {leagueStatus ?? "—"}
        </div>
      )}

      {/* Current Sponsor hero */}
      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Current Sponsor
          </h2>
        </div>
        <div className="p-5">
          {currentSponsor ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-2xl text-foreground">{currentSponsor.name}</h3>
                  {(currentSponsor.season_bonus_condition ?? currentSponsor.bonus_condition) && (
                    <Badge className="bg-status-positive/15 text-status-positive border border-status-positive/30">
                      Bonus: {currentSponsor.season_bonus_condition ?? currentSponsor.bonus_condition}
                    </Badge>
                  )}
                </div>
                {seasonsRemaining != null && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {seasonsRemaining} season{seasonsRemaining !== 1 ? "s" : ""} remaining (until end of Season {sponsorContractEndsSeason})
                  </p>
                )}
                <div className="flex gap-6 pt-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Base payment / season</p>
                    <p className="text-lg font-bold text-status-positive tabular-nums">
                      €{formatMoney(currentSponsor.season_base_payment ?? currentSponsor.base_payment)}
                    </p>
                  </div>
                  {((currentSponsor.season_bonus_amount ?? currentSponsor.bonus_amount) != null &&
                    (currentSponsor.season_bonus_amount ?? currentSponsor.bonus_amount)! > 0) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bonus (if condition met)</p>
                      <p className="text-lg font-bold text-status-positive tabular-nums">
                        €{formatMoney(currentSponsor.season_bonus_amount ?? currentSponsor.bonus_amount!)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {canChangeSponsor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAssign(null)}
                  disabled={!!assigning}
                  className="shrink-0"
                >
                  {assigning === "clear" ? "Removing…" : "Remove Sponsor"}
                </Button>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No sponsor signed yet"
              description="Sign a sponsor below during offseason to receive base payment and bonuses at end of season."
              action={canChangeSponsor ? { label: "Browse sponsors below", href: "#available" } : undefined}
              className="!border-0 !bg-transparent !py-6"
            />
          )}
        </div>
      </section>

      {/* Available Sponsors */}
      <section id="available" className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Available Sponsors
          </h2>
          <span className="text-[10px] text-faint-foreground uppercase tracking-wider ml-auto">
            {sponsors.length} total
          </span>
        </div>
        <div className="p-5">
          {sponsors.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No sponsors available"
              description="Sponsors are seeded by the league host. If you're the host, run migrations or contact support to add sponsors."
              action={{ label: "Host Controls", href: "/main/dashboard/host-controls" }}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
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
          )}
        </div>
      </section>
    </div>
  );
}
