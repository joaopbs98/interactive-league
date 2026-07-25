"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLeague } from "@/contexts/LeagueContext";
import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy, ArrowRight, LogOut, RefreshCw, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast, Toaster } from "sonner";

interface League {
  id: string;
  name: string;
  season: number;
  status?: string;
  team_count: number;
  max_teams?: number;
  commissioner_user_id: string;
  is_commissioner?: boolean;
  created_at: string;
  updated_at?: string;
  my_team?: {
    id: string;
    name: string;
    acronym: string;
    logo_url?: string;
  };
}

const STATUS_STYLES: Record<string, string> = {
  IN_SEASON: "bg-status-positive/15 text-status-positive border-status-positive/30",
  OFFSEASON: "bg-status-warning/15 text-status-warning border-status-warning/30",
  PRESEASON_SETUP: "bg-accent-muted text-accent border-accent/30",
  SEASON_END_PROCESSING: "bg-surface-3 text-muted-foreground border-border-strong",
};

const SavesPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSelectedLeague } = useLeague();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const fetchUserLeagues = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/user/leagues");

      if (response.ok) {
        const data = await response.json();
        setLeagues(data.leagues || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch leagues");
      }
    } catch (error: any) {
      console.error("Error fetching user leagues:", error);
      setError("An error occurred while fetching leagues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserLeagues();
  }, []);

  useEffect(() => {
    const created = searchParams.get("created");
    if (created === "true") {
      fetchUserLeagues();
      router.replace("/saves");
    }
  }, [searchParams, router]);

  const handleSelectLeague = (leagueId: string) => {
    setSelectedLeague(leagueId);
    router.push(`/main/dashboard?league=${leagueId}`);
  };

  const handleCreateLeague = () => {
    if (leagues.length >= 2) {
      toast.error("You can only be in a maximum of 2 leagues at a time.");
      return;
    }
    router.push("/createleague");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-border-strong border-t-accent mx-auto"></div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Loading saves...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full border border-border bg-surface rounded-lg p-6 panel-in">
          <div className="text-status-negative text-lg mb-4 font-bold uppercase tracking-wide">Error</div>
          <p className="text-foreground/80 mb-4">{error}</p>

          <div className="space-y-2">
            <Button onClick={() => fetchUserLeagues()} className="w-full">
              Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors />
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <Button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
              }}
              variant="outline"
              size="sm"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>

            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Career Hub</p>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-foreground">
                Your Leagues
              </h1>
            </div>

            <Button
              onClick={fetchUserLeagues}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-3">
            Select a save to continue your career, or start a new one
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {leagues.length === 0 && (
          <div className="text-center mb-10 border border-dashed border-border rounded-lg py-10 px-6 panel-in">
            <Shield className="h-8 w-8 text-faint-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">No active saves yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first league to kick off your career
            </p>
          </div>
        )}

        {/* League Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {leagues.map((league, idx) => {
            const statusKey = (league.status || "").toUpperCase();
            const statusStyle =
              STATUS_STYLES[statusKey] || "bg-surface-3 text-muted-foreground border-border-strong";
            const maxTeams = league.max_teams || 20;
            const isCommissioner = !!league.is_commissioner;

            return (
              <button
                key={league.id}
                onClick={() => handleSelectLeague(league.id)}
                style={{ animationDelay: `${idx * 40}ms` }}
                className="group panel-in relative text-left rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
              >
                <div className="p-5 flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                      Competition
                    </p>
                    <h2 className="font-display text-2xl text-foreground leading-tight truncate">{league.name}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Season {league.season}
                    </p>
                  </div>
                  {league.status && (
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border",
                        statusStyle
                      )}
                    >
                      {statusKey.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                {league.my_team && (
                  <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
                    <div className="h-11 w-11 rounded-full bg-surface-3 border border-border flex items-center justify-center overflow-hidden shrink-0">
                      {league.my_team.logo_url ? (
                        <img
                          src={league.my_team.logo_url}
                          alt={`${league.my_team.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-foreground">
                          {league.my_team.acronym}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground leading-tight truncate">{league.my_team.name}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {league.my_team.acronym}
                      </p>
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center justify-between text-sm px-5 py-3 border-t border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="tabular-nums">
                      {league.team_count}/{maxTeams} teams
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span>{isCommissioner ? "Commissioner" : "Member"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {leagues.length < 2 ? (
            <button
              onClick={handleCreateLeague}
              className="group flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface hover:bg-surface-2 hover:border-border-strong transition-colors duration-150 py-8 px-6"
            >
              <div className="h-10 w-10 rounded-full bg-accent-muted border border-accent/30 flex items-center justify-center">
                <Plus className="h-5 w-5 text-accent" />
              </div>
              <span className="font-semibold uppercase tracking-wide text-sm text-foreground">Create New League</span>
              <span className="text-xs text-muted-foreground">Start a fresh competition</span>
            </button>
          ) : (
            <div className="rounded-lg border border-border bg-surface py-8 px-6 text-center">
              <p className="text-foreground font-medium">Maximum of 2 leagues reached</p>
              <p className="text-sm text-muted-foreground mt-1">Leave a league to create a new one</p>
            </div>
          )}

          {leagues.length < 2 && (
            <Link
              href="/joinleague"
              className="group flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface hover:bg-surface-2 hover:border-border-strong transition-colors duration-150 py-8 px-6"
            >
              <div className="h-10 w-10 rounded-full bg-surface-3 border border-border flex items-center justify-center">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="font-semibold uppercase tracking-wide text-sm text-foreground">Join Existing League</span>
              <span className="text-xs text-muted-foreground">Enter an invite code</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavesPage;
