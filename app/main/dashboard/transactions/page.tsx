"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";
import { useRefresh } from "@/contexts/RefreshContext";
import { Loader2, ArrowUpRight, ArrowDownRight, DollarSign, TrendingDown, Search, BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { toast } from "sonner";

type Transaction = {
  id: string;
  amount: number;
  reason: string;
  description: string;
  season: number;
  date: string;
  created_at: string;
};

type TeamFinances = {
  merchPercentage: number;
  merchBaseRevenue: number;
  leversEnabled?: boolean;
};

export default function TransactionsPage() {
  const { selectedTeam } = useLeague();
  const { triggerRefresh } = useRefresh();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [teamFinances, setTeamFinances] = useState<TeamFinances | null>(null);
  const [loading, setLoading] = useState(true);
  const [sellPct, setSellPct] = useState("");
  const [selling, setSelling] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchTransactions = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (seasonFilter !== "all") params.set("season", seasonFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (reasonFilter !== "all") params.set("reason", reasonFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/team/${selectedTeam.id}/finances?${params}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTransactions(data.data.transactions ?? []);
        setTeamFinances(data.data.team ? {
          merchPercentage: data.data.team.merchPercentage ?? 0,
          merchBaseRevenue: data.data.team.merchBaseRevenue ?? 0,
          leversEnabled: data.data.team.leversEnabled ?? true
        } : null);
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedTeam?.id, seasonFilter, typeFilter, reasonFilter, search]);

  useEffect(() => {
    if (selectedTeam?.id) {
      const t = setTimeout(fetchTransactions, search ? 300 : 0);
      return () => clearTimeout(t);
    }
  }, [selectedTeam?.id, fetchTransactions, search]);

  useEffect(() => {
    if (selectedTeam?.id) triggerRefresh();
  }, [selectedTeam?.id]);

  const handleSellMerch = async () => {
    const pct = parseFloat(sellPct);
    if (isNaN(pct) || pct <= 0 || !selectedTeam?.id) return;
    setSelling(true);
    try {
      const res = await fetch(`/api/team/${selectedTeam.id}/sell-merch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pctToSell: pct }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Sold ${pct}% merch for $${(json.data.payout ?? 0).toLocaleString()} (10% fee)`);
        setSellPct("");
        fetchTransactions();
      } else {
        toast.error(json.error ?? "Failed to sell merch");
      }
    } catch (err) {
      toast.error("Failed to sell merch");
    } finally {
      setSelling(false);
    }
  };

  const formatMoney = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(abs / 1_000).toFixed(0)}K`;
    return abs.toString();
  };

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  const totalIn = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = totalIn - totalOut;

  const reasons = [...new Set(transactions.map((t) => t.reason).filter(Boolean))].sort();

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
  const maxCategoryAmt = Math.max(1, ...Object.values(incomeByReason), ...Object.values(expenseByReason));

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()
  );
  const groups = sorted.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const d = new Date(tx.date || tx.created_at);
    const key = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    (acc[key] ||= []).push(tx);
    return acc;
  }, {});

  const soldMerchPct = teamFinances ? Math.max(0, 70 - teamFinances.merchPercentage) : 0;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Breadcrumbs />
      <PageHeader eyebrow="Bank & Balance" title="Transactions" />

      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="flex flex-wrap gap-3 items-center p-5">
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All seasons</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                <SelectItem key={s} value={String(s)}>Season {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              {reasons.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Hero net */}
      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Net (all transactions)</p>
            <p className={`font-display text-4xl sm:text-5xl tabular-nums ${net >= 0 ? "text-status-positive" : "text-status-negative"}`}>
              {net >= 0 ? "+" : "-"}{formatMoney(Math.abs(net))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Sidebar balance = net minus wage commitments</p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-base font-semibold text-status-positive tabular-nums">{formatMoney(totalIn)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-base font-semibold text-status-negative tabular-nums">{formatMoney(totalOut)}</p>
            </div>
          </div>
        </div>
      </section>

      {teamFinances && teamFinances.merchPercentage > 0 && (teamFinances.leversEnabled !== false) && (
        <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Sell Merch % (Lever)
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sell future merchandise revenue for immediate payout. 10% transaction cost. Base 30% cannot be sold.
            </p>
            <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden flex">
              <div className="h-full bg-surface-3" style={{ width: "30%" }} />
              <div className="h-full bg-status-negative/50" style={{ width: `${soldMerchPct}%` }} />
              <div className="h-full bg-accent" style={{ width: `${teamFinances.merchPercentage}%` }} />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-surface-3 border border-border-strong" /> Base 30% (locked)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-negative/50" /> Sold {soldMerchPct.toFixed(1)}%</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Available {teamFinances.merchPercentage}%</span>
            </div>
            <div className="flex flex-wrap gap-2 items-end pt-1">
              <div>
                <Label className="text-xs">% to sell (max {teamFinances.merchPercentage})</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={teamFinances.merchPercentage}
                  placeholder="e.g. 5"
                  value={sellPct}
                  onChange={(e) => setSellPct(e.target.value)}
                  className="w-24 mt-1"
                />
              </div>
              <Button onClick={handleSellMerch} disabled={selling || !sellPct}>
                {selling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sell"}
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              By Category
            </h2>
          </div>
          <div className="p-5 space-y-4">
            {Object.entries(incomeByReason).sort((a, b) => b[1] - a[1]).map(([reason, amt]) => (
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
            {Object.entries(expenseByReason).sort((a, b) => b[1] - a[1]).map(([reason, amt]) => (
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
              <p className="text-muted-foreground text-sm">No transactions match these filters.</p>
            )}
          </div>
        </section>

        <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Transaction History
            </h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={DollarSign}
                title="No transactions yet"
                description="Transactions appear when you sign players, earn prize money, sell merch, or complete trades. Try Packs, Draft, or Sponsors to build your finances."
                action={{ label: "View Packs", href: "/main/dashboard/packs" }}
              />
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {Object.entries(groups).map(([month, txs]) => {
                const monthNet = txs.reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={month}>
                    <div className="flex items-center justify-between px-5 py-2 bg-surface-2/60 sticky top-0">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{month}</span>
                      <span className={`text-xs font-medium tabular-nums ${monthNet >= 0 ? "text-status-positive" : "text-status-negative"}`}>
                        {monthNet >= 0 ? "+" : "-"}{formatMoney(Math.abs(monthNet))}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {txs.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-2 transition-colors duration-150">
                          <div className="flex items-center gap-3 min-w-0">
                            {tx.amount >= 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-status-positive shrink-0" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-status-negative shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{tx.description || tx.reason}</p>
                              <p className="text-xs text-muted-foreground">Season {tx.season}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-bold tabular-nums ${tx.amount >= 0 ? 'text-status-positive' : 'text-status-negative'}`}>
                              {tx.amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(tx.amount))}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.date || tx.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
