"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/contexts/LeagueContext";
import { Trophy, Briefcase } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import Link from "next/link";

type TradeObjective = {
  id: string;
  description: string;
  trigger_condition: string;
  reward_amount: number;
  fulfilled: boolean;
  trade_id: string | null;
  from_team: { name: string; acronym: string } | null;
  to_team: { name: string; acronym: string } | null;
  direction: "we_pay_if_fail" | "we_receive_if_met";
};

type ObjectivesData = {
  tradeObjectives: TradeObjective[];
  sponsorObjective: { description: string; bonus_amount: number | null } | null;
};

function formatMoney(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export default function ObjectivesPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [data, setData] = useState<ObjectivesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedTeam?.id && selectedLeagueId) {
      setLoading(true);
      fetch(`/api/objectives?leagueId=${selectedLeagueId}&teamId=${selectedTeam.id}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data) setData(json.data);
          else setData(null);
        })
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else {
      setData(null);
      setLoading(false);
    }
  }, [selectedTeam?.id, selectedLeagueId]);

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  if (!selectedTeam || !selectedLeagueId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Select a league and team to view objectives.</p>
      </div>
    );
  }

  const { tradeObjectives = [], sponsorObjective } = data || {};

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Breadcrumbs />
      <PageHeader eyebrow="Overview" title="Objectives Tracker" />

      {sponsorObjective && (
        <section className="panel-in rounded-lg border border-status-warning/30 bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <Trophy className="h-4 w-4 text-status-warning" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sponsor Bonus Objective</h2>
          </div>
          <div className="p-5">
            <p className="text-sm">{sponsorObjective.description}</p>
            {sponsorObjective.bonus_amount != null && sponsorObjective.bonus_amount > 0 && (
              <p className="text-sm font-medium text-status-positive mt-2">
                Bonus: €{formatMoney(sponsorObjective.bonus_amount)}
              </p>
            )}
            <Link href="/main/dashboard/sponsors" className="text-sm text-accent hover:text-accent/80 mt-2 inline-block transition-colors duration-150">
              View sponsor details →
            </Link>
          </div>
        </section>
      )}

      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Trade Objectives</h2>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground mb-4">
            Conditional clauses from trades. Evaluated at end of season.
          </p>
          {tradeObjectives.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No trade objectives yet. Create trades with objectives to see them here.
            </p>
          ) : (
            <div className="space-y-3">
              {tradeObjectives.map((obj) => (
                <div
                  key={obj.id}
                  className={`p-4 rounded-lg border ${
                    obj.fulfilled ? "bg-status-positive/10 border-status-positive/30" : "bg-surface-2 border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{obj.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Condition: {obj.trigger_condition}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {obj.from_team?.acronym} → {obj.to_team?.acronym}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={obj.fulfilled ? "default" : "secondary"}>
                        {obj.fulfilled ? "Met" : "Pending"}
                      </Badge>
                      <p className={`text-sm font-bold mt-1 tabular-nums ${obj.direction === "we_receive_if_met" ? "text-status-positive" : "text-status-warning"}`}>
                        {obj.direction === "we_receive_if_met" ? "+" : ""}€{formatMoney(obj.reward_amount)}
                      </p>
                    </div>
                  </div>
                  {obj.trade_id && (
                    <Link href="/main/dashboard/trades" className="text-xs text-accent hover:text-accent/80 transition-colors duration-150">
                      View trade →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
