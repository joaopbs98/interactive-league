"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

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
    setMessage(null);
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
        setMessage({ type: "success", text: "Updated" });
        fetchStadium();
      } else {
        setMessage({ type: "error", text: json.error });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedTeam?.id) {
    return (
      <div className="p-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-8 text-center text-muted-foreground">
            Select a team to view stadium.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" /> Stadium
        </h2>
      </div>

      {message && (
        <div
          className={`p-3 rounded text-sm ${
            message.type === "success"
              ? "bg-green-900/30 text-green-300 border border-green-800"
              : "bg-red-900/30 text-red-300 border border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {data && (
        <div className="grid gap-4">
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle>{data.name}</CardTitle>
              <CardDescription>
                Capacity, visitor focus, and attendance. Matchday revenue delayed by 1 year.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Capacity</span>
                  <p className="font-medium">{data.capacity?.toLocaleString() ?? 40000}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Attendance</span>
                  <p className="font-medium">{data.attendance?.toLocaleString() ?? 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Revenue</span>
                  <p className="font-medium">{data.revenue ? `$${(data.revenue / 1e6).toFixed(1)}M` : "$0"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Games Played</span>
                  <p className="font-medium">{data.totalGamesPlayed ?? 0}</p>
                </div>
              </div>

              {isHost && (
                <div className="space-y-4 pt-4 border-t border-neutral-800">
                  <div>
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
                      <p className="text-xs text-muted-foreground mt-1">Locked (confirmed)</p>
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
                  <div>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
