"use client";

import { useEffect, useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote, Plus, DollarSign } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Toaster, toast } from "sonner";

type Loan = {
  id: string;
  amount: number;
  repay_total: number;
  season_taken: number;
  repay_made: number;
  remaining: number;
  restructure_pct?: number;
  restructure_confirmed?: boolean;
  repayment_1?: number;
  repayment_2?: number;
  repayment_3?: number;
  created_at: string;
};

export default function LoansPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const { triggerRefresh } = useRefresh();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [leagueSeason, setLeagueSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLeagueId && selectedTeam?.id) {
      fetchLoans();
    }
  }, [selectedLeagueId, selectedTeam?.id]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/loans?leagueId=${selectedLeagueId}&teamId=${selectedTeam?.id}`
      );
      const data = await res.json();
      if (data.success) setLoans(data.data || []);

      const leagueRes = await fetch(`/api/league/game?leagueId=${selectedLeagueId}&type=league_info`);
      const leagueData = await leagueRes.json();
      if (leagueData.success && leagueData.data) {
        setLeagueSeason(leagueData.data.season ?? 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeLoan = async () => {
    setActionLoading("take");
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "take",
          leagueId: selectedLeagueId,
          teamId: selectedTeam?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Loan of $60M taken. Total repayment: $75M (25% interest).");
        fetchLoans();
        triggerRefresh();
      } else {
        toast.error(data.error ?? "Failed to take loan");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to take loan");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRepay = async (loanId: string) => {
    setActionLoading(loanId);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "repay",
          leagueId: selectedLeagueId,
          teamId: selectedTeam?.id,
          loanId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Repayment made.");
        fetchLoans();
        triggerRefresh();
      } else {
        toast.error(data.error ?? "Failed to repay loan");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to repay loan");
    } finally {
      setActionLoading(null);
    }
  };

  const canTakeLoan = leagueSeason >= 2 && leagueSeason <= 7 && !loans.some((l) => l.remaining > 0);

  const getRepayAmount = (loan: Loan) => {
    const sched = [loan.repayment_1, loan.repayment_2, loan.repayment_3].filter(Boolean);
    if (sched.length > 0 && loan.repay_made < sched.length) return sched[loan.repay_made];
    return 25_000_000;
  };

  const canRestructure = (loan: Loan) =>
    loan.remaining > 0 &&
    loan.repay_made === 0 &&
    !loan.restructure_confirmed &&
    leagueSeason === loan.season_taken;

  const handleRestructure = async (loanId: string, pct: number) => {
    setActionLoading(`restructure-${loanId}`);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restructure",
          leagueId: selectedLeagueId,
          teamId: selectedTeam?.id,
          loanId,
          restructurePct: pct,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Restructured: defer ${pct}% of first repayment. New schedule applied.`);
        fetchLoans();
        triggerRefresh();
      } else {
        toast.error(data.error ?? "Failed to restructure loan");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to restructure loan");
    } finally {
      setActionLoading(null);
    }
  };

  if (!selectedLeagueId || !selectedTeam) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Loans</h2>
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2 text-foreground">Select a league and team to continue</p>
          <p className="text-sm">Choose a league from the Saves page to manage loans.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader eyebrow="Bank & Balance" title="Loans" />

      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <Banknote className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Take Loan
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            $60M loan with 25% interest ($75M total repayment). Available in seasons 2–7 only. 3 installments of ~$25M.
          </p>
          <Button onClick={handleTakeLoan} disabled={!canTakeLoan || actionLoading === "take"}>
            {actionLoading === "take" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Take $60M Loan
          </Button>
          {!canTakeLoan && (
            <p className="text-xs text-muted-foreground">
              {leagueSeason < 2 || leagueSeason > 7
                ? `Loans available in seasons 2–7 (current: ${leagueSeason})`
                : "You already have an active loan"}
            </p>
          )}
        </div>
      </section>

      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Your Loans
          </h2>
          <span className="text-[10px] text-faint-foreground uppercase tracking-wider ml-auto">
            Active and paid-off
          </span>
        </div>
        <div className="p-5">
          {loans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No loans yet.</p>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => {
                const pct = Math.min(100, (loan.repay_made / 3) * 100);
                return (
                  <div key={loan.id} className="rounded-lg border border-border bg-surface-2 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          ${(loan.amount / 1e6).toFixed(0)}M (Season {loan.season_taken})
                          {loan.restructure_confirmed && (
                            <span className="ml-2 text-xs text-status-warning">Restructured {loan.restructure_pct}%</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Repay: {loan.repay_made}/3 · Remaining: <span className="tabular-nums">${(loan.remaining / 1e6).toFixed(1)}M</span>
                        </p>
                      </div>
                      {loan.remaining > 0 && (
                        <Button
                          size="sm"
                          onClick={() => handleRepay(loan.id)}
                          disabled={!!actionLoading}
                          className="shrink-0"
                        >
                          {actionLoading === loan.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <DollarSign className="h-3 w-3 mr-1" /> Repay ~${((getRepayAmount(loan) ?? 0) / 1e6).toFixed(0)}M
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${loan.remaining > 0 ? "bg-accent" : "bg-status-positive"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {canRestructure(loan) && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground self-center">Restructure (defer 1st):</span>
                        {[25, 50, 75, 100].map((restructurePct) => (
                          <Button
                            key={restructurePct}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleRestructure(loan.id, restructurePct)}
                            disabled={!!actionLoading}
                          >
                            {restructurePct}%
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
