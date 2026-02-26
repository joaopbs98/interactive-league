"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ListTodo, Info } from "lucide-react";
import Link from "next/link";

type LeagueInfo = {
  id: string;
  season: number;
  status: string;
  total_rounds?: number;
  current_round?: number;
  draft_active?: boolean;
  match_mode?: "SIMULATED" | "MANUAL";
};

type TeamInfo = { id: string; name: string; acronym: string };

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  note?: string;
};

async function fetchChecklistData(leagueId: string, season: number) {
  const [sponsorsRes, draftPoolRes, scheduleRes] = await Promise.all([
    fetch(`/api/league/sponsors?leagueId=${leagueId}`),
    fetch(`/api/league/draft-pool?leagueId=${leagueId}`),
    fetch(`/api/league/game?leagueId=${leagueId}&type=schedule&season=${season}`),
  ]);
  const sponsors = await sponsorsRes.json();
  const draftPool = await draftPoolRes.json();
  const schedule = await scheduleRes.json();
  return {
    sponsorCount: (sponsors.sponsorIds ?? sponsors.data ?? []).length,
    draftPoolCount: (Array.isArray(draftPool.data) ? draftPool.data : []).length,
    matchCount: (schedule.data || []).length,
  };
}

export function HostChecklist({
  leagueId,
  league,
  teams,
  onRefresh,
}: {
  leagueId: string;
  league: LeagueInfo | null;
  teams: TeamInfo[];
  onRefresh: () => void;
}) {
  const [data, setData] = useState<{
    sponsorCount: number;
    draftPoolCount: number;
    matchCount: number;
  } | null>(null);

  useEffect(() => {
    if (!leagueId || !league) return;
    fetchChecklistData(leagueId, league.season ?? 1).then(setData);
  }, [leagueId, league?.season]);

  if (!league) return null;

  const status = league.status || "PRESEASON_SETUP";
  const season = league.season ?? 1;
  const isSeason1 = season === 1;

  const items: ChecklistItem[] = [];

  // PRESEASON_SETUP or OFFSEASON (before season start)
  if (status === "PRESEASON_SETUP" || status === "OFFSEASON") {
    // Season 1: simpler flow
    if (isSeason1) {
      items.push({
        id: "teams",
        label: "At least 2 teams in league",
        done: teams.length >= 2,
      });
      items.push({
        id: "validate",
        label: "Validate registration (21–23 players, max 3 GKs)",
        done: false, // Would need to call validate to know
        href: "#schedule",
      });
      items.push({
        id: "schedule",
        label: "Generate or create schedule",
        done: (data?.matchCount ?? 0) > 0,
        href: "/main/dashboard/schedule",
      });
      items.push({
        id: "start",
        label: "Generate schedule → league goes IN_SEASON",
        done: false,
        note: "Use 'Generate Round-Robin' on Schedule page",
      });
    } else {
      // Season 2+
      items.push({
        id: "draft_pool",
        label: "Add players to draft pool",
        done: (data?.draftPoolCount ?? 0) > 0,
        href: "#draft",
      });
      items.push({
        id: "start_draft",
        label: "Start draft (when pool ready)",
        done: !league.draft_active,
        note: league.draft_active ? "Draft in progress" : "Run after pool has players",
      });
      items.push({
        id: "fa_pool",
        label: "FA pool & resolve (optional)",
        done: false,
        note: "Set pool, deadline; resolve when bids placed",
      });
      items.push({
        id: "sponsors",
        label: "Pick 3 sponsors for season",
        done: (data?.sponsorCount ?? 0) >= 3,
        href: "#sponsors",
      });
      items.push({
        id: "validate",
        label: "Validate registration",
        done: false,
        href: "#schedule",
      });
      items.push({
        id: "schedule",
        label: "Generate or create schedule",
        done: (data?.matchCount ?? 0) > 0,
        href: "/main/dashboard/schedule",
      });
      items.push({
        id: "start",
        label: "Generate schedule → IN_SEASON",
        done: false,
        note: "Schedule page → Generate Round-Robin",
      });
    }
  }

  // IN_SEASON
  if (status === "IN_SEASON") {
    items.push({
      id: "matchdays",
      label: "Simulate or insert match results",
      done: false,
      note: league.match_mode === "MANUAL" ? "Insert Results page" : "Simulate Matchday",
    });
    items.push({
      id: "competition",
      label: "Set competition results (HOF) before End Season",
      done: false,
      note: "Optional: UCL/UEL/UECL stage per team",
    });
    items.push({
      id: "end",
      label: "End season when all matches done",
      done: false,
      note: "Prizes, wages, contract expiry, next season",
    });
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            <CardTitle className="text-base">Host Checklist</CardTitle>
            <Badge variant="outline" className="text-xs">
              {doneCount}/{items.length}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {status.replace(/_/g, " ")} · Season {season}
          </span>
        </div>
        <CardDescription>
          Tasks to complete for this phase. Varies by season.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={item.done}
                disabled
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
                {item.note && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {item.note}
                  </span>
                )}
                {item.href && !item.done && (
                  <Link
                    href={item.href}
                    className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                  >
                    Go →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>

        <details className="group">
          <summary className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <Info className="h-3 w-3 shrink-0" />
            <span>International competitions (UCL, UEL, UECL)</span>
          </summary>
          <div className="mt-2 pl-5 text-xs text-muted-foreground space-y-1">
            <p>
              International competitions use a different format than the domestic league:
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Group stage: UCL 1 group of 6 (10 games), UEL/UECL 1 group of 4 each (6 games)</li>
              <li>Knockout: Stage Two → Semi-Finals → Final</li>
              <li>Qualification: proportional from current season (14-team basis: 6 UCL, 4 UECL, 4 UEL). Scales for 10–20 teams. Super Cup: UCL vs UEL winners from previous season, from S2.</li>
            </ul>
            <p className="mt-2">
              When adding international matches manually, set <strong>Type</strong> to UCL/UEL/UECL/Super Cup and use{" "}
              <strong>group_name</strong> (A) for group stage. Standings update in History & Stats.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
