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
    const leaguePlayerId = searchParams.get("leaguePlayerId");
    const leagueId = searchParams.get("leagueId");
    if (!leaguePlayerId || !leagueId) {
      return NextResponse.json({ error: "leaguePlayerId and leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    const { data: lp, error } = await serviceSupabase
      .from("league_players")
      .select("id, player_id, player_name, full_name, team_id, league_id, rating, positions, potential, is_youngster, is_veteran, base_rating, acceleration, sprint_speed, agility, reactions, balance, shot_power, jumping, stamina, strength, long_shots, aggression, interceptions, positioning, vision, penalties, composure, crossing, finishing, heading_accuracy, short_passing, volleys, dribbling, curve, fk_accuracy, long_passing, ball_control, defensive_awareness, standing_tackle, sliding_tackle, gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes")
      .eq("id", leaguePlayerId)
      .eq("league_id", leagueId)
      .single();

    if (error || !lp) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Fetch international_reputation from player table (for edit form)
    let international_reputation: string | null = null;
    if (lp.player_id) {
      const { data: p } = await serviceSupabase
        .from("player")
        .select("international_reputation")
        .eq("player_id", lp.player_id)
        .single();
      international_reputation = p?.international_reputation ?? null;
    }

    return NextResponse.json({
      success: true,
      data: { ...lp, international_reputation },
    });
  } catch (err: unknown) {
    console.error("Host league player GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
