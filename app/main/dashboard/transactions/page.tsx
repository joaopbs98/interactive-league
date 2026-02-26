"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, ArrowUpRight, ArrowDownRight, DollarSign, TrendingDown, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
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

  const reasons = [...new Set(transactions.map((t) => t.reason).filter(Boolean))].sort();

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Transactions & Finances</h2>

      <div className="flex flex-wrap gap-4 items-center">
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

      {teamFinances && teamFinances.merchPercentage > 0 && (teamFinances.leversEnabled !== false) && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5" /> Sell Merch % (Lever)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Sell future merchandise revenue for immediate payout. 10% transaction cost. Base 30% cannot be sold.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-end">
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
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-900/30"><ArrowUpRight className="h-5 w-5 text-green-400" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-lg font-bold text-green-400">{formatMoney(totalIn)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-900/30"><ArrowDownRight className="h-5 w-5 text-red-400" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-lg font-bold text-red-400">{formatMoney(totalOut)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30"><DollarSign className="h-5 w-5 text-blue-400" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Net (total from transactions)</p>
              <p className={`text-lg font-bold ${totalIn - totalOut >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalIn - totalOut >= 0 ? '+' : '-'}{formatMoney(Math.abs(totalIn - totalOut))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Sidebar Balance = Net minus wage commitments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No transactions yet"
              description="Transactions appear when you sign players, earn prize money, sell merch, or complete trades. Try Packs, Draft, or Sponsors to build your finances."
              action={{ label: "View Packs", href: "/main/dashboard/packs" }}
            />
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800">
                  <div className="flex items-center gap-3">
                    {tx.amount >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-green-400" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{tx.description || tx.reason}</p>
                      <p className="text-xs text-muted-foreground">Season {tx.season}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(tx.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
