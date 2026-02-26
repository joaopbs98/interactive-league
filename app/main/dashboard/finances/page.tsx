"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Loader2,
  DollarSign,
  Wallet,
  TrendingUp,
  Percent,
  Award,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { PageSkeleton } from "@/components/PageSkeleton";

type Transaction = {
  id: string;
  amount: number;
  reason: string;
  description: string;
  season: number;
  date: string;
  created_at: string;
};

type FinancesData = {
  team: {
    id: string;
    name: string;
    totalBudget: number;
    merchPercentage: number;
    merchBaseRevenue: number;
    leversEnabled?: boolean;
  };
  transactions: Transaction[];
  finances: {
    availableBalance: number;
    totalWageBill: number;
    committedToWages: number;
    remainingBudget: number;
    totalBudget: number;
  };
  wageBreakdown: {
    total: number;
    byPosition: { GK: number; DEF: number; MID: number; FWD: number };
    players: { player_name: string; base_wage: number }[];
  };
};

function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs.toLocaleString()}`;
}

export default function FinancesPage() {
  const { selectedTeam } = useLeague();
  const [data, setData] = useState<FinancesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedTeam?.id) {
      setLoading(true);
      fetch(`/api/team/${selectedTeam.id}/finances`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) setData(json.data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [selectedTeam?.id]);

  if (loading || !selectedTeam) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Failed to load finances.</p>
      </div>
    );
  }

  const { team, transactions, finances, wageBreakdown } = data;

  const sponsorIncome = transactions
    .filter(
      (t) =>
        t.amount > 0 &&
        (t.reason === "Sponsor Payment" ||
          (t.description ?? "").toLowerCase().includes("sponsor"))
    )
    .reduce((s, t) => s + t.amount, 0);

  const prizeMoney = transactions
    .filter((t) => t.amount > 0 && t.reason === "Prize Money")
    .reduce((s, t) => s + t.amount, 0);

  const incomeByReason = transactions
    .filter((t) => t.amount > 0)
    .reduce<Record<string, number>>((acc, t) => {
      const r = t.reason || "Other Income";
      acc[r] = (acc[r] || 0) + t.amount;
      return acc;
    }, {});

  const expenseByReason = transactions
    .filter((t) => t.amount < 0)
    .reduce<Record<string, number>>((acc, t) => {
      const r = t.reason || "Other Expense";
      acc[r] = (acc[r] || 0) + Math.abs(t.amount);
      return acc;
    }, {});

  const totalIncome = Object.values(incomeByReason).reduce((a, b) => a + b, 0);
  const totalExpense = Object.values(expenseByReason).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Financial Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Wallet className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Budget</p>
              <p className="text-lg font-bold">{formatMoney(finances.totalBudget)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-900/30">
              <DollarSign className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wage Bill</p>
              <p className="text-lg font-bold">{formatMoney(finances.totalWageBill)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-lg font-bold text-green-400">{formatMoney(finances.availableBalance)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-900/30">
              <Briefcase className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sponsor Income</p>
              <p className="text-lg font-bold text-green-400">{formatMoney(sponsorIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700/30">
              <Percent className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Merch %</p>
              <p className="text-lg font-bold">{team.merchPercentage ?? 0}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-900/30">
              <Award className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prize Money</p>
              <p className="text-lg font-bold text-green-400">{formatMoney(prizeMoney)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg">Income vs Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.keys(incomeByReason).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-400 mb-2">Income</p>
                  <div className="space-y-2">
                    {Object.entries(incomeByReason).map(([reason, amt]) => (
                      <div key={reason} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{reason}</span>
                        <span className="font-medium text-green-400">{formatMoney(amt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(expenseByReason).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-400 mb-2">Expenses</p>
                  <div className="space-y-2">
                    {Object.entries(expenseByReason).map(([reason, amt]) => (
                      <div key={reason} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{reason}</span>
                        <span className="font-medium text-red-400">{formatMoney(amt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(incomeByReason).length === 0 && Object.keys(expenseByReason).length === 0 && (
                <p className="text-muted-foreground text-sm">No transaction categories yet.</p>
              )}
              <div className="pt-2 border-t border-neutral-700 flex justify-between font-medium">
                <span>Net</span>
                <span className={totalIncome - totalExpense >= 0 ? "text-green-400" : "text-red-400"}>
                  {totalIncome - totalExpense >= 0 ? "+" : "-"}
                  {formatMoney(Math.abs(totalIncome - totalExpense))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg">Wage Breakdown by Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => {
                const amt = wageBreakdown.byPosition?.[pos] ?? 0;
                const pct = wageBreakdown.total > 0 ? (amt / wageBreakdown.total) * 100 : 0;
                return (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="w-12 text-sm text-muted-foreground">{pos}</span>
                    <div className="flex-1 h-4 rounded bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-600/80 rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">{formatMoney(amt)}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Total wage bill: {formatMoney(wageBreakdown.total)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Link href="/main/dashboard/transactions">
          <span className="text-sm text-primary hover:underline">View full transaction history →</span>
        </Link>
        <Link href="/main/dashboard/sponsors">
          <span className="text-sm text-primary hover:underline">Sponsors →</span>
        </Link>
      </div>
    </div>
  );
}
