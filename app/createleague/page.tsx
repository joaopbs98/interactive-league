"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
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
      let logoUrl: string | null = null;
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${teamName
          .trim()
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

      let invites: string[] = [];
      if (inviteEmails.trim() !== "") {
        invites = inviteEmails
          .split(",")
          .map((email) => email.trim())
          .filter((em) => !!em);
      }

      // Call our API route instead of Supabase Edge Function directly
      const response = await fetch("/api/createleague", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: leagueName,
          teamName: teamName,
          teamAcronym: teamAcronym,
          logoUrl: logoUrl,
          invites: invites,
          maxTeams: maxTeams,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create league");
      }

      // Clear stale league context before redirecting
      clearSelection();

      const inviteCode = result.data?.inviteCode;
      if (inviteCode) {
        alert(`League created! Share this invite code with friends:\n\n${inviteCode}`);
      }
      router.push("/saves?created=true");
    } catch (err: any) {
      console.error("CreateLeague error", err);
      setErrorMsg(err.message || err.description || "Failed to create league");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Create League</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateLeague} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leagueName" className="text-white">League Name</Label>
              <Input
                id="leagueName"
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="League Name"
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTeams" className="text-white">Max Teams</Label>
              <Select value={String(maxTeams)} onValueChange={(v) => setMaxTeams(Number(v))}>
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
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
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-white">Team Name</Label>
              <Input
                id="teamName"
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team Name"
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamAcronym" className="text-white">Acronym (3 letters)</Label>
              <Input
                id="teamAcronym"
                type="text"
                value={teamAcronym}
                onChange={(e) => setTeamAcronym(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="e.g. SLB"
                required
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoFile" className="text-white">Team Logo (PNG)</Label>
              <Input
                id="logoFile"
                type="file"
                accept="image/png"
                onChange={handleFileChange}
                className="bg-neutral-800 border-neutral-700 text-white file:bg-neutral-700 file:text-white file:border-0 file:rounded file:px-3 file:py-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteEmails" className="text-white">Invite Emails (optional)</Label>
              <Input
                id="inviteEmails"
                type="text"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="e.g. test@email.com, another@email.com"
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
              />
            </div>
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Creating League..." : "Create League"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateLeaguePage;
