"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, ArrowUpRight, ArrowDownRight, DollarSign, TrendingDown } from "lucide-react";
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [teamFinances, setTeamFinances] = useState<TeamFinances | null>(null);
  const [loading, setLoading] = useState(true);
  const [sellPct, setSellPct] = useState("");
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    if (selectedTeam?.id) fetchTransactions();
  }, [selectedTeam]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/${selectedTeam!.id}/finances`);
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
  };

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalIn = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold">Transactions & Finances</h2>

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
              <p className="text-xs text-muted-foreground">Net</p>
              <p className={`text-lg font-bold ${totalIn - totalOut >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalIn - totalOut >= 0 ? '+' : '-'}{formatMoney(Math.abs(totalIn - totalOut))}
              </p>
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
            <p className="text-muted-foreground text-sm text-center py-8">No transactions yet</p>
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
