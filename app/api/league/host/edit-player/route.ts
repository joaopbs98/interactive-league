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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, leaguePlayerId, rating, positions, potential, is_youngster, stats } = body;

    if (!leagueId || !leaguePlayerId) {
      return NextResponse.json({ error: "leagueId and leaguePlayerId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    const { data: existing, error: fetchError } = await serviceSupabase
      .from("league_players")
      .select("id, league_id, player_id, player_name, rating, positions, potential, is_youngster")
      .eq("id", leaguePlayerId)
      .eq("league_id", leagueId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const statColumns = ["acceleration", "sprint_speed", "agility", "reactions", "balance", "shot_power", "jumping", "stamina", "strength", "long_shots", "aggression", "interceptions", "positioning", "vision", "penalties", "composure", "crossing", "finishing", "heading_accuracy", "short_passing", "volleys", "dribbling", "curve", "fk_accuracy", "long_passing", "ball_control", "defensive_awareness", "standing_tackle", "sliding_tackle", "gk_diving", "gk_handling", "gk_kicking", "gk_positioning", "gk_reflexes"] as const;

    const updates: Record<string, unknown> = {};
    if (typeof rating === "number" && rating >= 40 && rating <= 99) {
      updates.rating = rating;
    }
    if (typeof positions === "string" && positions.trim()) {
      updates.positions = positions.trim();
    }
    if (typeof potential === "number" && potential >= 40 && potential <= 99) {
      updates.potential = potential;
    } else if (potential === null || potential === "") {
      updates.potential = null;
    }
    if (typeof is_youngster === "boolean") {
      updates.is_youngster = is_youngster;
    }
    if (stats && typeof stats === "object") {
      for (const key of statColumns) {
        const v = (stats as Record<string, unknown>)[key];
        if (v === null || v === "") {
          updates[key] = null;
        } else if (typeof v === "number" && v >= 1 && v <= 99) {
          updates[key] = v;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates (rating, positions, potential 40-99, is_youngster, or stats)" }, { status: 400 });
    }

    const { error: updateError } = await serviceSupabase
      .from("league_players")
      .update(updates)
      .eq("id", leaguePlayerId)
      .eq("league_id", leagueId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await serviceSupabase.rpc("write_audit_log", {
      p_league_id: leagueId,
      p_action: "host_edit_player",
      p_actor_id: user.id,
      p_payload: {
        league_player_id: leaguePlayerId,
        player_id: existing.player_id,
        player_name: existing.player_name,
        before: { rating: existing.rating, positions: existing.positions, potential: existing.potential, is_youngster: existing.is_youngster },
        after: { ...existing, ...updates },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Host edit player API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
