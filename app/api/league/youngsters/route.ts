import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getYoungsterUpgrade } from "@/lib/youngsterLogic";
import { isLeagueHost } from "@/lib/hostUtils";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, updates } = body;

    if (!leagueId || !Array.isArray(updates)) {
      return NextResponse.json({ error: "leagueId and updates array required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }
    const results: { playerId: string; delta: number; newRating: number; error?: string }[] = [];

    for (const u of updates) {
      const { playerId, gamesPlayed, adjAvg } = u;
      if (!playerId) {
        results.push({ playerId: "?", delta: 0, newRating: 0, error: "Missing playerId" });
        continue;
      }

      const { data: lp } = await serviceSupabase
        .from("league_players")
        .select("id, rating, base_rating")
        .eq("league_id", leagueId)
        .eq("player_id", playerId)
        .not("team_id", "is", null)
        .single();

      if (!lp) {
        results.push({ playerId, delta: 0, newRating: 0, error: "Player not on team" });
        continue;
      }

      const rating = lp.base_rating ?? lp.rating ?? 60;
      const games = Number(gamesPlayed) || 0;
      const avg = Number(adjAvg) || 0;

      const delta = getYoungsterUpgrade(rating, games, avg);

      const { data: rpcData, error } = await serviceSupabase.rpc("apply_youngster_rating_delta", {
        p_league_id: leagueId,
        p_player_id: playerId,
        p_delta: delta,
        p_games_played: games,
        p_adj_avg: avg,
        p_actor_user_id: user.id,
      });

      if (error) {
        results.push({ playerId, delta: 0, newRating: rating, error: error.message });
        continue;
      }

      const r = rpcData as { success: boolean; new_rating?: number };
      results.push({
        playerId,
        delta,
        newRating: r.new_rating ?? rating + delta,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Youngsters apply error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
