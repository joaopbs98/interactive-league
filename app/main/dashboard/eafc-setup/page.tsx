"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Shield,
  Loader2,
  Gamepad2,
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
        <Card className="bg-neutral-900 border-neutral-800">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="h-7 w-7" /> EAFC Setup
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Click a team to view formation, squad, tactic code, and manager notes.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/main/dashboard/host-controls")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Host Controls
        </Button>
      </div>

      <div className="grid gap-3">
        {teams.map((team) => (
          <Link key={team.id} href={`/main/dashboard/eafc-setup/${team.id}`}>
            <Card className="bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800/50 hover:border-neutral-700 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <span className="font-semibold flex-1">{team.name}</span>
                <Badge variant="outline">{team.formation || "—"}</Badge>
                <Badge>{team.squad.length} players</Badge>
                {team.eafc_tactic_code && (
                  <code className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                    {team.eafc_tactic_code}
                  </code>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" /> Host Changelog
          </CardTitle>
          <CardDescription>
            All host actions (player edits, result inserts, fines) are logged here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hostActionsLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No host actions yet.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {hostActionsLogs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-2 rounded bg-neutral-800/50 text-sm"
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
        </CardContent>
      </Card>
    </div>
  );
}
