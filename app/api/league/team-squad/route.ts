import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/league/team-squad?leagueId=X&teamId=Y
 * Returns squad of a team in the league. User must have a team in the same league.
 * Used for trade proposals - selecting players to request from another team.
 */
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

    if (!leagueId || !teamId) {
      return NextResponse.json({ error: "leagueId and teamId required" }, { status: 400 });
    }

    // Verify user has a team in this league
    const { data: userTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!userTeam) {
      return NextResponse.json({ error: "You must be in this league to view team squads" }, { status: 403 });
    }

    // Verify target team is in the same league
    const { data: targetTeam } = await supabase
      .from("teams")
      .select("id, league_id")
      .eq("id", teamId)
      .eq("league_id", leagueId)
      .single();

    if (!targetTeam) {
      return NextResponse.json({ error: "Team not found in this league" }, { status: 404 });
    }

    const { data: players, error } = await supabase
      .from("league_players")
      .select("player_id, player_name, full_name, positions, rating")
      .eq("team_id", teamId)
      .order("rating", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const squad = (players || []).map((p) => {
      const pos = p.positions;
      const posStr = Array.isArray(pos) ? pos[0] : (typeof pos === "string" ? pos.split(",")[0]?.trim() : "") || "";
      return {
        id: p.player_id,
        name: p.full_name || p.player_name || p.player_id,
        position: posStr,
        rating: p.rating,
        image: "",
      };
    });

    return NextResponse.json({ success: true, squad });
  } catch (err: unknown) {
    console.error("Team squad API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
