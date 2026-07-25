"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { useLeague } from "@/contexts/LeagueContext";
import { Building2, Users, DollarSign, Trophy, Settings } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster, toast } from "sonner";
import { VISITOR_FOCUS_OPTIONS, SEASONAL_PERFORMANCE_OPTIONS } from "@/lib/stadiumLogic";

type StadiumData = {
  id: string;
  name: string;
  capacity: number;
  visitor_focus: string;
  confirm_vf: boolean;
  seasonal_performance: string;
  sc_appearance: boolean;
  attendance: number;
  revenue: number;
  totalGamesPlayed: number;
};

export default function StadiumPage() {
  const { selectedLeagueId, selectedTeam } = useLeague();
  const [data, setData] = useState<StadiumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);
  const isOwner = !!selectedTeam?.id; // User viewing their own team

  useEffect(() => {
    if (selectedLeagueId && selectedTeam?.id) fetchStadium();
  }, [selectedLeagueId, selectedTeam?.id]);

  const fetchStadium = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stadium?leagueId=${selectedLeagueId}&teamId=${selectedTeam?.id}`
      );
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates: Record<string, unknown>) => {
    if (!selectedLeagueId || !selectedTeam?.id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/stadium", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          teamId: selectedTeam.id,
          ...updates,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Stadium updated");
        fetchStadium();
      } else {
        toast.error(json.error ?? "Failed to update stadium");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update stadium");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="cards" rows={4} />
      </div>
    );
  }

  if (!selectedTeam?.id) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-muted-foreground">
          Select a team to view stadium.
        </div>
      </div>
    );
  }

  const capacity = data?.capacity ?? 40000;
  const attendance = data?.attendance ?? 0;
  const occupancyPct = capacity > 0 ? Math.min(100, (attendance / capacity) * 100) : 0;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader eyebrow="Bank & Balance" title={data?.name || "Stadium"} />

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Capacity", value: capacity.toLocaleString(), icon: Building2 },
              { label: "Attendance", value: attendance.toLocaleString(), icon: Users },
              { label: "Revenue", value: data.revenue ? `$${(data.revenue / 1e6).toFixed(1)}M` : "$0", icon: DollarSign },
              { label: "Games Played", value: String(data.totalGamesPlayed ?? 0), icon: Trophy },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-border bg-surface p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{label}</p>
                  <p className="text-lg font-bold tabular-nums">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Occupancy
              </h2>
              <span className="text-[10px] text-faint-foreground uppercase tracking-wider ml-auto">
                {occupancyPct.toFixed(0)}% of capacity
              </span>
            </div>
            <div className="p-5">
              <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${occupancyPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Matchday revenue is delayed by 1 year.
              </p>
            </div>
          </section>

          {(isOwner || isHost) && (
            <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Settings
                </h2>
              </div>
              <div className="p-5 space-y-6">
                {isOwner && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Owner</p>
                    <div className="space-y-2">
                      <Label>Visitor Focus</Label>
                      <Select
                        value={data.visitor_focus || ""}
                        onValueChange={(v) => handleUpdate({ visitor_focus: v })}
                        disabled={saving || data.confirm_vf}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {VISITOR_FOCUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {data.confirm_vf && (
                        <p className="text-xs text-muted-foreground">Locked (confirmed)</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="confirm_vf"
                        checked={data.confirm_vf}
                        onCheckedChange={(c) => handleUpdate({ confirm_vf: !!c })}
                        disabled={saving}
                      />
                      <Label htmlFor="confirm_vf">Confirm V.F.</Label>
                    </div>
                  </div>
                )}
                {isHost && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Host</p>
                    <div className="space-y-2">
                      <Label>Seasonal Performance</Label>
                      <Select
                        value={data.seasonal_performance || ""}
                        onValueChange={(v) => handleUpdate({ seasonal_performance: v })}
                        disabled={saving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SEASONAL_PERFORMANCE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="sc_appearance"
                        checked={data.sc_appearance}
                        onCheckedChange={(c) => handleUpdate({ sc_appearance: !!c })}
                        disabled={saving}
                      />
                      <Label htmlFor="sc_appearance">SC Appearance</Label>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
