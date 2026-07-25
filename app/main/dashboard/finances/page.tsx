"use client";

import { useEffect, useState } from "react";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Briefcase,
  BarChart3,
  Users,
  ArrowRight,
  Receipt,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString()}`;
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
  const net = totalIncome - totalExpense;
  const maxCategoryAmt = Math.max(1, ...Object.values(incomeByReason), ...Object.values(expenseByReason));

  const committedPct = finances.totalBudget > 0 ? (finances.committedToWages / finances.totalBudget) * 100 : 0;
  const remainingPct = finances.totalBudget > 0 ? (finances.remainingBudget / finances.totalBudget) * 100 : 0;
  const budgetHealthy = finances.remainingBudget >= finances.totalBudget * 0.15;

  const topEarners = [...(wageBreakdown.players || [])]
    .sort((a, b) => b.base_wage - a.base_wage)
    .slice(0, 5);

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Breadcrumbs />
      <PageHeader eyebrow="Bank & Balance" title="Financial Overview" />

      {/* Hero: available balance + budget allocation */}
      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Available Balance</p>
            <p className="font-display text-4xl sm:text-5xl text-foreground tabular-nums">
              {formatMoney(finances.availableBalance)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Total Budget</p>
              <p className="text-base font-semibold tabular-nums">{formatMoney(finances.totalBudget)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wage Bill</p>
              <p className="text-base font-semibold tabular-nums">{formatMoney(finances.totalWageBill)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className={`text-base font-semibold tabular-nums ${budgetHealthy ? "text-status-positive" : "text-status-warning"}`}>
                {formatMoney(finances.remainingBudget)}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden flex">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, committedPct)}%` }} />
            <div
              className={`h-full ${budgetHealthy ? "bg-status-positive/60" : "bg-status-warning/60"}`}
              style={{ width: `${Math.min(100 - committedPct, remainingPct)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" /> Committed to wages ({committedPct.toFixed(0)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${budgetHealthy ? "bg-status-positive/60" : "bg-status-warning/60"}`} />
              Remaining ({remainingPct.toFixed(0)}%)
            </span>
          </div>
        </div>
      </section>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sponsor Income", value: formatMoney(sponsorIncome), icon: Briefcase },
          { label: "Prize Money", value: formatMoney(prizeMoney), icon: Trophy },
          { label: "Merch Share", value: `${team.merchPercentage ?? 0}%`, icon: Receipt },
          { label: "Net This Season", value: formatMoney(net), icon: BarChart3, tone: net >= 0 ? "positive" : "negative" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-lg border border-border bg-surface p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p
                className={`text-base font-bold tabular-nums ${
                  tone === "positive" ? "text-status-positive" : tone === "negative" ? "text-status-negative" : ""
                }`}
              >
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Income vs Expenses by Category
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {Object.entries(incomeByReason)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, amt]) => (
                <div key={reason} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{reason}</span>
                    <span className="font-medium text-status-positive tabular-nums">{formatMoney(amt)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full bg-status-positive/70 rounded-full" style={{ width: `${(amt / maxCategoryAmt) * 100}%` }} />
                  </div>
                </div>
              ))}
            {Object.entries(expenseByReason)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, amt]) => (
                <div key={reason} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{reason}</span>
                    <span className="font-medium text-status-negative tabular-nums">{formatMoney(amt)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full bg-status-negative/70 rounded-full" style={{ width: `${(amt / maxCategoryAmt) * 100}%` }} />
                  </div>
                </div>
              ))}
            {Object.keys(incomeByReason).length === 0 && Object.keys(expenseByReason).length === 0 && (
              <p className="text-muted-foreground text-sm">No transaction categories yet.</p>
            )}
            <div className="pt-3 border-t border-border flex justify-between font-medium">
              <span>Net</span>
              <span className={`tabular-nums ${net >= 0 ? "text-status-positive" : "text-status-negative"}`}>
                {net >= 0 ? "+" : "-"}
                {formatMoney(Math.abs(net))}
              </span>
            </div>
          </div>
        </section>

        <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Wages
            </h2>
          </div>
          <div className="p-5 space-y-5">
            <div className="space-y-3">
              {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => {
                const amt = wageBreakdown.byPosition?.[pos] ?? 0;
                const pct = wageBreakdown.total > 0 ? (amt / wageBreakdown.total) * 100 : 0;
                return (
                  <div key={pos} className="flex items-center gap-3">
                    <span className="w-10 text-sm text-muted-foreground">{pos}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium w-20 text-right tabular-nums">{formatMoney(amt)}</span>
                  </div>
                );
              })}
            </div>

            {topEarners.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Top Earners</p>
                <div className="space-y-1.5">
                  {topEarners.map((p) => (
                    <div key={p.player_name} className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate">{p.player_name}</span>
                      <span className="text-muted-foreground tabular-nums">{formatMoney(p.base_wage)}/wk</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground pt-3 border-t border-border">
              Total wage bill: <span className="font-medium text-foreground">{formatMoney(wageBreakdown.total)}</span>
            </p>
          </div>
        </section>
      </div>

      {/* Recent transactions */}
      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Recent Transactions
          </h2>
          <Link
            href="/main/dashboard/transactions"
            className="group ml-auto flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors duration-150"
          >
            View all
            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform duration-150" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentTransactions.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">No transactions yet.</p>
          )}
          {recentTransactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-foreground truncate">{t.reason || t.description || "Transaction"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.date || t.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`font-medium tabular-nums shrink-0 ${t.amount >= 0 ? "text-status-positive" : "text-status-negative"}`}>
                {t.amount >= 0 ? "+" : ""}
                {formatMoney(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/main/dashboard/sponsors"
        className="group flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors duration-150 self-start"
      >
        Manage sponsors
        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
      </Link>
    </div>
  );
}
