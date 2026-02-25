"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface League {
  id: string;
  name: string;
  season: number;
}

export default function JoinLeaguePage() {
  const router = useRouter();
  const supabase = createClient();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamAcronym, setTeamAcronym] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const response = await fetch("/api/leagues");
        if (response.ok) {
          const data = await response.json();
          setLeagues(data.leagues || []);
        }
      } catch (error) {
        console.error("Error fetching leagues:", error);
      }
    };
    fetchLeagues();
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!teamName || !teamAcronym) {
      setErrorMsg("Team name and acronym are required");
      return;
    }

    if (!selectedLeagueId && !inviteCode) {
      setErrorMsg("Select a league or enter an invite code");
      return;
    }

    setLoading(true);
    try {
      let logoUrl: string | null = null;

      if (logoFile) {
        const fileName = `${teamName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${logoFile.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("team-logos")
          .upload(fileName, logoFile);

        if (!uploadError) {
          const { data } = supabase.storage.from("team-logos").getPublicUrl(fileName);
          logoUrl = data.publicUrl;
        }
      }

      const response = await fetch("/api/joinleague", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId || undefined,
          inviteCode: inviteCode || undefined,
          teamName,
          teamAcronym,
          logoUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to join league");
      }

      router.push("/saves?joined=true");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to join league");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Join League</CardTitle>
          <CardDescription className="text-neutral-400">
            Join using an invite code or select from available leagues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-5">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="code" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-neutral-800">
                <TabsTrigger value="code">Invite Code</TabsTrigger>
                <TabsTrigger value="browse">Browse Leagues</TabsTrigger>
              </TabsList>

              <TabsContent value="code" className="mt-4">
                <div className="space-y-2">
                  <Label className="text-white">Invite Code</Label>
                  <Input
                    placeholder="e.g. ABC12345"
                    value={inviteCode}
                    onChange={e => { setInviteCode(e.target.value.toUpperCase()); setSelectedLeagueId(""); }}
                    className="bg-neutral-800 border-neutral-700 text-white font-mono tracking-wider text-center text-lg"
                    maxLength={8}
                  />
                </div>
              </TabsContent>

              <TabsContent value="browse" className="mt-4">
                <div className="space-y-2">
                  <Label className="text-white">Select League</Label>
                  <Select value={selectedLeagueId} onValueChange={v => { setSelectedLeagueId(v); setInviteCode(""); }}>
                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Choose a league" />
                    </SelectTrigger>
                    <SelectContent>
                      {leagues.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} (Season {l.season})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {leagues.length === 0 && (
                    <p className="text-xs text-muted-foreground">No public leagues available</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label className="text-white">Team Name</Label>
              <Input
                placeholder="e.g. SL Benfica"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                required
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Acronym (3 letters)</Label>
              <Input
                placeholder="e.g. SLB"
                value={teamAcronym}
                onChange={e => setTeamAcronym(e.target.value.toUpperCase().slice(0, 3))}
                required
                maxLength={3}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Team Logo (PNG)</Label>
              <Input
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={e => setLogoFile(e.target.files?.[0] || null)}
                className="bg-neutral-800 border-neutral-700 text-white"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
              {loading ? "Joining..." : "Join League"}
            </Button>

            <div className="text-center">
              <Link href="/saves" className="text-sm text-neutral-400 hover:text-white">
                Back to Saves
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
