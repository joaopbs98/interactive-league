"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/contexts/LeagueContext";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  Shield,
  Loader2,
  ScrollText,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

type TeamWithSquad = {
  id: string;
  name: string;
  acronym: string;
  formation: string | null;
  eafc_tactic_code: string | null;
  eafc_comment?: string | null;
  squad: { id: string; player_id: string; player_name: string; role?: string }[];
};

type AuditLog = {
  id: string;
  action: string;
  actor_id: string | null;
  payload: unknown;
  created_at: string;
};

export default function EafcSetupPage() {
  const router = useRouter();
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [teams, setTeams] = useState<TeamWithSquad[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const leagueId = selectedLeagueId;
  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

  useEffect(() => {
    if (leagueId && isHost) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [leagueId, isHost]);

  const fetchData = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const [squadsRes, logsRes] = await Promise.all([
        fetch(`/api/league/host/squads?leagueId=${leagueId}`),
        fetch(`/api/league/game?leagueId=${leagueId}&type=audit_logs`),
      ]);
      const squadsData = await squadsRes.json();
      const logsData = await logsRes.json();
      if (squadsData.success) setTeams(squadsData.data || []);
      if (logsData.success) setAuditLogs(logsData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const hostActionsLogs = auditLogs.filter(
    (l) =>
      l.action === "host_edit_player" ||
      l.action === "insert_match_result" ||
      l.action === "apply_fine"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="p-8">
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Host Only</p>
            <p className="text-sm text-muted-foreground">
              Only the league commissioner can view EAFC Setup.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Breadcrumbs />
      <PageHeader
        eyebrow="League"
        title="EAFC Setup"
        subtitle="Click a team to view formation, squad, tactic code, and manager notes."
        actions={
          <Button variant="outline" onClick={() => router.push("/main/dashboard/host-controls")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
          </Button>
        }
      />

      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Teams
          </h2>
          <span className="text-[10px] text-faint-foreground uppercase tracking-wider ml-auto">
            {teams.length} total
          </span>
        </div>
        <div className="divide-y divide-border">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/main/dashboard/eafc-setup/${team.id}`}
              className="group flex items-center gap-4 px-5 py-4 hover:bg-surface-2 transition-colors duration-150"
            >
              <div className="h-9 w-9 rounded-full bg-surface-3 border border-border flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-foreground">
                  {team.acronym || team.name.slice(0, 3).toUpperCase()}
                </span>
              </div>
              <span className="font-semibold flex-1 min-w-0 truncate">{team.name}</span>
              <Badge variant="outline" className="shrink-0">{team.formation || "—"}</Badge>
              <Badge className="shrink-0">{team.squad.length} players</Badge>
              <code className="hidden sm:block text-xs font-mono text-muted-foreground truncate w-[140px] shrink-0">
                {team.eafc_tactic_code || "—"}
              </code>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors duration-150" />
            </Link>
          ))}
          {teams.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">No teams yet.</p>
          )}
        </div>
      </section>

      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Host Changelog
            </h2>
          </div>
        </div>
        <div className="p-5">
          {hostActionsLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No host actions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {hostActionsLogs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-2 rounded bg-surface-3 text-sm"
                >
                  <Badge variant="outline" className="text-xs shrink-0">
                    {log.action}
                  </Badge>
                  <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap flex-1">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
