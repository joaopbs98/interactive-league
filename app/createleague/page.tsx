"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const CreateLeaguePage: React.FC = () => {
  const router = useRouter();
  const supabase = createClient();

  const [leagueName, setLeagueName] = useState<string>("");
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
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create league");
      }

      // ✅ Success
      router.push("/main/dashboard");
    } catch (err: any) {
      console.error("CreateLeague error", err);
      setErrorMsg(err.message || err.description || "Failed to create league");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-background rounded-xl shadow-xl mt-10">
      <h1 className="text-xl font-bold mb-6">Create League</h1>
      <form onSubmit={handleCreateLeague} className="space-y-4">
        <div>
          <label className="block mb-1">League Name</label>
          <input
            type="text"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            placeholder="League Name"
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block mb-1">Team Name</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team Name"
            required
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block mb-1">Acronym (3 letters)</label>
          <input
            type="text"
            value={teamAcronym}
            onChange={(e) => setTeamAcronym(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="e.g. SLB"
            required
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block mb-1">Team Logo (PNG)</label>
          <input
            type="file"
            accept="image/png"
            onChange={handleFileChange}
            className="w-full"
          />
        </div>
        <div>
          <label className="block mb-1">Invite Emails (optional)</label>
          <input
            type="text"
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            placeholder="e.g. test@email.com, another@email.com"
            className="w-full border rounded p-2"
          />
        </div>
        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded"
        >
          {loading ? "Creating League..." : "Create League"}
        </button>
      </form>
    </div>
  );
};

export default CreateLeaguePage;
