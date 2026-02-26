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
 * DELETE - Clear all international matches for the league's current season.
 * Host only. Removes UCL, UEL, UECL, Super Cup matches and their competition standings.
 * Body: { leagueId, season? } - season defaults to league.season
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { leagueId, season } = body;

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

    const targetSeason = season ?? league?.season ?? 1;

    const { data: deletedMatches } = await serviceSupabase
      .from("matches")
      .delete()
      .eq("league_id", leagueId)
      .eq("season", targetSeason)
      .in("competition_type", ["ucl", "uel", "uecl", "supercup"])
      .select("id");

    await serviceSupabase
      .from("competition_standings")
      .delete()
      .eq("league_id", leagueId)
      .eq("season", targetSeason)
      .in("competition_type", ["ucl", "uel", "uecl"]);

    const count = deletedMatches?.length ?? 0;
    return NextResponse.json({ success: true, deleted: count, season: targetSeason });
  } catch (err: unknown) {
    console.error("Clear international error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Populate international competition group stage from domestic standings.
 * Host only. Allowed when OFFSEASON, or when IN_SEASON with domestic rounds finished.
 * Body: { leagueId, season? } - season defaults to league.season
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { leagueId, season } = body;

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
      .select("season, status, current_round, total_rounds")
      .eq("id", leagueId)
      .single();

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const domesticFinished = (league.current_round ?? 0) > (league.total_rounds ?? 0);
    const canPopulate = league.status === "OFFSEASON" || (league.status === "IN_SEASON" && domesticFinished);
    if (!canPopulate) {
      return NextResponse.json(
        { error: "Populate international when OFFSEASON or after all domestic rounds are finished" },
        { status: 400 }
      );
    }

    const targetSeason = season ?? league.season ?? 1;

    const { data, error } = await serviceSupabase.rpc("auto_populate_international_schedule", {
      p_league_id: leagueId,
      p_season: targetSeason,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { success?: boolean; error?: string; matches_created?: number };
    if (result?.success === false && result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      matches_created: result?.matches_created ?? 0,
      season: targetSeason,
    });
  } catch (err: unknown) {
    console.error("Populate international error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
