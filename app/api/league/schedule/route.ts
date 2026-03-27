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

/**
 * POST - Create match(es) manually. Host only.
 * Body: { leagueId, season, round, homeTeamId, awayTeamId } or { leagueId, matches: [{ round, homeTeamId, awayTeamId }, ...] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, season, round, homeTeamId, awayTeamId, matches, competitionType, groupName } = body;

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
      .select("season, id")
      .eq("id", leagueId)
      .single();

    const targetSeason = season ?? league?.season ?? 1;

    const { data: leagueTeams } = await serviceSupabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId);
    const teamIds = new Set((leagueTeams || []).map((t) => t.id));

    const compType = ["domestic", "ucl", "uel", "uecl", "supercup"].includes(competitionType) ? competitionType : "domestic";

    const toInsert: { round: number; home_team_id: string; away_team_id: string; group_name?: string }[] = [];

    if (matches && Array.isArray(matches)) {
      for (const m of matches) {
        const r = m.round ?? 1;
        const h = m.homeTeamId;
        const a = m.awayTeamId;
        if (!h || !a) continue;
        if (!teamIds.has(h) || !teamIds.has(a)) {
          return NextResponse.json({ error: "All teams must be in the league" }, { status: 400 });
        }
        if (h === a) {
          return NextResponse.json({ error: "Home and away team cannot be the same" }, { status: 400 });
        }
        toInsert.push({ round: r, home_team_id: h, away_team_id: a, group_name: m.groupName ?? groupName });
      }
    } else if (round != null && homeTeamId && awayTeamId) {
      if (!teamIds.has(homeTeamId) || !teamIds.has(awayTeamId)) {
        return NextResponse.json({ error: "Teams must be in the league" }, { status: 400 });
      }
      if (homeTeamId === awayTeamId) {
        return NextResponse.json({ error: "Home and away team cannot be the same" }, { status: 400 });
      }
      toInsert.push({ round: Number(round), home_team_id: homeTeamId, away_team_id: awayTeamId, group_name: groupName });
    } else {
      return NextResponse.json({ error: "Provide (round, homeTeamId, awayTeamId) or matches array" }, { status: 400 });
    }

    for (const m of toInsert) {
      const insertRow: Record<string, unknown> = {
        league_id: leagueId,
        season: targetSeason,
        round: m.round,
        home_team_id: m.home_team_id,
        away_team_id: m.away_team_id,
        match_status: "scheduled",
        competition_type: compType,
      };
      if (compType !== "domestic" && (m.group_name || groupName)) {
        insertRow.group_name = m.group_name || groupName;
      }
      const { error } = await serviceSupabase.from("matches").insert(insertRow);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, created: toInsert.length });
  } catch (err: unknown) {
    console.error("Schedule POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
