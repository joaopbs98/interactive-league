"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Settings, Play, Trophy, RotateCcw, Shield } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const SECTIONS = [
  {
    icon: Calendar,
    title: "League Lifecycle",
    description: "Status badges and phase transitions",
    body: (
      <>
        <p>
          Leagues move through phases: <strong>Draft</strong> (teams join, draft players),{" "}
          <strong>Preseason</strong> (transfers, tactics), <strong>In Season</strong> (matches run), and{" "}
          <strong>Offseason</strong> (between seasons). The status badge in Host Controls shows the current phase.
        </p>
        <p>
          Transitions happen automatically or via host actions (e.g. Start Season, End Season). Ensure all matches are
          simulated before ending the season.
        </p>
      </>
    ),
  },
  {
    icon: Settings,
    title: "League Settings",
    description: "Transfer window and match mode",
    body: (
      <>
        <p>
          <strong>Transfer Window:</strong> When open, managers can make roster moves (trades, signings, auctions).
          Close it during matchdays to lock squads.
        </p>
        <p>
          <strong>Match Mode:</strong> Choose <strong>Simulated</strong> (AI simulates results) or{" "}
          <strong>Manual</strong> (host enters results via Insert Results). Changes apply immediately.
        </p>
      </>
    ),
  },
  {
    icon: Calendar,
    title: "Schedule",
    description: "Generate and manage matches",
    body: (
      <>
        <p>
          Use <strong>Generate Schedule</strong> in Host Controls to create domestic rounds. For international
          competitions (UCL, UEL, UECL), add matches manually via the Schedule page or Manual Schedule form.
        </p>
        <p>
          Manual match creation lets you pick competition type (Domestic, UCL, UEL, UECL), round, group (for group
          stage), and home/away teams.
        </p>
      </>
    ),
  },
  {
    icon: Play,
    title: "Match Simulation",
    description: "Simulated vs Manual mode",
    body: (
      <>
        <p>
          <strong>Simulated mode:</strong> Use &quot;Simulate Matchday&quot; for domestic rounds and
          &quot;Simulate UCL/UEL/UECL Matchday&quot; for each competition. Results are generated automatically.
        </p>
        <p>
          <strong>Manual mode:</strong> Go to <Link href="/main/dashboard/insert-results" className="text-accent hover:text-accent/80 transition-colors duration-150">Insert Results</Link>.
          Select the competition (Domestic, UCL, UEL, UECL) and enter scores for each scheduled match. The page shows
          the current round for each competition.
        </p>
      </>
    ),
  },
  {
    icon: Trophy,
    title: "Competition Stages",
    description: "UCL/UEL/UECL stage assignment",
    body: (
      <>
        <p>
          UCL, UEL, and UECL stages (group stage, knockout, round of 16, etc.) are <strong>auto-assigned</strong> from
          match results. There is no manual form to set stages.
        </p>
        <p>
          Stages are derived when matches are completed. Knockout rounds use group_name NULL; the final is the round
          with the fewest matches; semi-finals are the next. This runs automatically when you insert results or
          simulate matchdays.
        </p>
      </>
    ),
  },
  {
    icon: RotateCcw,
    title: "End Season",
    description: "When to run and what it does",
    body: (
      <>
        <p>
          Run <strong>End Season</strong> when all matches (domestic and competitions) have been simulated or
          manually entered. The system checks that no scheduled matches remain.
        </p>
        <p>
          End Season: distributes prize money by position, updates Hall of Fame, processes sponsor bonuses/penalties,
          decrements contract years and expires/releases players, deducts wages, computes merchandise revenue,
          updates CompIndex (top 14 OVR average), increments season, resets round counters, and sets status to
          OFFSEASON.
        </p>
      </>
    ),
  },
  {
    icon: Shield,
    title: "Host Teams",
    description: "Granting host rights (commissioner only)",
    body: (
      <p>
        The commissioner can grant host rights to other team owners. Toggle a team in the Host Teams section to
        give its owner host access. Hosts can manage schedule, simulate matchdays, insert results, and run end
        season.
      </p>
    ),
  },
];

export default function HostManualPage() {
  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Breadcrumbs />
      <PageHeader
        eyebrow="League"
        title="Host Manual"
        subtitle="This guide explains how to use the app as a league host. Use Host Controls to manage your league."
        actions={
          <Link href="/main/dashboard/host-controls">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
            </Button>
          </Link>
        }
      />

      {SECTIONS.map(({ icon: Icon, title, description, body }, i) => (
        <section
          key={title}
          className="panel-in rounded-lg border border-border bg-surface overflow-hidden"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
              <p className="text-xs text-faint-foreground truncate">{description}</p>
            </div>
          </div>
          <div className="p-5 space-y-3 text-sm">
            {body}
          </div>
        </section>
      ))}

      <Link href="/main/dashboard/host-controls">
        <Button variant="outline" className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Host Controls
        </Button>
      </Link>
    </div>
  );
}
