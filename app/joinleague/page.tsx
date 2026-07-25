"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, KeyRound, Shield, Upload } from "lucide-react";

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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <Link
            href="/saves"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to leagues
          </Link>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">New Save</p>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-foreground">
              Join League
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Enter an invite code or pick a public league, then found your club
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <form onSubmit={handleJoin} className="space-y-6">
          {/* League section */}
          <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                League
              </h2>
            </div>
            <div className="p-5">
              <Tabs defaultValue="code" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="code">Invite Code</TabsTrigger>
                  <TabsTrigger value="browse">Browse Leagues</TabsTrigger>
                </TabsList>

                <TabsContent value="code" className="mt-4">
                  <div className="space-y-2">
                    <Label>Invite Code</Label>
                    <Input
                      placeholder="e.g. ABC12345"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        setSelectedLeagueId("");
                      }}
                      className="font-mono tracking-wider text-center text-lg"
                      maxLength={8}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="browse" className="mt-4">
                  <div className="space-y-2">
                    <Label>Select League</Label>
                    <Select value={selectedLeagueId} onValueChange={(v) => { setSelectedLeagueId(v); setInviteCode(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a league" />
                      </SelectTrigger>
                      <SelectContent>
                        {leagues.map((l) => (
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
            </div>
          </section>

          {/* Club identity section */}
          <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Your Club
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-4 items-start">
                <label htmlFor="logoFile" className="shrink-0 cursor-pointer group">
                  <div className="h-20 w-20 rounded-full border-2 border-dashed border-border-strong group-hover:border-accent/60 bg-surface-2 flex flex-col items-center justify-center overflow-hidden transition-colors duration-150">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Crest preview" className="h-full w-full object-cover" />
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-faint-foreground group-hover:text-accent transition-colors duration-150" />
                        <span className="text-[9px] text-faint-foreground mt-1 uppercase tracking-wider">Crest</span>
                      </>
                    )}
                  </div>
                  <input
                    id="logoFile"
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label>Team Name</Label>
                    <Input
                      placeholder="e.g. SL Benfica"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Acronym (3 letters)</Label>
                    <Input
                      placeholder="e.g. SLB"
                      value={teamAcronym}
                      onChange={(e) => setTeamAcronym(e.target.value.toUpperCase().slice(0, 3))}
                      required
                      maxLength={3}
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the crest to upload a PNG/JPG logo for your club (optional).
              </p>
            </div>
          </section>

          {errorMsg && (
            <Alert variant="destructive" className="border-status-negative/30 bg-status-negative/10">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-sm font-semibold uppercase tracking-wider"
          >
            {loading ? "Joining..." : "Join League"}
          </Button>
        </form>
      </div>
    </div>
  );
}
