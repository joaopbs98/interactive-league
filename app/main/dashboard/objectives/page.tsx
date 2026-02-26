"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/contexts/LeagueContext";
import { Target, Trophy, Briefcase } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
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
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Target className="h-7 w-7" />
        Objectives Tracker
      </h2>

      {sponsorObjective && (
        <Card className="bg-neutral-900 border-neutral-800 border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Sponsor bonus objective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{sponsorObjective.description}</p>
            {sponsorObjective.bonus_amount != null && sponsorObjective.bonus_amount > 0 && (
              <p className="text-sm font-medium text-green-400 mt-2">
                Bonus: €{formatMoney(sponsorObjective.bonus_amount)}
              </p>
            )}
            <Link href="/main/dashboard/sponsors">
              <span className="text-sm text-primary hover:underline mt-2 inline-block">View sponsor details →</span>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Trade objectives
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Conditional clauses from trades. Evaluated at end of season.
          </p>
        </CardHeader>
        <CardContent>
          {tradeObjectives.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No trade objectives yet. Create trades with objectives to see them here.
            </p>
          ) : (
            <div className="space-y-4">
              {tradeObjectives.map((obj) => (
                <div
                  key={obj.id}
                  className={`p-4 rounded-lg border ${
                    obj.fulfilled ? "bg-green-900/20 border-green-800/50" : "bg-neutral-800/50 border-neutral-800"
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
                      <p className={`text-sm font-bold mt-1 ${obj.direction === "we_receive_if_met" ? "text-green-400" : "text-amber-400"}`}>
                        {obj.direction === "we_receive_if_met" ? "+" : ""}€{formatMoney(obj.reward_amount)}
                      </p>
                    </div>
                  </div>
                  {obj.trade_id && (
                    <Link href="/main/dashboard/trades">
                      <span className="text-xs text-primary hover:underline">View trade →</span>
                    </Link>
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
