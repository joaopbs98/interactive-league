"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Shield, Mail, ArrowLeft, Upload, Check, Copy } from "lucide-react";
import Link from "next/link";

const CreateLeaguePage: React.FC = () => {
  const router = useRouter();
  const supabase = createClient();
  const { clearSelection } = useLeague();

  const [leagueName, setLeagueName] = useState<string>("");
  const [maxTeams, setMaxTeams] = useState<number>(20);
  const [teamName, setTeamName] = useState<string>("");
  const [teamAcronym, setTeamAcronym] = useState<string>("");
  const [inviteEmails, setInviteEmails] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoPreview(null);
    }
  };

  const handleCreateLeague = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!teamName || !teamAcronym) {
      setErrorMsg("Team name and acronym are required");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("No auth token found");
      }

      const token = session.access_token;

      let logoUrl: string | null = null;
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${teamName
          .toLowerCase()
          .replace(/\s+/g, "-")}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("team-logos")
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("team-logos")
          .getPublicUrl(fileName);
        logoUrl = data.publicUrl;
      }

      const invites = inviteEmails
        .split(",")
        .map((email) => email.trim())
        .filter((e) => e !== "");

      const res = await fetch("/api/createleague", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: leagueName,
          teamName,
          teamAcronym,
          logoUrl,
          invites,
          maxTeams,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to create league");
      }

      clearSelection();

      const inviteCode = result.data?.inviteCode;
      if (inviteCode) {
        // Show the code inline instead of a blocking alert() the user can't copy from
        // and might dismiss before writing it down.
        setCreatedCode(inviteCode);
      } else {
        router.push("/saves?created=true");
      }
    } catch (err: any) {
      console.error("CreateLeague error", err);
      setErrorMsg(err.message || err.description || "Failed to create league");
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
              Create League
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Set up your competition and found your club
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {createdCode ? (
          <div className="panel-in rounded-lg border border-status-positive/30 bg-surface overflow-hidden text-center p-8">
            <p className="text-status-positive text-sm font-medium mb-2">League created</p>
            <p className="text-sm text-muted-foreground mb-4">Share this invite code with friends:</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="font-mono text-2xl font-bold tracking-[0.2em] bg-surface-2 border border-border-strong rounded-md px-5 py-3">
                {createdCode}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(createdCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-4 w-4 text-status-positive" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full h-11" onClick={() => router.push("/saves?created=true")}>
              Continue to Saves
            </Button>
          </div>
        ) : (
        <form onSubmit={handleCreateLeague} className="space-y-6">
          {/* Competition section */}
          <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Competition Setup
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leagueName">League Name</Label>
                <Input
                  id="leagueName"
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="e.g. Premier Fantasy League"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTeams">Max Teams</Label>
                <Select value={String(maxTeams)} onValueChange={(v) => setMaxTeams(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 teams</SelectItem>
                    <SelectItem value="16">16 teams</SelectItem>
                    <SelectItem value="18">18 teams</SelectItem>
                    <SelectItem value="20">20 teams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                {/* Crest preview */}
                <label
                  htmlFor="logoFile"
                  className="shrink-0 cursor-pointer group"
                >
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
                    accept="image/png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Team Name</Label>
                    <Input
                      id="teamName"
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Team Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamAcronym">Acronym (3 letters)</Label>
                    <Input
                      id="teamAcronym"
                      type="text"
                      value={teamAcronym}
                      onChange={(e) => setTeamAcronym(e.target.value.toUpperCase())}
                      maxLength={3}
                      placeholder="e.g. SLB"
                      required
                      className="uppercase"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the crest to upload a PNG logo for your club (optional).
              </p>
            </div>
          </section>

          {/* Invitations section */}
          <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "80ms" }}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Invitations
              </h2>
              <span className="text-[10px] text-faint-foreground uppercase tracking-wider ml-auto">Optional</span>
            </div>
            <div className="p-5 space-y-2">
              <Label htmlFor="inviteEmails">Invite Emails</Label>
              <Input
                id="inviteEmails"
                type="text"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="e.g. test@email.com, another@email.com"
              />
              <p className="text-xs text-muted-foreground">Separate multiple emails with commas.</p>
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
            {loading ? "Creating League..." : "Create League"}
          </Button>
        </form>
        )}
      </div>
    </div>
  );
};

export default CreateLeaguePage;
