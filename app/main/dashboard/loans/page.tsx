"use client";

import { useEffect, useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote, Plus, DollarSign } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";

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
  const [loans, setLoans] = useState<Loan[]>([]);
  const [leagueSeason, setLeagueSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    setMessage(null);
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
        setMessage({ type: "success", text: "Loan of $60M taken. Total repayment: $75M (25% interest)." });
        fetchLoans();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRepay = async (loanId: string) => {
    setActionLoading(loanId);
    setMessage(null);
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
        setMessage({ type: "success", text: "Repayment made." });
        fetchLoans();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
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
    setMessage(null);
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
        setMessage({ type: "success", text: `Restructured: defer ${pct}% of first repayment. New schedule applied.` });
        fetchLoans();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  if (!selectedLeagueId || !selectedTeam) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-4">Loans</h2>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">Select a league and team to continue</p>
            <p className="text-sm">Choose a league from the Saves page to manage loans.</p>
          </CardContent>
        </Card>
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
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Banknote className="h-6 w-6" /> Loans
      </h2>

      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === "success"
              ? "bg-green-900/30 text-green-300 border border-green-800"
              : "bg-red-900/30 text-red-300 border border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle>Take Loan</CardTitle>
          <CardDescription>
            $60M loan with 25% interest ($75M total repayment). Available in seasons 2–7 only. 3 installments of ~$25M.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleTakeLoan}
            disabled={!canTakeLoan || actionLoading === "take"}
          >
            {actionLoading === "take" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Take $60M Loan
          </Button>
          {!canTakeLoan && (
            <p className="text-xs text-muted-foreground mt-2">
              {leagueSeason < 2 || leagueSeason > 7
                ? `Loans available in seasons 2–7 (current: ${leagueSeason})`
                : "You already have an active loan"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle>Your Loans</CardTitle>
          <CardDescription>Active and paid-off loans.</CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-muted-foreground">No loans yet.</p>
          ) : (
            <div className="space-y-4">
              {loans.map((loan) => (
                <div
                  key={loan.id}
                  className="flex flex-col gap-2 p-4 rounded-lg bg-neutral-800/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        ${(loan.amount / 1e6).toFixed(0)}M (Season {loan.season_taken})
                        {loan.restructure_confirmed && (
                          <span className="ml-2 text-xs text-amber-400">Restructured {loan.restructure_pct}%</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Repay: {loan.repay_made}/3 · Remaining: ${(loan.remaining / 1e6).toFixed(1)}M
                      </p>
                    </div>
                    {loan.remaining > 0 && (
                      <Button
                        size="sm"
                        onClick={() => handleRepay(loan.id)}
                        disabled={!!actionLoading}
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
                  {canRestructure(loan) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-700">
                      <span className="text-xs text-muted-foreground self-center">Restructure (defer 1st):</span>
                      {[25, 50, 75, 100].map((pct) => (
                        <Button
                          key={pct}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleRestructure(loan.id, pct)}
                          disabled={!!actionLoading}
                        >
                          {pct}%
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
