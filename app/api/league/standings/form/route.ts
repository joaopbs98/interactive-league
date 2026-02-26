import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET: Form (last 5) and head-to-head per team for domestic standings */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    const season = searchParams.get("season");

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = getServiceSupabase();

    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();

    const targetSeason = season ? parseInt(season) : league?.season ?? 1;

    const { data: matches, error } = await serviceSupabase
      .from("matches")
      .select("id, round, home_team_id, away_team_id, home_score, away_score")
      .eq("league_id", leagueId)
      .eq("season", targetSeason)
      .eq("match_status", "simulated")
      .or("competition_type.eq.domestic,competition_type.is.null")
      .order("round", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (matches || []) as {
      round: number;
      home_team_id: string;
      away_team_id: string;
      home_score: number | null;
      away_score: number | null;
    }[];

    const formByTeam: Record<string, string> = {};
    const h2hByPair: Record<string, Record<string, { w: number; d: number; l: number }>> = {};

    for (const m of list) {
      const h = m.home_team_id;
      const a = m.away_team_id;
      const hs = m.home_score ?? 0;
      const as = m.away_score ?? 0;

      const pairKey = [h, a].sort().join("-");
      if (!h2hByPair[pairKey]) h2hByPair[pairKey] = {};
      const pair = h2hByPair[pairKey];
      if (!pair[h]) pair[h] = { w: 0, d: 0, l: 0 };
      if (!pair[a]) pair[a] = { w: 0, d: 0, l: 0 };

      if (hs > as) {
        pair[h].w++;
        pair[a].l++;
      } else if (hs < as) {
        pair[a].w++;
        pair[h].l++;
      } else {
        pair[h].d++;
        pair[a].d++;
      }
    }

    const teamMatches: Record<string, { round: number; result: "W" | "D" | "L" }[]> = {};
    for (const m of list) {
      const h = m.home_team_id;
      const a = m.away_team_id;
      const hs = m.home_score ?? 0;
      const as = m.away_score ?? 0;
      const res = hs > as ? "W" : hs < as ? "L" : "D";

      if (!teamMatches[h]) teamMatches[h] = [];
      teamMatches[h].push({ round: m.round, result: res });
      if (!teamMatches[a]) teamMatches[a] = [];
      teamMatches[a].push({ round: m.round, result: res === "W" ? "L" : res === "L" ? "W" : "D" });
    }

    for (const [teamId, arr] of Object.entries(teamMatches)) {
      const sorted = [...arr].sort((x, y) => y.round - x.round);
      const last5 = sorted.slice(0, 5).map((r) => r.result).reverse();
      formByTeam[teamId] = last5.join("");
    }

    return NextResponse.json({
      success: true,
      data: {
        form: formByTeam,
        h2h: h2hByPair,
      },
    });
  } catch (err) {
    console.error("Standings form API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
