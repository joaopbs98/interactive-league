import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getYoungsterUpgrade } from "@/lib/youngsterLogic";
import { computeYoungsterAttributes } from "@/lib/youngsterAttributeDistribution";
import { isLeagueHost } from "@/lib/hostUtils";

const STAT_COLUMNS = [
  "acceleration", "sprint_speed", "agility", "reactions", "balance", "shot_power",
  "jumping", "stamina", "strength", "long_shots", "aggression", "interceptions",
  "positioning", "vision", "penalties", "composure", "crossing", "finishing",
  "heading_accuracy", "short_passing", "volleys", "dribbling", "curve", "fk_accuracy",
  "long_passing", "ball_control", "defensive_awareness", "standing_tackle", "sliding_tackle",
  "gk_diving", "gk_handling", "gk_kicking", "gk_positioning", "gk_reflexes",
] as const;

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Compute adj avg from performance object (average of non-null avgs) */
function computeAdjAvgFromPerformance(perf: Record<string, number | null | undefined>): number | null {
  const avgs = [
    perf.domestic_avg,
    perf.usc_avg,
    perf.ucl_gs_avg,
    perf.ucl_ko_avg,
    perf.uel_gs_avg,
    perf.uel_ko_avg,
    perf.uecl_gs_avg,
    perf.uecl_ko_avg,
  ].filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (avgs.length === 0) return null;
  return avgs.reduce((a, b) => a + b, 0) / avgs.length;
}

/** Compute total games from performance object */
function computeTotalGamesFromPerformance(perf: Record<string, number | null | undefined>): number {
  const games = [
    perf.domestic_games,
    perf.usc_games,
    perf.ucl_gs_games,
    perf.ucl_ko_games,
    perf.uel_gs_games,
    perf.uel_ko_games,
    perf.uecl_gs_games,
    perf.uecl_ko_games,
  ].filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  return games.reduce((a, b) => a + b, 0);
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
    const seasonParam = searchParams.get("season");

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();
    const season = seasonParam ? parseInt(seasonParam, 10) : (league?.season ?? 1);

    const { data: youngsters, error } = await serviceSupabase
      .from("league_players")
      .select(`
        id,
        player_id,
        player_name,
        full_name,
        positions,
        rating,
        base_rating,
        potential,
        youngster_games_played,
        youngster_adj_avg,
        youngster_ind_training_attrs,
        youngster_non_weighted_attrs,
        team_id
      `)
      .eq("league_id", leagueId)
      .eq("is_youngster", true)
      .not("team_id", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const leaguePlayerIds = (youngsters || []).map((y: { id: string }) => y.id);
    const teamIds = [...new Set((youngsters || []).map((y: { team_id: string }) => y.team_id).filter(Boolean))];
    const teamMap: Record<string, { name: string; acronym?: string }> = {};
    if (teamIds.length > 0) {
      const { data: teams } = await serviceSupabase.from("teams").select("id, name, acronym").in("id", teamIds);
      for (const t of teams || []) {
        teamMap[t.id] = { name: t.name, acronym: t.acronym };
      }
    }
    let performanceMap: Record<string, Record<string, number | null>> = {};

    if (leaguePlayerIds.length > 0) {
      const { data: perfRows } = await serviceSupabase
        .from("youngster_performance")
        .select("*")
        .eq("league_id", leagueId)
        .eq("season", season)
        .in("league_player_id", leaguePlayerIds);

      for (const p of perfRows || []) {
        performanceMap[p.league_player_id] = {
          domestic_games: p.domestic_games,
          domestic_avg: p.domestic_avg,
          usc_games: p.usc_games,
          usc_avg: p.usc_avg,
          ucl_gs_games: p.ucl_gs_games,
          ucl_gs_avg: p.ucl_gs_avg,
          ucl_ko_games: p.ucl_ko_games,
          ucl_ko_avg: p.ucl_ko_avg,
          uel_gs_games: p.uel_gs_games,
          uel_gs_avg: p.uel_gs_avg,
          uel_ko_games: p.uel_ko_games,
          uel_ko_avg: p.uel_ko_avg,
          uecl_gs_games: p.uecl_gs_games,
          uecl_gs_avg: p.uecl_gs_avg,
          uecl_ko_games: p.uecl_ko_games,
          uecl_ko_avg: p.uecl_ko_avg,
        };
      }
    }

    const list = (youngsters || []).map((y: Record<string, unknown>) => {
      const perf = performanceMap[y.id as string] || {};
      const gamesFromPerf = computeTotalGamesFromPerformance(perf);
      const adjAvgFromPerf = computeAdjAvgFromPerformance(perf);
      const games = gamesFromPerf > 0 ? gamesFromPerf : (y.youngster_games_played as number) ?? 0;
      const adjAvg = adjAvgFromPerf ?? (y.youngster_adj_avg as number) ?? 0;
      const baseRating = (y.base_rating as number) ?? (y.rating as number) ?? 60;
      const delta = getYoungsterUpgrade(baseRating, games, adjAvg);
      const newRating = Math.min(99, Math.max(40, baseRating + delta));

      const team = teamMap[y.team_id as string];
      return {
        leaguePlayerId: y.id,
        playerId: y.player_id,
        playerName: y.player_name || y.full_name,
        teamId: y.team_id,
        teamName: team?.name,
        teamAcronym: team?.acronym,
        positions: y.positions,
        rating: y.rating,
        baseRating: y.base_rating ?? y.rating,
        potential: y.potential,
        youngsterGamesPlayed: y.youngster_games_played,
        youngsterAdjAvg: y.youngster_adj_avg,
        indTrainingAttrs: y.youngster_ind_training_attrs as string[] | null,
        nonWeightedAttrs: y.youngster_non_weighted_attrs as string[] | null,
        performance: Object.keys(perf).length > 0 ? perf : null,
        totalGames: games,
        computedAdjAvg: adjAvg,
        previewDelta: delta,
        previewNewRating: newRating,
      };
    });

    return NextResponse.json({ success: true, data: list, season });
  } catch (err) {
    console.error("Youngsters GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, season: bodySeason, updates } = body;

    if (!leagueId || !Array.isArray(updates)) {
      return NextResponse.json({ error: "leagueId and updates array required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();
    const season = bodySeason ?? league?.season ?? 1;

    const results: { playerId: string; delta: number; newRating: number; error?: string }[] = [];

    const selectCols = `id, player_id, team_id, rating, base_rating, positions, potential, youngster_ind_training_attrs, youngster_non_weighted_attrs, ${STAT_COLUMNS.join(", ")}`;

    for (const u of updates) {
      const { playerId, leaguePlayerId, gamesPlayed, adjAvg, performance } = u;
      let lpData: Record<string, unknown> | null = null;

      if (leaguePlayerId) {
        const { data } = await serviceSupabase
          .from("league_players")
          .select(selectCols)
          .eq("id", leaguePlayerId)
          .eq("league_id", leagueId)
          .single();
        lpData = data;
      }
      if (!lpData && playerId) {
        const { data } = await serviceSupabase
          .from("league_players")
          .select(selectCols)
          .eq("league_id", leagueId)
          .eq("player_id", playerId)
          .not("team_id", "is", null)
          .single();
        lpData = data;
      }

      if (!lpData) {
        results.push({ playerId: playerId ?? leaguePlayerId ?? "?", delta: 0, newRating: 0, error: "Player not on team" });
        continue;
      }

      let games = Number(gamesPlayed) || 0;
      let avg = Number(adjAvg) || 0;

      if (performance && typeof performance === "object") {
        const perfGames = computeTotalGamesFromPerformance(performance);
        const perfAvg = computeAdjAvgFromPerformance(performance);
        if (perfGames > 0) games = perfGames;
        if (perfAvg !== null) avg = perfAvg;

        await serviceSupabase.from("youngster_performance").upsert(
          {
            league_id: leagueId,
            league_player_id: lpData.id,
            player_id: lpData.player_id,
            team_id: lpData.team_id,
            season,
            domestic_games: performance.domestic_games ?? null,
            domestic_avg: performance.domestic_avg ?? null,
            usc_games: performance.usc_games ?? null,
            usc_avg: performance.usc_avg ?? null,
            ucl_gs_games: performance.ucl_gs_games ?? null,
            ucl_gs_avg: performance.ucl_gs_avg ?? null,
            ucl_ko_games: performance.ucl_ko_games ?? null,
            ucl_ko_avg: performance.ucl_ko_avg ?? null,
            uel_gs_games: performance.uel_gs_games ?? null,
            uel_gs_avg: performance.uel_gs_avg ?? null,
            uel_ko_games: performance.uel_ko_games ?? null,
            uel_ko_avg: performance.uel_ko_avg ?? null,
            uecl_gs_games: performance.uecl_gs_games ?? null,
            uecl_gs_avg: performance.uecl_gs_avg ?? null,
            uecl_ko_games: performance.uecl_ko_games ?? null,
            uecl_ko_avg: performance.uecl_ko_avg ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "league_id,league_player_id,season" }
        );
      }

      const rating = lpData.base_rating ?? lpData.rating ?? 60;
      const delta = getYoungsterUpgrade(rating, games, avg);
      const newRating = Math.min(99, Math.max(40, rating + delta));

      const currentAttrs: Record<string, number | null> = {};
      for (const col of STAT_COLUMNS) {
        const v = (lpData as Record<string, unknown>)[col];
        currentAttrs[col] = typeof v === "number" ? v : null;
      }

      const attributeUpdates = computeYoungsterAttributes({
        baseOVR: rating,
        newOVR: newRating,
        positions: lpData.positions || "CM",
        currentAttributes: currentAttrs,
        indTrainingAttrs: (lpData.youngster_ind_training_attrs as string[]) || [],
        nonWeightedAttrs: (lpData.youngster_non_weighted_attrs as string[]) || [],
        potential: lpData.potential,
      });

      const { data: rpcData, error } = await serviceSupabase.rpc("apply_youngster_rating_delta", {
        p_league_id: leagueId,
        p_player_id: lpData.player_id,
        p_delta: delta,
        p_games_played: games,
        p_adj_avg: avg,
        p_actor_user_id: user.id,
        p_attribute_updates: Object.keys(attributeUpdates).length > 0 ? attributeUpdates : null,
      });

      if (error) {
        results.push({ playerId: lpData.player_id, delta: 0, newRating: rating, error: error.message });
        continue;
      }

      const r = rpcData as { success: boolean; new_rating?: number };
      results.push({
        playerId: lpData.player_id,
        delta,
        newRating: r.new_rating ?? newRating,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Youngsters apply error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
