"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

type TeamRef = { id: string; name: string; acronym: string; logo_url: string | null } | null;

function TeamBadge({ team }: { team: TeamRef }) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <div className="h-14 w-14 rounded-full bg-surface-3 border border-border-strong flex items-center justify-center overflow-hidden shrink-0">
        {team?.logo_url ? (
          <img src={team.logo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-base font-bold text-muted-foreground">{team?.acronym?.slice(0, 3) || "?"}</span>
        )}
      </div>
      <span className="text-sm font-semibold truncate max-w-[96px]">{team?.acronym || "?"}</span>
    </div>
  );
}

export function NextMatchHero({
  round,
  homeTeam,
  awayTeam,
}: {
  round?: number;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
}) {
  if (!homeTeam && !awayTeam) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-6 sm:p-8 flex flex-col items-center justify-center gap-3 text-center h-full">
        <Calendar className="h-6 w-6 text-faint-foreground" />
        <p className="text-sm text-muted-foreground">No upcoming match scheduled</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border-strong bg-surface-2 p-6 sm:p-8 flex flex-col h-full glow-green">
      <p className="relative text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
        Next Match{round ? ` · Round ${round}` : ""}
      </p>
      <div className="relative flex-1 flex items-center justify-center gap-6">
        <TeamBadge team={homeTeam} />
        <span className="text-xs font-semibold text-faint-foreground uppercase tracking-wider">vs</span>
        <TeamBadge team={awayTeam} />
      </div>
      <Link href="/main/dashboard/schedule" className="relative mt-6">
        <Button variant="outline" size="sm" className="w-full bg-surface-3 border-border-strong hover:bg-accent-muted hover:text-accent hover:border-accent transition-colors duration-150">
          View Schedule
        </Button>
      </Link>
    </div>
  );
}
