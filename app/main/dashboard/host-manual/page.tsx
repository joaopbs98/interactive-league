"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Calendar, Settings, Play, Trophy, RotateCcw, Shield } from "lucide-react";
import Link from "next/link";

export default function HostManualPage() {
  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-7 w-7" /> Host Manual
        </h1>
        <Link href="/main/dashboard/host-controls">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
          </Button>
        </Link>
      </div>

      <p className="text-muted-foreground">
        This guide explains how to use the app as a league host. Use Host Controls to manage your league.
      </p>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> League Lifecycle
          </CardTitle>
          <CardDescription>Status badges and phase transitions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Leagues move through phases: <strong>Draft</strong> (teams join, draft players),{" "}
            <strong>Preseason</strong> (transfers, tactics), <strong>In Season</strong> (matches run), and{" "}
            <strong>Offseason</strong> (between seasons). The status badge in Host Controls shows the current phase.
          </p>
          <p>
            Transitions happen automatically or via host actions (e.g. Start Season, End Season). Ensure all matches are
            simulated before ending the season.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> League Settings
          </CardTitle>
          <CardDescription>Transfer window and match mode</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Transfer Window:</strong> When open, managers can make roster moves (trades, signings, auctions).
            Close it during matchdays to lock squads.
          </p>
          <p>
            <strong>Match Mode:</strong> Choose <strong>Simulated</strong> (AI simulates results) or{" "}
            <strong>Manual</strong> (host enters results via Insert Results). Changes apply immediately.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Schedule
          </CardTitle>
          <CardDescription>Generate and manage matches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Use <strong>Generate Schedule</strong> in Host Controls to create domestic rounds. For international
            competitions (UCL, UEL, UECL), add matches manually via the Schedule page or Manual Schedule form.
          </p>
          <p>
            Manual match creation lets you pick competition type (Domestic, UCL, UEL, UECL), round, group (for group
            stage), and home/away teams.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" /> Match Simulation
          </CardTitle>
          <CardDescription>Simulated vs Manual mode</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Simulated mode:</strong> Use &quot;Simulate Matchday&quot; for domestic rounds and
            &quot;Simulate UCL/UEL/UECL Matchday&quot; for each competition. Results are generated automatically.
          </p>
          <p>
            <strong>Manual mode:</strong> Go to <Link href="/main/dashboard/insert-results" className="text-primary underline">Insert Results</Link>.
            Select the competition (Domestic, UCL, UEL, UECL) and enter scores for each scheduled match. The page shows
            the current round for each competition.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" /> Competition Stages
          </CardTitle>
          <CardDescription>UCL/UEL/UECL stage assignment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            UCL, UEL, and UECL stages (group stage, knockout, round of 16, etc.) are <strong>auto-assigned</strong> from
            match results. There is no manual form to set stages.
          </p>
          <p>
            Stages are derived when matches are completed. Knockout rounds use group_name NULL; the final is the round
            with the fewest matches; semi-finals are the next. This runs automatically when you insert results or
            simulate matchdays.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" /> End Season
          </CardTitle>
          <CardDescription>When to run and what it does</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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
        </CardContent>
      </Card>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Host Teams
          </CardTitle>
          <CardDescription>Granting host rights (commissioner only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The commissioner can grant host rights to other team owners. Toggle a team in the Host Teams section to
            give its owner host access. Hosts can manage schedule, simulate matchdays, insert results, and run end
            season.
          </p>
        </CardContent>
      </Card>

      <Link href="/main/dashboard/host-controls">
        <Button variant="outline" className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Host Controls
        </Button>
      </Link>
    </div>
  );
}
