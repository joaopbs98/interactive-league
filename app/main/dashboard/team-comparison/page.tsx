"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeague } from "@/contexts/LeagueContext";
import { Users, Trophy } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";

type Team = { id: string; name: string; acronym: string };
type SquadPlayer = { id: string; name: string; position: string; rating?: number };

function formatMoney(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export default function TeamComparisonPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [teams, setTeams] = useState<Team[]>([]);
  const [opponentId, setOpponentId] = useState<string>("");
  const [ourSquad, setOurSquad] = useState<SquadPlayer[]>([]);
  const [theirSquad, setTheirSquad] = useState<SquadPlayer[]>([]);
  const [ourWage, setOurWage] = useState(0);
  const [theirWage, setTheirWage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedLeagueId) {
      setTeams([]);
      setLoading(false);
      return;
    }
    fetch(`/api/league/teams?leagueId=${selectedLeagueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) setTeams(d.data);
        else setTeams([]);
      })
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, [selectedLeagueId]);

  useEffect(() => {
    if (!selectedLeagueId || !selectedTeam?.id) return;
    setOpponentId("");
    fetch(`/api/user/team/${selectedLeagueId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.squad) {
          setOurSquad(
            (d.data.squad as { player_id: string; full_name?: string; player_name?: string; positions?: string; rating?: number }[])
              .map((p) => ({
                id: p.player_id,
                name: p.full_name || p.player_name || p.player_id,
                position: (p.positions || "").split(",")[0]?.trim() || "",
                rating: p.rating,
              }))
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          );
          setOurWage(d.data.wageBill ?? 0);
        } else {
          setOurSquad([]);
          setOurWage(0);
        }
      })
      .catch(() => {
        setOurSquad([]);
        setOurWage(0);
      });
  }, [selectedLeagueId, selectedTeam?.id]);

  useEffect(() => {
    if (!selectedLeagueId || !opponentId) {
      setTheirSquad([]);
      setTheirWage(0);
      return;
    }
    fetch(`/api/league/team-squad?leagueId=${selectedLeagueId}&teamId=${opponentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.squad) {
          const sq = (d.squad as { id: string; name: string; position: string; rating?: number }[]).map((p) => ({
            ...p,
            rating: p.rating,
          }));
          setTheirSquad(sq.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)));
        } else {
          setTheirSquad([]);
        }
      })
      .catch(() => setTheirSquad([])) as Promise<void>;

    setTheirWage(0);
  }, [selectedLeagueId, opponentId]);

  const ourAvg = ourSquad.length > 0
    ? Math.round(ourSquad.reduce((s, p) => s + (p.rating ?? 0), 0) / ourSquad.length)
    : 0;
  const theirAvg = theirSquad.length > 0
    ? Math.round(theirSquad.reduce((s, p) => s + (p.rating ?? 0), 0) / theirSquad.length)
    : 0;
  const ourTop14 = ourSquad.slice(0, 14);
  const theirTop14 = theirSquad.slice(0, 14);

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
        <p className="text-muted-foreground">Select a league and team to compare.</p>
      </div>
    );
  }

  const opponents = teams.filter((t) => t.id !== selectedTeam.id);

  return (
    <div className="p-8 flex flex-col gap-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Users className="h-7 w-7" />
        Team Comparison
      </h2>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Compare with:</span>
        <Select value={opponentId} onValueChange={setOpponentId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select opponent" />
          </SelectTrigger>
          <SelectContent>
            {opponents.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} ({t.acronym})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!opponentId ? (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            Select an opponent to compare squads.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-neutral-900 border-neutral-800 border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="text-lg">{selectedTeam.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg rating</span>
                  <span className="font-bold">{ourAvg}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wage bill</span>
                  <span className="font-bold">{formatMoney(ourWage)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Squad size</span>
                  <span className="font-bold">{ourSquad.length}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800 border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">
                  {opponents.find((t) => t.id === opponentId)?.name ?? "Opponent"}
                </CardTitle>
                <Link href={`/main/dashboard/team/${opponentId}/squad?league=${selectedLeagueId}`}>
                  <Button variant="outline" size="sm" className="shrink-0">
                    View squad
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg rating</span>
                  <span className="font-bold">{theirAvg}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wage bill</span>
                  <span className="font-bold text-muted-foreground">—</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Squad size</span>
                  <span className="font-bold">{theirSquad.length}</span>
                </div>
                <Link
                  href={`/main/dashboard/team/${opponentId}/squad?league=${selectedLeagueId}`}
                  className="block pt-2"
                >
                  <Button variant="secondary" size="sm" className="w-full">
                    View full roster
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Top 14 by rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{selectedTeam.name}</p>
                  <div className="space-y-1">
                    {ourTop14.map((p, i) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{i + 1}. {p.name}</span>
                        <span className="font-medium">{p.rating ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {opponents.find((t) => t.id === opponentId)?.name ?? "Opponent"}
                  </p>
                  <Link
                    href={`/main/dashboard/team/${opponentId}/squad?league=${selectedLeagueId}`}
                    className="text-xs text-primary hover:underline mb-2 inline-block"
                  >
                    View full roster
                  </Link>
                  <div className="space-y-1">
                    {theirTop14.map((p, i) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{i + 1}. {p.name}</span>
                        <span className="font-medium">{p.rating ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
