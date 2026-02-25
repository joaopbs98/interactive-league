"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, User, Trophy, Users, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "sonner";

type Profile = {
  id: string;
  user_id?: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const { selectedLeagueId, selectedTeam, clearSelection } = useLeague();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const userId = profile?.user_id ?? profile?.id;
  const isHost = selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === userId);
  const isTeamOwner = selectedTeam?.user_id === userId;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json();
        if (data.success && data.profile) {
          setProfile(data.profile);
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleLeaveLeague = async () => {
    if (!selectedTeam?.id || !confirm("Are you sure you want to leave this league? You will no longer manage this team.")) return;
    setLeaveLoading(true);
    try {
      const res = await fetch("/api/league/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeam.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Left league");
        clearSelection();
        router.push("/saves");
      } else {
        toast.error(data.error ?? "Failed to leave league");
      }
    } catch {
      toast.error("Failed to leave league");
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!selectedLeagueId || !confirm("Are you sure you want to DELETE this league? This will remove ALL teams, matches, and data. This cannot be undone.")) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/league/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeagueId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("League deleted");
        clearSelection();
        router.push("/saves");
      } else {
        toast.error(data.error ?? "Failed to delete league");
      }
    } catch {
      toast.error("Failed to delete league");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <Toaster position="top-center" richColors />
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* User profile */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">
                {(profile?.full_name || profile?.username || "U")[0].toUpperCase()}
              </span>
            )}
          </Avatar>
          <div className="space-y-1">
            <p className="font-medium text-lg">
              {profile?.full_name || profile?.username || "User"}
            </p>
            <p className="text-sm text-muted-foreground">@{profile?.username || "user"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Selected league & team */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Selected League & Team
          </CardTitle>
          <CardDescription>Your current league and team selection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {selectedLeagueId && selectedTeam ? (
            <>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedTeam.leagues?.name || "League"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Team:</span>
                <span className="font-medium">{selectedTeam.name}</span>
                <span className="text-muted-foreground text-sm">({selectedTeam.acronym})</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Change your selection from the Saves page.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              No league or team selected. Select a league from the Saves page to continue.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Leave League - for team owners (non-host or host) */}
      {selectedLeagueId && selectedTeam && isTeamOwner && (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Leave League
            </CardTitle>
            <CardDescription>Remove yourself from this team. The team will become unmanaged. If you are the last manager, the league will be deleted.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleLeaveLeague} disabled={leaveLoading}>
              {leaveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave League
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete League - host only */}
      {selectedLeagueId && selectedTeam && isHost && (
        <Card className="bg-neutral-900 border-neutral-800 border-red-900/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5" />
              Delete League
            </CardTitle>
            <CardDescription>Permanently delete this league and all associated data (teams, matches, players). This cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDeleteLeague} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete League
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
