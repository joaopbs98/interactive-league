"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useLeague } from "@/contexts/LeagueContext";
import { Loader2, Shield } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const { selectedLeagueId, selectedTeam } = useLeague();

  const isHost =
    selectedTeam?.leagues?.is_host ?? (selectedTeam?.leagues?.commissioner_user_id === selectedTeam?.user_id);

  useEffect(() => {
    if (selectedLeagueId && selectedTeam && isHost) {
      router.replace("/main/dashboard/host-controls");
    }
  }, [selectedLeagueId, selectedTeam, isHost, router]);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Admin Tools</h2>
      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-8 text-center">
          {!selectedLeagueId || !selectedTeam ? (
            <>
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mt-4">Loading...</p>
            </>
          ) : !isHost ? (
            <>
              <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Host only</p>
              <p className="text-sm text-muted-foreground">
                Only the league commissioner can access admin tools.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Redirecting to Host Controls...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
