import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isLeagueHost } from "@/lib/hostUtils";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    const teamId = searchParams.get("teamId");
    if (!leagueId) {
      return NextResponse.json({ error: "League ID required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    let query = serviceSupabase
      .from("teams")
      .select("id, name, acronym, formation, eafc_tactic_code, eafc_comment, starting_lineup, bench, reserves")
      .eq("league_id", leagueId)
      .order("name");
    if (teamId) {
      query = query.eq("id", teamId);
    }
    const { data: teams, error: teamsError } = await query;

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 });
    }

    const teamsWithSquads = await Promise.all(
      (teams || []).map(async (team) => {
        const { data: players, error: playersError } = await serviceSupabase
          .from("league_players")
          .select("id, player_id, player_name, full_name, positions, rating, image, potential, is_youngster")
          .eq("team_id", team.id)
          .order("rating", { ascending: false });

        if (playersError) {
          return { ...team, squad: [], error: playersError.message };
        }

        const startingIds = (team.starting_lineup as string[] || []).filter(Boolean);
        const benchIds = (team.bench as string[] || []).filter(Boolean);
        const reservesIds = (team.reserves as string[] || []).filter(Boolean);

        const squad = (players || []).map((p) => ({
          ...p,
          role: startingIds.includes(p.player_id) ? "starting" : benchIds.includes(p.player_id) ? "bench" : reservesIds.includes(p.player_id) ? "reserves" : "squad",
        }));

        return {
          ...team,
          squad,
        };
      })
    );

    return NextResponse.json({ success: true, data: teamsWithSquads });
  } catch (err: unknown) {
    console.error("Host squads API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
