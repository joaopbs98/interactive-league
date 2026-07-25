"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeague } from "@/contexts/LeagueContext";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { getRatingColorClasses, getRatingColorClassesForInput } from "@/utils/ratingColors";
import { computeOverallFromStats } from "@/lib/computeOverallFromStats";
import { ArrowLeft, UserPlus, Loader2, Save, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast, Toaster } from "sonner";

const statCategories: Record<string, string[]> = {
  Attacking: ["crossing", "finishing", "heading_accuracy", "short_passing", "volleys"],
  Skill: ["dribbling", "curve", "fk_accuracy", "long_passing", "ball_control"],
  Movement: ["acceleration", "sprint_speed", "agility", "reactions", "balance"],
  Power: ["shot_power", "jumping", "stamina", "strength", "long_shots"],
  Mentality: ["aggression", "interceptions", "positioning", "vision", "penalties", "composure"],
  Defending: ["defensive_awareness", "standing_tackle", "sliding_tackle"],
  Goalkeeping: ["gk_diving", "gk_handling", "gk_kicking", "gk_positioning", "gk_reflexes"],
};

const formatStatName = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const POSITIONS = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"];
const FOOT_OPTIONS = ["Right", "Left"];
const BODY_TYPES = ["Lean", "Normal", "Stocky", "Unique"];

export default function AddPlayerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedTeam, selectedLeagueId } = useLeague();
  const teamId = searchParams.get("teamId") || selectedTeam?.id;
  const leagueId = searchParams.get("league") || selectedLeagueId;
  const editLeaguePlayerId = searchParams.get("edit");
  const isEditMode = !!editLeaguePlayerId;

  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(teamId ?? "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editLoading, setEditLoading] = useState(isEditMode);

  // Identity
  const [commonName, setCommonName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationality, setNationality] = useState("");
  const [mainPosition, setMainPosition] = useState("CM");
  const [positionsStr, setPositionsStr] = useState("");
  const [age, setAge] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // Key stats
  const [overall, setOverall] = useState("70");
  const [potential, setPotential] = useState("");

  // Youngster / Veteran
  const [playerType, setPlayerType] = useState<"youngster" | "veteran" | "neither">("neither");

  // Financials
  const [value, setValue] = useState("5000000");
  const [wage, setWage] = useState("500000");

  // Profile
  const [preferredFoot, setPreferredFoot] = useState("Right");
  const [skillMoves, setSkillMoves] = useState("3");
  const [weakFoot, setWeakFoot] = useState("3");
  const [internationalRep, setInternationalRep] = useState("1");
  const [bodyType, setBodyType] = useState("Normal");

  // Stats
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!leagueId) {
      setLoading(false);
      return;
    }
    fetch(`/api/league/teams?leagueId=${leagueId}`)
      .then((r) => r.json())
      .then((json) => {
        const teamList = json.teams ?? json.data ?? [];
        if (teamList.length > 0) {
          setTeams(teamList);
          if (teamId && teamList.some((t: { id: string }) => t.id === teamId)) {
            setSelectedTeamId(teamId);
          } else if (!selectedTeamId) {
            setSelectedTeamId(teamList[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [leagueId, teamId]);

  useEffect(() => {
    if (!isEditMode || !leagueId || !editLeaguePlayerId) {
      setEditLoading(false);
      return;
    }
    setEditLoading(true);
    fetch(`/api/league/host/league-player?leaguePlayerId=${editLeaguePlayerId}&leagueId=${leagueId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success || !json.data) {
          toast.error("Failed to load player");
          return;
        }
        const lp = json.data;
        setCommonName((lp.player_name || "").replace(/\s+-\s*$/, "").trim());
        const parts = (lp.full_name || lp.player_name || "").split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
        const pos = lp.positions || "CM";
        setMainPosition(pos.split(",")[0]?.trim() || "CM");
        setPositionsStr(pos);
        setOverall(String(lp.rating ?? 70));
        setPotential(lp.potential != null ? String(lp.potential) : "");
        setPlayerType(lp.is_youngster ? "youngster" : lp.is_veteran ? "veteran" : "neither");
        setSelectedTeamId(lp.team_id || teamId || "");
        const statKeys = Object.values(statCategories).flat();
        const loadedStats: Record<string, number> = {};
        for (const k of statKeys) {
          const v = lp[k];
          if (typeof v === "number") loadedStats[k] = v;
        }
        setStats((prev) => ({ ...prev, ...loadedStats }));
        const ir = lp.international_reputation;
        if (ir != null) {
          const n = parseInt(String(ir), 10);
          const val = Number.isNaN(n) ? 1 : n;
          setInternationalRep(String(Math.min(5, Math.max(1, val))));
        }
      })
      .catch(() => toast.error("Failed to load player"))
      .finally(() => setEditLoading(false));
  }, [isEditMode, leagueId, editLeaguePlayerId, teamId]);

  useEffect(() => {
    const defaultStats: Record<string, number> = {};
    for (const keys of Object.values(statCategories)) {
      for (const key of keys) {
        defaultStats[key] = 50;
      }
    }
    setStats((prev) => ({ ...defaultStats, ...prev }));
  }, []);

  // Auto-calculate overall from position-weighted stats + international reputation (FIFA/EAFC)
  const positionsForOvr = isEditMode ? positionsStr : mainPosition;
  useEffect(() => {
    const computed = computeOverallFromStats(
      positionsForOvr || mainPosition,
      stats,
      internationalRep
    );
    setOverall(String(computed));
  }, [positionsForOvr, mainPosition, stats, internationalRep]);

  const handleStatChange = (stat: string, value: number) => {
    const v = Math.min(99, Math.max(1, value));
    setStats((prev) => ({ ...prev, [stat]: v }));
  };

  const handleSubmit = async () => {
    const r = parseInt(overall, 10);
    if (isNaN(r) || r < 40 || r > 99) {
      toast.error("Overall rating must be 40-99");
      return;
    }
    if (playerType === "youngster") {
      const p = parseInt(potential, 10);
      if (isNaN(p) || p < 40 || p > 99) {
        toast.error("Potential (40-99) is required for youngsters");
        return;
      }
    }

    if (isEditMode && editLeaguePlayerId) {
      setSubmitting(true);
      try {
        const res = await fetch("/api/league/host/edit-player", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId,
            leaguePlayerId: editLeaguePlayerId,
            rating: r,
            positions: (isEditMode ? positionsStr : mainPosition).trim() || undefined,
            potential: potential.trim() ? parseInt(potential, 10) : null,
            is_youngster: playerType === "youngster",
            is_veteran: playerType === "veteran",
            internationalReputation: parseInt(internationalRep, 10) || 1,
            stats: Object.keys(stats).length ? stats : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save");
        toast.success("Player updated");
        router.push(`/main/dashboard/eafc-setup/${selectedTeamId || teamId}`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const name = commonName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!name) {
      toast.error("Enter at least Common name or First + Last name");
      return;
    }
    if (!selectedTeamId || !leagueId) {
      toast.error("Select a team");
      return;
    }
    const w = parseInt(wage, 10);
    if (isNaN(w) || w < 0) {
      toast.error("Enter a valid wage");
      return;
    }

    setSubmitting(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || name;
      const customPlayer: Record<string, unknown> = {
        name,
        fullName,
        positions: mainPosition,
        rating: r,
        wage: w,
        internationalReputation: parseInt(internationalRep, 10) || 1,
        nationality: nationality.trim() || undefined,
        age: age.trim() ? parseInt(age, 10) : undefined,
        dob: birthDate.trim() || undefined,
        heightCm: height.trim() ? height.trim() : undefined,
        weightKg: weight.trim() ? weight.trim() : undefined,
        value: value.trim() ? parseInt(value.replace(/[^0-9]/g, ""), 10) : undefined,
        preferredFoot: preferredFoot || undefined,
        skillMoves: skillMoves || undefined,
        weakFoot: weakFoot || undefined,
        bodyType: bodyType || undefined,
        potential: potential.trim() ? parseInt(potential, 10) : undefined,
        stats: Object.keys(stats).length ? stats : undefined,
        is_youngster: playerType === "youngster",
        is_veteran: playerType === "veteran",
        base_rating: playerType === "youngster" ? r : undefined,
      };

      const res = await fetch("/api/league/host/add-player-to-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          teamId: selectedTeamId,
          customPlayer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add player");
      toast.success(`Added ${data.data?.playerName ?? name}`);
      router.push(`/main/dashboard/eafc-setup/${selectedTeamId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!leagueId) {
    return (
      <div className="p-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
        <Breadcrumbs />
        <p className="text-muted-foreground">No league selected.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1180px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />

      <PageHeader
        eyebrow={isEditMode ? "Squad editor" : "League"}
        title={isEditMode ? (commonName || "Edit player") : "Add Custom Player"}
        subtitle={isEditMode ? "Adjust the player profile and EAFC attributes for this save only." : undefined}
        stats={isEditMode ? [
          { label: "OVR", value: overall, emphasis: true },
          { label: "Position", value: positionsStr || mainPosition },
          { label: "Team", value: teams.find((team) => team.id === selectedTeamId)?.name || "—" },
        ] : undefined}
        actions={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      {(loading || editLoading) ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading teams...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Team — a compact inline selector, not a whole card column for one dropdown */}
          <div className={`${isEditMode ? "hidden" : "flex"} rounded-lg border border-border-strong bg-surface p-4 items-center gap-3`}>
            <Label className="text-sm shrink-0">{isEditMode ? "Team" : "Assign to team"}</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={isEditMode}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue={isEditMode ? "stats" : "identity"}>
            <TabsList className={`${isEditMode ? "hidden" : "grid"} w-full h-auto grid-cols-4`}>
              {!isEditMode && <TabsTrigger value="identity">Identity</TabsTrigger>}
              <TabsTrigger value="stats">Stats</TabsTrigger>
              {!isEditMode && <TabsTrigger value="profile">Profile</TabsTrigger>}
              {!isEditMode && <TabsTrigger value="financials">Financials</TabsTrigger>}
            </TabsList>

              <TabsContent value="identity" className="mt-4">
                <Card className="bg-surface border-border">
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Common name *</Label>
                        <Input
                          value={commonName}
                          onChange={(e) => setCommonName(e.target.value)}
                          placeholder="e.g. Messi"
                        />
                      </div>
                      <div>
                        <Label>First name</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Lionel"
                        />
                      </div>
                      <div>
                        <Label>Last name</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Messi"
                        />
                      </div>
                      <div>
                        <Label>Nationality</Label>
                        <Input
                          value={nationality}
                          onChange={(e) => setNationality(e.target.value)}
                          placeholder="Argentina"
                        />
                      </div>
                      <div>
                        <Label>Main position *</Label>
                        <Select value={mainPosition} onValueChange={setMainPosition}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POSITIONS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Age</Label>
                        <Input
                          type="number"
                          min={16}
                          max={50}
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="25"
                        />
                      </div>
                      <div>
                        <Label>Birth date</Label>
                        <Input
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Height (cm)</Label>
                        <Input
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          placeholder="175"
                        />
                      </div>
                      <div>
                        <Label>Weight (kg)</Label>
                        <Input
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="70"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <Card className="bg-surface border-border overflow-hidden">
                  <CardHeader className="border-b border-border bg-surface-2/40">
                    <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /> Player attributes</CardTitle>
                    <p className="text-sm text-muted-foreground">Overall updates automatically as attributes and reputation change.</p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid sm:grid-cols-2 gap-4 mb-6 rounded-lg border border-border bg-surface-2/50 p-4">
                    <div>
                      <Label className="text-sm mb-2 block">Development type</Label>
                      <Select value={playerType} onValueChange={(v: "youngster" | "veteran" | "neither") => setPlayerType(v)}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="neither">Regular</SelectItem>
                          <SelectItem value="youngster">Youngster</SelectItem>
                          <SelectItem value="veteran">Veteran</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Youngsters can upgrade and require potential. Veterans are downgrade-only.
                      </p>
                    </div>
                    {isEditMode && (
                      <div>
                        <Label>Eligible positions</Label>
                        <Input
                          className="mt-2"
                          value={positionsStr}
                          onChange={(e) => setPositionsStr(e.target.value)}
                          placeholder="e.g. CB, LB, RB"
                        />
                      </div>
                    )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                      <div>
                        <Label>Overall rating *</Label>
                        {/* Computed, not user-editable — a stat display, not a fake input */}
                        <div
                          className={`mt-1.5 h-14 rounded-md flex items-center justify-center text-2xl font-bold tabular-nums ${getRatingColorClasses(parseInt(overall, 10) || 0)}`}
                        >
                          {overall}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Auto-calculated from primary position, stats &amp; intl. rep
                        </p>
                      </div>
                      <div>
                        <Label>Potential{playerType === "youngster" ? " *" : ""}</Label>
                        {potential ? (
                          <Input
                            type="number"
                            min={40}
                            max={99}
                            value={potential}
                            onChange={(e) => setPotential(e.target.value)}
                            className={`mt-1.5 h-14 text-center text-2xl font-bold tabular-nums border-0 ${getRatingColorClassesForInput(parseInt(potential, 10) || 0)}`}
                          />
                        ) : (
                          <Input
                            type="number"
                            min={40}
                            max={99}
                            value={potential}
                            onChange={(e) => setPotential(e.target.value)}
                            placeholder={playerType === "youngster" ? "Required" : "Optional"}
                            className={`mt-1.5 h-14 text-center text-sm border-2 border-dashed bg-surface-2 ${
                              playerType === "youngster" ? "border-status-warning/50" : "border-border-strong"
                            }`}
                          />
                        )}
                      </div>
                      <div>
                        <Label>International reputation (1-5)</Label>
                        <Select value={internationalRep} onValueChange={setInternationalRep}>
                          <SelectTrigger className="mt-1.5 h-14">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["1", "2", "3", "4", "5"].map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          FIFA/EAFC: affects OVR (3★ +1, 4★ +1-2, 5★ +1-3)
                        </p>
                      </div>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-4">
                    {Object.entries(statCategories).map(([cat, keys]) => (
                      <section key={cat} className="rounded-lg border border-border bg-surface-2/35 p-4">
                        <h3 className="text-sm font-semibold mb-4 pb-2 border-b border-border">
                          {cat}
                        </h3>
                        <div className="space-y-3">
                          {keys.map((stat) => {
                            const v = stats[stat] ?? 50;
                            return (
                              <div key={stat} className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground w-32 shrink-0 truncate">{formatStatName(stat)}</span>
                                <input
                                  type="range"
                                  min={1}
                                  max={99}
                                  value={v}
                                  onChange={(e) => handleStatChange(stat, parseInt(e.target.value, 10) || 50)}
                                  className="flex-1 accent-accent h-1.5 cursor-pointer"
                                />
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={v}
                                  onChange={(e) => handleStatChange(stat, parseInt(e.target.value, 10) || 50)}
                                  className={`w-11 h-6 rounded text-xs font-bold tabular-nums text-center shrink-0 border-0 p-0 ${getRatingColorClasses(v)}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profile" className="mt-4">
                <Card className="bg-surface border-border">
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Preferred foot</Label>
                        <Select value={preferredFoot} onValueChange={setPreferredFoot}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FOOT_OPTIONS.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Skill moves (1-5)</Label>
                        <Select value={skillMoves} onValueChange={setSkillMoves}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["1", "2", "3", "4", "5"].map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Weak foot (1-5)</Label>
                        <Select value={weakFoot} onValueChange={setWeakFoot}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["1", "2", "3", "4", "5"].map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Body type</Label>
                        <Select value={bodyType} onValueChange={setBodyType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BODY_TYPES.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="financials" className="mt-4">
                <Card className="bg-surface border-border">
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Value (€)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder="5000000"
                        />
                      </div>
                      <div>
                        <Label>Wage (€) *</Label>
                        <Input
                          type="number"
                          min={0}
                          value={wage}
                          onChange={(e) => setWage(e.target.value)}
                          placeholder="500000"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-xl border border-border-strong bg-surface/95 p-3 shadow-lg backdrop-blur-sm">
              <p className="hidden sm:block text-sm text-muted-foreground">
                {isEditMode ? "Changes apply only to this league save." : "Review the player details before adding them."}
              </p>
              <div className="flex gap-2 ml-auto">
              <Button onClick={handleSubmit} disabled={submitting || editLoading}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isEditMode ? <Save className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                {isEditMode ? "Save Changes" : "Add Player"}
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
