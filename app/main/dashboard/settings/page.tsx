"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, User, Trophy, Users, LogOut, Trash2 } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { toast, Toaster } from "sonner";

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
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
    if (!selectedTeam?.id) return;
    setLeaveDialogOpen(false);
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
    if (!selectedLeagueId) return;
    setDeleteDialogOpen(false);
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
      <div className="p-8">
        <PageSkeleton variant="page" rows={6} />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px] mx-auto">
      <Toaster position="top-center" richColors />
      <Breadcrumbs />
      <PageHeader eyebrow="Account" title="Settings" />

      {/* User profile */}
      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Profile</h2>
        </div>
        <div className="p-5 flex items-center gap-4">
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
        </div>
      </section>

      {/* Selected league & team */}
      <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Selected League & Team</h2>
        </div>
        <div className="p-5 space-y-1">
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
        </div>
      </section>

      {/* Leave League - for team owners (non-host or host) */}
      {selectedLeagueId && selectedTeam && isTeamOwner && (
        <section className="panel-in rounded-lg border border-border bg-surface overflow-hidden" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2">
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Leave League</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Remove yourself from this team. The team will become unmanaged. If you are the last manager, the league will be deleted.
            </p>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(true)} disabled={leaveLoading}>
              {leaveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave League
            </Button>
          </div>
        </section>
      )}

      {/* Delete League - host only */}
      {selectedLeagueId && selectedTeam && isHost && (
        <section className="panel-in rounded-lg border border-status-negative/30 bg-status-negative/5 overflow-hidden" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-status-negative/30 bg-status-negative/10">
            <Trash2 className="h-4 w-4 text-status-negative" />
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-status-negative">Delete League</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete this league and all associated data (teams, matches, players). This cannot be undone.
            </p>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete League
            </Button>
          </div>
        </section>
      )}

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this league?</DialogTitle>
            <DialogDescription>
              You will no longer manage this team. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleLeaveLeague} disabled={leaveLoading}>
              {leaveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Leave League
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this league?</DialogTitle>
            <DialogDescription>
              This will remove ALL teams, matches, and data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteLeague} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete League
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
