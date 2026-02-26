"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLeague } from "@/contexts/LeagueContext";
import {
  Calendar, Users, Trophy, Settings, Play, StopCircle, Gavel,
  AlertTriangle, ScrollText, Loader2, Shield, Zap, DollarSign, UserPlus, BarChart3, UserPlus2, Trash2, BookOpen
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { PageSkeleton } from "@/components/PageSkeleton";

type LeagueInfo = {
  id: string;
  name: string;
  season: number;
  active_season: number;
  status: string;
  current_round: number;
  total_rounds: number;
  invite_code: string;
  max_teams?: number;
  match_mode?: 'SIMULATED' | 'MANUAL';
  transfer_window_open?: boolean;
  unsimulated_match_count?: number;
  current_round_ucl?: number;
  current_round_uel?: number;
  current_round_uecl?: number;
  has_ucl_matches?: boolean;
  has_uel_matches?: boolean;
  has_uecl_matches?: boolean;
  has_supercup_matches?: boolean;
  scheduled_ucl_this_round?: number;
  scheduled_uel_this_round?: number;
  scheduled_uecl_this_round?: number;
  scheduled_supercup_this_round?: number;
};

type TeamInfo = { id: string; name: string; acronym: string };

type AuditLog = {
  id: string;
  action: string;
  actor_id: string;
  payload: any;
  created_at: string;
};

type MatchRow = {
  id: string;
  round: number;
  home_team_id: string;
  away_team_id: string;
  match_status: string;
  home_team?: { name: string; acronym?: string };
  away_team?: { name: string; acronym?: string };
};

const SPONSOR_OBJECTIVES = [
  { code: "POSITION_4", label: "Top 4 finish" },
  { code: "POSITION_6", label: "Top 6 finish" },
  { code: "CHAMPION", label: "Champion" },
  { code: "UCL_WINNER", label: "UCL Winners" },
  { code: "UCL_GROUP", label: "UCL Group Stage" },
  { code: "UEL_WINNER", label: "UEL Winners" },
  { code: "UEL_GROUP", label: "UEL Group Stage" },
];

function SeasonSponsorsCard({
  leagueId,
  league,
  onSuccess,
}: {
  leagueId: string;
  league: LeagueInfo | null;
  onSuccess: () => void;
}) {
  const [allSponsors, setAllSponsors] = useState<{ id: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canPickSponsor, setCanPickSponsor] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBase, setCreateBase] = useState("5000000");
  const [createBonus, setCreateBonus] = useState("2500000");
  const [createObjective, setCreateObjective] = useState("POSITION_4");

  const fetchData = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const [allRes, leagueRes] = await Promise.all([
        fetch("/api/sponsors"),
        fetch(`/api/league/sponsors?leagueId=${leagueId}`),
      ]);
      const allData = await allRes.json();
      const leagueData = await leagueRes.json();
      setAllSponsors(allData.sponsors || []);
      setSelectedIds(leagueData.sponsorIds || []);
      setCanPickSponsor(leagueData.canPickSponsor !== false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leagueId) fetchData();
  }, [leagueId, league?.season]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", leagueId, sponsorIds: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Sponsors saved");
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          leagueId,
          name: createName.trim(),
          basePayment: parseInt(createBase, 10) || 0,
          bonusAmount: parseInt(createBonus, 10) || 0,
          objectiveCode: createObjective,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Sponsor created");
        setCreateName("");
        await fetchData();
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (league?.status !== "OFFSEASON") {
    return <p className="text-sm text-muted-foreground">League must be OFFSEASON</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Create custom sponsor</p>
        <Input
          placeholder="Sponsor name"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Base payment"
            value={createBase}
            onChange={(e) => setCreateBase(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Bonus amount"
            value={createBonus}
            onChange={(e) => setCreateBonus(e.target.value)}
          />
        </div>
        <Select value={createObjective} onValueChange={setCreateObjective}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPONSOR_OBJECTIVES.map((o) => (
              <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={actionLoading || !createName.trim()} onClick={handleCreate}>
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Sponsor"}
        </Button>
      </div>
      <Separator />
      <div className="space-y-2">
        {!canPickSponsor && (
          <p className="text-xs text-amber-500">
            Sponsors can only be changed in contract-start seasons (S2, S5, S7, S9). Current selection applies for the contract window.
          </p>
        )}
        <p className="text-xs text-muted-foreground">Select up to 3 sponsors ({selectedIds.length}/3)</p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {allSponsors.map((s) => (
            <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(s.id)}
                onChange={() => toggle(s.id)}
                disabled={!selectedIds.includes(s.id) && selectedIds.length >= 3}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
        <Button size="sm" onClick={handleSave} disabled={actionLoading || !canPickSponsor}>
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save 3 Sponsors"}
        </Button>
      </div>
    </div>
  );
}

function DraftPoolCard({
  leagueId,
  league,
  onSuccess,
}: {
  leagueId: string;
  league: LeagueInfo | null;
  onSuccess: () => void;
}) {
  const [poolIds, setPoolIds] = useState<string[]>([]);
  const [poolDetails, setPoolDetails] = useState<{ player_id: string; player_name?: string; rating?: number }[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ player_id: string; name: string; full_name: string | null; positions: string; overall_rating: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPool = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/league/draft-pool?leagueId=${leagueId}`);
      const json = await res.json();
      if (json.success) {
        setPoolIds(json.data || []);
        setPoolDetails(json.poolDetails || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leagueId) fetchPool();
  }, [leagueId, league?.season]);

  const handleSearch = async () => {
    if (!leagueId || !search.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/league/draft-pool?leagueId=${leagueId}&mode=search&search=${encodeURIComponent(search.trim())}`);
      const json = await res.json();
      if (json.success) setSearchResults(json.data || []);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddToPool = async (playerId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/draft-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", leagueId, playerIds: [playerId] }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Added to draft pool");
        await fetchPool();
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFromPool = async (playerId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/draft-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", leagueId, playerIds: [playerId] }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Removed from draft pool");
        await fetchPool();
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (league?.status !== "OFFSEASON" || (league?.season ?? 1) < 2) {
    return <p className="text-sm text-muted-foreground">League must be OFFSEASON, Season 2+</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search player name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={actionLoading}>
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>
      {searchResults.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">Add to pool:</p>
          {searchResults.map((p) => (
            <div key={p.player_id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span>{p.name || p.full_name || p.player_id} ({p.overall_rating})</span>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading || poolIds.includes(p.player_id)}
                onClick={() => handleAddToPool(p.player_id)}
              >
                {poolIds.includes(p.player_id) ? "In pool" : "Add"}
              </Button>
            </div>
          ))}
        </div>
      )}
      {poolDetails.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">Pool ({poolDetails.length} players)</p>
          {poolDetails.map((p) => (
            <div key={p.player_id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span>{p.player_name || p.player_id} ({p.rating ?? "?"})</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive hover:text-destructive"
                disabled={actionLoading}
                onClick={() => handleRemoveFromPool(p.player_id)}
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FreeAgencyPoolCard({
  leagueId,
  league,
  onSuccess,
}: {
  leagueId: string;
  league: LeagueInfo | null;
  onSuccess: () => void;
}) {
  const [poolIds, setPoolIds] = useState<string[]>([]);
  const [poolDetails, setPoolDetails] = useState<{ player_id: string; player_name?: string; rating?: number; deadline?: string | null }[]>([]);
  const [faPoolStatus, setFaPoolStatus] = useState<"draft" | "confirmed">("draft");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ player_id: string; name: string; full_name: string | null; positions: string; overall_rating: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [addModal, setAddModal] = useState<{ player_id: string; name: string } | null>(null);
  const [addDeadline, setAddDeadline] = useState("");

  const fetchPool = async () => {
    if (!leagueId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/league/fa-pool?leagueId=${leagueId}`);
      const json = await res.json();
      if (json.success) {
        setPoolIds(json.data || []);
        setPoolDetails(json.poolDetails || []);
        setFaPoolStatus(json.fa_pool_status ?? "draft");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leagueId) fetchPool();
  }, [leagueId, league?.season]);

  const handleSearch = async () => {
    if (!leagueId || !search.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/league/fa-pool?leagueId=${leagueId}&mode=search&search=${encodeURIComponent(search.trim())}`);
      const json = await res.json();
      if (json.success) setSearchResults(json.data || []);
    } finally {
      setActionLoading(false);
    }
  };

  const openAddModal = (p: { player_id: string; name: string; full_name: string | null }) => {
    setAddModal({ player_id: p.player_id, name: p.name || p.full_name || p.player_id });
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 2);
    setAddDeadline(defaultDate.toISOString().slice(0, 16));
  };

  const handleAddToPool = async () => {
    if (!addModal || !addDeadline) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/fa-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          leagueId,
          playerIds: [addModal.player_id],
          playerDeadlines: { [addModal.player_id]: new Date(addDeadline).toISOString() },
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Added ${addModal.name} to pool`);
        setAddModal(null);
        await fetchPool();
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFromPool = async (playerId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/fa-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", leagueId, playerIds: [playerId] }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Removed from pool");
        await fetchPool();
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPool = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/fa-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmPool", leagueId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pool confirmed – visible to managers");
        setFaPoolStatus("confirmed");
        await fetchPool();
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPool = async () => {
    if (!confirm("Reset pool to draft? Managers will no longer see it. You can add/remove players again.")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/league/fa-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPool", leagueId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pool reset to draft");
        setFaPoolStatus("draft");
        await fetchPool();
        onSuccess();
      } else {
        toast.error(json.error || "Failed");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const isDraft = faPoolStatus === "draft";

  if (league?.status !== "OFFSEASON") {
    return <p className="text-sm text-muted-foreground">League must be OFFSEASON</p>;
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {faPoolStatus === "confirmed" && (
        <p className="text-xs text-green-500 font-medium">Pool confirmed – visible to managers. Resolve Free Agency when bids are in.</p>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Search player name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
          disabled={!isDraft}
        />
        <Button onClick={handleSearch} disabled={actionLoading || !isDraft}>
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>
      {searchResults.length > 0 && isDraft && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">Add to pool (set deadline per player):</p>
          {searchResults.map((p) => (
            <div key={p.player_id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span>{p.name || p.full_name || p.player_id} ({p.overall_rating})</span>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading || poolIds.includes(p.player_id)}
                onClick={() => openAddModal(p)}
              >
                {poolIds.includes(p.player_id) ? "In pool" : "Add"}
              </Button>
            </div>
          ))}
        </div>
      )}
      {poolDetails.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">Pool ({poolDetails.length} players)</p>
          {poolDetails.map((p) => (
            <div key={p.player_id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span>{p.player_name || p.player_id} ({p.rating ?? "?"}){p.deadline ? ` · ${new Date(p.deadline).toLocaleString()}` : ""}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive hover:text-destructive"
                disabled={actionLoading || !isDraft}
                onClick={() => handleRemoveFromPool(p.player_id)}
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={actionLoading || poolDetails.length === 0 || !isDraft}
          onClick={handleConfirmPool}
        >
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Pool"}
        </Button>
        {!isDraft && (
          <Button size="sm" variant="outline" disabled={actionLoading} onClick={handleResetPool}>
            Reset to Draft
          </Button>
        )}
      </div>
      <Dialog open={!!addModal} onOpenChange={(open) => !open && setAddModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to pool</DialogTitle>
            <DialogDescription>Set bid deadline for {addModal?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Bid deadline</Label>
              <Input
                type="datetime-local"
                value={addDeadline}
                onChange={(e) => setAddDeadline(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModal(null)}>Cancel</Button>
            <Button onClick={handleAddToPool} disabled={actionLoading || !addDeadline}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PopulateInternationalCard({
  leagueId,
  league,
  onSuccess,
}: {
  leagueId: string;
  league: LeagueInfo | null;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  const handlePopulate = async () => {
    if (!leagueId || !league) return;
    setLoading(true);
    try {
      const res = await fetch("/api/league/populate-international", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, season: league.season }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Created ${json.matches_created ?? 0} international match(es). You can adjust teams on the Schedule page.`);
        onSuccess();
      } else {
        toast.error(json.error || "Failed to populate");
      }
    } catch (err) {
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!leagueId || !league) return;
    setClearLoading(true);
    try {
      const res = await fetch("/api/league/populate-international", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, season: league.season }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Cleared ${json.deleted ?? 0} international match(es).`);
        onSuccess();
      } else {
        toast.error(json.error || "Failed to clear");
      }
    } catch (err) {
      toast.error("Request failed");
    } finally {
      setClearLoading(false);
    }
  };

  return (
    <div className="pt-2 border-t border-neutral-800 space-y-2">
      <p className="text-xs text-muted-foreground">
        Auto-fill from current season domestic standings. Allocation scales with league size (14-team basis: UCL ~43%, UECL ~29%, UEL ~29%). Super Cup (UCL vs UEL winners from previous season) from S2. Host can edit groups on Schedule.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={loading}
          onClick={handlePopulate}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
          Populate International Schedule
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive"
          disabled={clearLoading}
          onClick={handleClear}
        >
          {clearLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
          Clear International
        </Button>
      </div>
    </div>
  );
}

function InsertResultCard({
  leagueId,
  league,
  teams,
  onInsert,
  actionLoading,
  onSuccess,
}: {
  leagueId: string;
  league: LeagueInfo | null;
  teams: TeamInfo[];
  onInsert: (action: string, params: Record<string, unknown>) => Promise<void>;
  actionLoading: string | null;
  onSuccess: () => void;
}) {
  const [scheduledMatches, setScheduledMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selMatchId, setSelMatchId] = useState<string>("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!leagueId || league?.status !== "IN_SEASON" || !league?.current_round) {
      setScheduledMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(
      `/api/league/game?leagueId=${leagueId}&type=schedule&season=${league.season}&round=${league.current_round}`
    )
      .then((r) => r.json())
      .then((json) => {
        const matches = (json.data || []).filter(
          (m: MatchRow) => m.match_status === "scheduled"
        );
        setScheduledMatches(matches);
        if (matches.length > 0 && !selMatchId) setSelMatchId(matches[0].id);
      })
      .finally(() => setLoading(false));
  }, [leagueId, league?.status, league?.season, league?.current_round, refreshKey]);

  const handleInsert = async () => {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;
    await onInsert("insert_result", {
      matchId: selMatchId,
      homeScore: h,
      awayScore: a,
    });
    setHomeScore("");
    setAwayScore("");
    setRefreshKey((k) => k + 1);
    onSuccess();
  };

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || "—";

  if (loading || league?.status !== "IN_SEASON") {
    return (
      <p className="text-sm text-muted-foreground">
        {league?.status !== "IN_SEASON"
          ? "League must be IN_SEASON"
          : "Loading matches..."}
      </p>
    );
  }

  if (scheduledMatches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No scheduled matches in round {league?.current_round}. Generate schedule first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Select value={selMatchId} onValueChange={setSelMatchId}>
        <SelectTrigger>
          <SelectValue placeholder="Select match" />
        </SelectTrigger>
        <SelectContent>
          {scheduledMatches.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {teamName(m.home_team_id)} vs {teamName(m.away_team_id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          min={0}
          placeholder="Home"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          className="w-20"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          min={0}
          placeholder="Away"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          className="w-20"
        />
        <Button
          onClick={handleInsert}
          disabled={actionLoading === "insert_result" || homeScore === "" || awayScore === ""}
        >
          {actionLoading === "insert_result" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Insert"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function HostControlsPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fineTeamId, setFineTeamId] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  const leagueId = selectedLeagueId;
  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);
  const isCommissioner = selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id;
  const [addPlayerTeamId, setAddPlayerTeamId] = useState<string | null>(null);
  const [hostTeamIds, setHostTeamIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("addPlayer");
      if (t) setAddPlayerTeamId(t);
    }
  }, []);

  useEffect(() => {
    if (leagueId) {
      fetchAll();
    }
  }, [leagueId, isCommissioner]);

  const fetchAll = async () => {
    setLoading(true);
    const promises = [fetchLeagueInfo(), fetchTeams(), fetchAuditLogs()];
    if (isCommissioner) promises.push(fetchHostTeams());
    await Promise.all(promises);
    setLoading(false);
  };

  const fetchHostTeams = async () => {
    if (!leagueId) return;
    const res = await fetch(`/api/league/host-teams?leagueId=${leagueId}`);
    const data = await res.json();
    if (data.success && data.data) {
      setHostTeamIds(new Set(data.data.map((ht: { team_id: string }) => ht.team_id)));
    }
  };

  const fetchLeagueInfo = async () => {
    const res = await fetch(`/api/league/game?leagueId=${leagueId}&type=league_info`);
    const data = await res.json();
    if (data.success) setLeague(data.data);
  };

  const fetchTeams = async () => {
    const res = await fetch(`/api/league/teams?leagueId=${leagueId}`);
    const data = await res.json();
    if (data.success || data.data) setTeams(data.data || []);
  };

  const fetchAuditLogs = async () => {
    const res = await fetch(`/api/league/game?leagueId=${leagueId}&type=audit_logs`);
    const data = await res.json();
    if (data.success) setAuditLogs(data.data || []);
  };

  const performAction = async (action: string, extraParams: any = {}) => {
    const loadingKey = action === 'simulate_matchday_competition' && extraParams.competitionType
      ? `simulate_matchday_competition_${extraParams.competitionType}`
      : action;
    setActionLoading(loadingKey);
    setMessage(null);
    try {
      const res = await fetch('/api/league/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, leagueId, ...extraParams }),
      });
      const data = await res.json();
      if (data.success) {
        let successMsg = '';
        if (action === 'validate_registration' && data.data) {
          if (data.data.valid) {
            successMsg = 'All teams pass registration (21-23 players, max 3 GKs)';
            setMessage({ type: 'success', text: successMsg });
          } else {
            const invalid = data.data.invalid_teams || [];
            const msg = invalid.map((t: { team_name: string; errors: string[] }) => `${t.team_name}: ${(t.errors || []).join(', ')}`).join('; ');
            setMessage({ type: 'error', text: `Registration invalid: ${msg}` });
            toast.error(`Registration invalid: ${msg}`);
          }
        } else if (action === 'resolve_free_agency' && data.data?.assigned !== undefined) {
          successMsg = `Assigned ${data.data.assigned} player(s) to winning teams`;
          setMessage({ type: 'success', text: successMsg });
        } else if (action === 'add_mock_teams' && data.data?.added !== undefined) {
          successMsg = `Added ${data.data.added} mock team(s)`;
          setMessage({ type: 'success', text: successMsg });
        } else if (action === 'generate_all_starter_squads' && data.data) {
          const { generated, total, results } = data.data;
          const failed = results?.filter((r: { success: boolean }) => !r.success) || [];
          if (total === 0) {
            successMsg = 'No empty teams to process';
          } else if (failed.length > 0) {
            const errMsg = failed[0]?.error || 'Unknown error';
            setMessage({ type: 'error', text: `Generated ${generated}/${total}. Error: ${errMsg}` });
            toast.error(`Generated ${generated}/${total}. Error: ${errMsg}`);
          } else {
            successMsg = `Generated starter squads for ${generated} team(s)`;
          }
          if (successMsg) setMessage({ type: 'success', text: successMsg });
        } else {
          successMsg = action === 'simulate_matchday' ? 'Matchday simulated'
            : action.startsWith('simulate_matchday_competition') ? 'Competition matchday simulated'
            : action === 'end_season' ? 'Season ended'
            : action === 'insert_result' ? 'Result inserted'
            : `${action.replace(/_/g, ' ')} completed`;
          setMessage({ type: 'success', text: successMsg });
        }
        if (successMsg) toast.success(successMsg);
        await fetchAll();
      } else {
        const errText = data.error || 'Action failed';
        setMessage({ type: 'error', text: errText });
        toast.error(errText);
      }
    } catch (err: any) {
      const errText = err.message || 'Request failed';
      setMessage({ type: 'error', text: errText });
      toast.error(errText);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApplyFine = () => {
    if (!fineTeamId || !fineAmount || !fineReason) {
      setMessage({ type: 'error', text: 'All fine fields are required' });
      return;
    }
    performAction('apply_fine', {
      teamId: fineTeamId,
      amount: parseInt(fineAmount),
      reason: fineReason,
    });
    setFineAmount("");
    setFineReason("");
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      PRESEASON_SETUP: 'bg-blue-600',
      IN_SEASON: 'bg-green-600',
      OFFSEASON: 'bg-yellow-600',
      SEASON_END_PROCESSING: 'bg-orange-600',
      ARCHIVED: 'bg-neutral-600',
    };
    return <Badge className={`${colors[status] || 'bg-neutral-600'} text-white`}>{status?.replace(/_/g, ' ') || 'Unknown'}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={8} />
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
            <p className="text-sm text-muted-foreground">Only the league commissioner can access host controls.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <Toaster position="top-center" richColors />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Host Controls</h2>
        <div className="flex items-center gap-4">
          <Link href="/main/dashboard/host-manual">
            <Button variant="outline">
              <BookOpen className="h-4 w-4 mr-2" /> Host Manual
            </Button>
          </Link>
          {league && <StatusBadge status={league.status} />}
        </div>
      </div>

      {/* Host Teams - Commissioner only */}
      {isCommissioner && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Host Teams</CardTitle>
            <CardDescription>Grant host rights to team owners. Toggle a team to give its owner host access.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => {
                const isHostTeam = hostTeamIds.has(t.id);
                return (
                  <Badge
                    key={t.id}
                    variant={isHostTeam ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={async () => {
                      try {
                        if (isHostTeam) {
                          await fetch(`/api/league/host-teams?leagueId=${leagueId}&teamId=${t.id}`, { method: "DELETE" });
                          setHostTeamIds((prev) => {
                            const next = new Set(prev);
                            next.delete(t.id);
                            return next;
                          });
                        } else {
                          await fetch("/api/league/host-teams", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ leagueId, teamId: t.id }),
                          });
                          setHostTeamIds((prev) => new Set([...prev, t.id]));
                        }
                        const msg = isHostTeam ? `Removed host rights from ${t.name}` : `Granted host rights to ${t.name}`;
                        setMessage({ type: "success", text: msg });
                        toast.success(msg);
                      } catch {
                        setMessage({ type: "error", text: "Failed to update host teams" });
                        toast.error("Failed to update host teams");
                      }
                    }}
                  >
                    {t.name} {isHostTeam && "(host)"}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-900/30 text-green-300 border border-green-800' : 'bg-red-900/30 text-red-300 border border-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* League Settings (In Season/Off Season, Transfer Window, Match Mode) */}
      {league && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Settings className="h-5 w-5" /> League Settings</CardTitle>
            <CardDescription>Phase, transfer window and match mode. Changes apply immediately.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">In Season</Label>
                <p className="text-xs text-muted-foreground">League phase. Off = Off Season (sponsors, FA, draft). On = In Season (matches).</p>
              </div>
              <Switch
                checked={league.status === "IN_SEASON"}
                disabled={settingsLoading}
                onCheckedChange={async (checked) => {
                  const newStatus = checked ? "IN_SEASON" : "OFFSEASON";
                  if (!confirm(`Switch league to ${newStatus.replace("_", " ")}? This affects sponsors, FA, trades, and match simulation.`)) return;
                  setSettingsLoading(true);
                  try {
                    const res = await fetch("/api/league/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ leagueId, status: newStatus }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setLeague((prev) => (prev ? { ...prev, status: newStatus } : null));
                      const msg = `League set to ${newStatus.replace("_", " ")}`;
                      setMessage({ type: "success", text: msg });
                      toast.success(msg);
                    } else {
                      const err = data.error || "Failed to update";
                      setMessage({ type: "error", text: err });
                      toast.error(err);
                    }
                  } catch (e: unknown) {
                    setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
                  } finally {
                    setSettingsLoading(false);
                  }
                }}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Transfer Window Open</Label>
                <p className="text-xs text-muted-foreground">When open (and In Season), managers can make roster moves (trades, signings, etc.)</p>
              </div>
              <Switch
                checked={league.transfer_window_open ?? true}
                disabled={settingsLoading}
                onCheckedChange={async (checked) => {
                  setSettingsLoading(true);
                  try {
                    const res = await fetch('/api/league/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ leagueId, transfer_window_open: checked })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setLeague(prev => prev ? { ...prev, transfer_window_open: checked } : null);
                      setMessage({ type: 'success', text: 'Transfer window updated' });
                      toast.success('Transfer window updated');
                    } else {
                      const err = data.error || 'Failed to update';
                      setMessage({ type: 'error', text: err });
                      toast.error(err);
                    }
                  } catch (e: any) {
                    setMessage({ type: 'error', text: e.message });
                  } finally {
                    setSettingsLoading(false);
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Match Mode</Label>
                <p className="text-xs text-muted-foreground">SIMULATED = app generates results. MANUAL = host inserts EAFC results.</p>
              </div>
              <Select
                value={league.match_mode ?? 'SIMULATED'}
                disabled={settingsLoading}
                onValueChange={async (value: 'SIMULATED' | 'MANUAL') => {
                  setSettingsLoading(true);
                  try {
                    const res = await fetch('/api/league/settings', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ leagueId, match_mode: value })
                    });
                    const data = await res.json();
                    if (data.success) {
                      setLeague(prev => prev ? { ...prev, match_mode: value } : null);
                      setMessage({ type: 'success', text: 'Match mode updated' });
                      toast.success('Match mode updated');
                    } else {
                      const err = data.error || 'Failed to update';
                      setMessage({ type: 'error', text: err });
                      toast.error(err);
                    }
                  } catch (e: any) {
                    setMessage({ type: 'error', text: e.message });
                  } finally {
                    setSettingsLoading(false);
                  }
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIMULATED">Simulated</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* League Info */}
      {league && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5" /> League Info</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{league.name}</span></div>
            <div><span className="text-muted-foreground">Season:</span> <span className="font-medium">{league.season}</span></div>
            <div><span className="text-muted-foreground">Round:</span> <span className="font-medium">{league.current_round} / {league.total_rounds || '?'}</span></div>
            <div><span className="text-muted-foreground">Invite Code:</span> <span className="font-mono font-bold text-blue-400">{league.invite_code || 'N/A'}</span></div>
            <div><span className="text-muted-foreground">Teams:</span> <span className="font-medium">{teams.length}</span></div>
          </CardContent>
        </Card>
      )}

      {/* Add Mock Teams */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Add Mock Teams</CardTitle>
          <CardDescription>Fill remaining league slots with AI-controlled mock teams (no user). Each gets an auto-generated starter squad.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => performAction('add_mock_teams')}
            disabled={actionLoading === 'add_mock_teams' || !!(league && teams.length >= (league.max_teams ?? 20))}
            variant="outline"
            className="w-full"
          >
            {actionLoading === 'add_mock_teams' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
            Add Mock Teams
          </Button>
          {league && teams.length >= (league.max_teams ?? 20) && (
            <p className="text-xs text-muted-foreground mt-2">League is full</p>
          )}
        </CardContent>
      </Card>

      {/* Starter Squad Backfill */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Generate Starter Squads</CardTitle>
          <CardDescription>Populate teams that have no players with real EAFC players. Use this if leagues were created before the update or if starter squads failed to generate.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => performAction('generate_all_starter_squads')}
            disabled={actionLoading === 'generate_all_starter_squads'}
            variant="outline"
            className="w-full"
          >
            {actionLoading === 'generate_all_starter_squads' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Generate / Top Up Starter Squads
          </Button>
        </CardContent>
      </Card>

      {/* Game Flow Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Schedule */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Schedule</CardTitle>
            <CardDescription>Generate round-robin or manually create fixtures. Full schedule management on its own page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/main/dashboard/schedule">
              <Button variant="outline" className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Manage Schedule
              </Button>
            </Link>
            {((league?.status === "OFFSEASON") || (league?.status === "IN_SEASON" && (league?.current_round ?? 0) > (league?.total_rounds ?? 0))) && (
              <PopulateInternationalCard leagueId={leagueId ?? ""} league={league} onSuccess={fetchAll} />
            )}
          </CardContent>
        </Card>

        {/* Simulate Matchday (SIMULATED mode only) */}
        {league?.match_mode !== 'MANUAL' && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Play className="h-4 w-4" /> Simulate Matchday</CardTitle>
            <CardDescription>Simulate domestic round or international matchdays separately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => performAction('simulate_matchday')}
              disabled={
                actionLoading === 'simulate_matchday' ||
                league?.status !== 'IN_SEASON' ||
                (league?.current_round ?? 0) > (league?.total_rounds ?? 0)
              }
              className="w-full bg-green-700 hover:bg-green-800"
            >
              {actionLoading === 'simulate_matchday' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Simulate Domestic Round {league?.current_round || '?'}
            </Button>
            {(league?.current_round ?? 0) > (league?.total_rounds ?? 0) && (
              <p className="text-xs text-muted-foreground">
                All domestic rounds finished. Populate international schedule (Schedule card above), verify groups on Manage Schedule, then simulate or insert international results. Run End Season when all competitions are done.
              </p>
            )}
            {league?.has_ucl_matches && (
              <Button
                variant="outline"
                onClick={() => performAction('simulate_matchday_competition', { competitionType: 'ucl' })}
                disabled={
                  actionLoading === 'simulate_matchday_competition_ucl' ||
                  league?.status !== 'IN_SEASON' ||
                  (league?.scheduled_ucl_this_round ?? 0) === 0
                }
                className="w-full"
              >
                {actionLoading === 'simulate_matchday_competition_ucl' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Simulate UCL Matchday {(league?.current_round_ucl ?? 0) || 1}
              </Button>
            )}
            {league?.has_uel_matches && (
              <Button
                variant="outline"
                onClick={() => performAction('simulate_matchday_competition', { competitionType: 'uel' })}
                disabled={
                  actionLoading === 'simulate_matchday_competition_uel' ||
                  league?.status !== 'IN_SEASON' ||
                  (league?.scheduled_uel_this_round ?? 0) === 0
                }
                className="w-full"
              >
                {actionLoading === 'simulate_matchday_competition_uel' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Simulate UEL Matchday {(league?.current_round_uel ?? 0) || 1}
              </Button>
            )}
            {league?.has_uecl_matches && (
              <Button
                variant="outline"
                onClick={() => performAction('simulate_matchday_competition', { competitionType: 'uecl' })}
                disabled={
                  actionLoading === 'simulate_matchday_competition_uecl' ||
                  league?.status !== 'IN_SEASON' ||
                  (league?.scheduled_uecl_this_round ?? 0) === 0
                }
                className="w-full"
              >
                {actionLoading === 'simulate_matchday_competition_uecl' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Simulate UECL Matchday {(league?.current_round_uecl ?? 0) || 1}
              </Button>
            )}
            {league?.has_supercup_matches && (
              <Button
                variant="outline"
                onClick={() => performAction('simulate_matchday_competition', { competitionType: 'supercup' })}
                disabled={
                  actionLoading === 'simulate_matchday_competition_supercup' ||
                  league?.status !== 'IN_SEASON' ||
                  (league?.scheduled_supercup_this_round ?? 0) === 0
                }
                className="w-full"
              >
                {actionLoading === 'simulate_matchday_competition_supercup' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Simulate Super Cup
              </Button>
            )}
            {league?.status !== 'IN_SEASON' && <p className="text-xs text-muted-foreground">League must be IN_SEASON</p>}
          </CardContent>
        </Card>
        )}

        {/* EAFC Setup (MANUAL mode only) */}
        {league?.match_mode === 'MANUAL' && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> EAFC Setup</CardTitle>
            <CardDescription>View all teams&apos; squads, formations, and EAFC tactic codes. Edit players if needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/main/dashboard/eafc-setup">
              <Button variant="outline" className="w-full">
                Open EAFC Setup
              </Button>
            </Link>
          </CardContent>
        </Card>
        )}

        {/* Insert Result (MANUAL mode only) */}
        {league?.match_mode === 'MANUAL' && leagueId && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Play className="h-4 w-4" /> Insert Result</CardTitle>
            <CardDescription>Manually enter match results. Insert one match at a time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/main/dashboard/insert-results">
              <Button variant="default" className="w-full">
                Open Match Results
              </Button>
            </Link>
            <InsertResultCard
              leagueId={leagueId}
              league={league}
              teams={teams}
              onInsert={performAction}
              actionLoading={actionLoading}
              onSuccess={fetchAll}
            />
          </CardContent>
        </Card>
        )}

        {/* End Season */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><StopCircle className="h-4 w-4" /> End Season</CardTitle>
            <CardDescription>Process end-of-season: prizes, wages, contract expiry, next season.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => {
                if (confirm('Are you sure you want to end the season? This cannot be undone.')) {
                  performAction('end_season');
                }
              }}
              disabled={actionLoading === 'end_season' || (league?.unsimulated_match_count ?? 0) > 0}
              variant="destructive"
              className="w-full"
            >
              {actionLoading === 'end_season' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <StopCircle className="h-4 w-4 mr-2" />}
              End Season
            </Button>
            {(league?.unsimulated_match_count ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                All matches must have results before ending the season. {league?.unsimulated_match_count} match(es) still scheduled.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Generate Injuries */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Random Injuries</CardTitle>
            <CardDescription>Generate random injuries for players across the league.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => performAction('generate_injuries', { count: 3 })}
              disabled={actionLoading === 'generate_injuries'}
              variant="outline"
              className="w-full"
            >
              {actionLoading === 'generate_injuries' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Generate 3 Random Injuries
            </Button>
          </CardContent>
        </Card>

        {/* Free Agency Pool & Deadline (OFFSEASON only) */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Gavel className="h-4 w-4" /> Free Agency Pool</CardTitle>
            <CardDescription>Select players for the FA pool this season. Set bid deadline. When pool has players, only those can be bid on.</CardDescription>
          </CardHeader>
          <CardContent>
            <FreeAgencyPoolCard leagueId={leagueId ?? ""} league={league} onSuccess={fetchAll} />
          </CardContent>
        </Card>

        {/* Resolve Free Agency (OFFSEASON only) */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Gavel className="h-4 w-4" /> Resolve Free Agency</CardTitle>
            <CardDescription>Process sealed bids and assign free agents to winning teams. Run after managers have placed bids.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => performAction('resolve_free_agency')}
              disabled={actionLoading === 'resolve_free_agency' || league?.status !== 'OFFSEASON'}
              variant="outline"
              className="w-full"
            >
              {actionLoading === 'resolve_free_agency' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gavel className="h-4 w-4 mr-2" />}
              Resolve Free Agency
            </Button>
            {league?.status !== 'OFFSEASON' && (
              <p className="text-xs text-muted-foreground mt-2">League must be OFFSEASON</p>
            )}
          </CardContent>
        </Card>

        {/* Season Setup: Pick 3 Sponsors (OFFSEASON) */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Pick 3 Sponsors</CardTitle>
            <CardDescription>Select 3 sponsors for this season. Teams will choose from these when signing.</CardDescription>
          </CardHeader>
          <CardContent>
            <SeasonSponsorsCard leagueId={leagueId ?? ""} league={league} onSuccess={fetchAll} />
          </CardContent>
        </Card>

        {/* Draft Pool (Season 2+, OFFSEASON only) */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Draft Pool</CardTitle>
            <CardDescription>Select players for the draft pool this season. When pool has players, only those can be drafted.</CardDescription>
          </CardHeader>
          <CardContent>
            <DraftPoolCard leagueId={leagueId ?? ""} league={league} onSuccess={fetchAll} />
          </CardContent>
        </Card>

        {/* Start Draft (Season 2+, OFFSEASON only) */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Start Draft</CardTitle>
            <CardDescription>Begin the draft for this season. Season 2+ only. Order = inverse of prior standings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => performAction('start_draft')}
              disabled={actionLoading === 'start_draft' || league?.status !== 'OFFSEASON' || (league?.season ?? 1) < 2}
              variant="outline"
              className="w-full"
            >
              {actionLoading === 'start_draft' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
              Start Draft
            </Button>
            {(league?.status !== 'OFFSEASON' || (league?.season ?? 1) < 2) && (
              <p className="text-xs text-muted-foreground mt-2">
                {league?.status !== 'OFFSEASON' ? 'League must be OFFSEASON' : 'Draft is Season 2+ only'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Player to Team */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus2 className="h-4 w-4" /> Add Player to Team</CardTitle>
          <CardDescription>Add a custom player or assign a free agent to a team. Host only.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={`/main/dashboard/add-player${selectedLeagueId ? `?league=${selectedLeagueId}` : ''}`}>
            <Button variant="outline" className="w-full">
              <UserPlus2 className="h-4 w-4 mr-2" />
              Add Player
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Apply Fine */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Apply Fine</CardTitle>
          <CardDescription>Deduct money from a team's budget with a reason.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Select value={fineTeamId} onValueChange={setFineTeamId}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Amount"
            value={fineAmount}
            onChange={e => setFineAmount(e.target.value)}
            className="md:w-32"
          />
          <Input
            placeholder="Reason"
            value={fineReason}
            onChange={e => setFineReason(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleApplyFine}
            disabled={actionLoading === 'apply_fine'}
            variant="destructive"
          >
            {actionLoading === 'apply_fine' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4 mr-2" />}
            Fine
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Audit Logs */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" /> Audit Logs</CardTitle>
          <CardDescription>Recent actions and events in this league.</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit logs yet.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded bg-neutral-800/50 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">{log.action}</Badge>
                  <div className="flex-1 min-w-0">
                    <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
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
