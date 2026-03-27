import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    const teamId = searchParams.get("teamId");

    if (!leagueId || !teamId) {
      return NextResponse.json(
        { error: "leagueId and teamId required" },
        { status: 400 }
      );
    }

    const { data: league } = await supabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();

    const season = league?.season ?? 1;

    const { data: standings } = await supabase
      .from("standings")
      .select("team_id")
      .eq("league_id", leagueId)
      .eq("season", season)
      .order("points", { ascending: false })
      .order("goal_diff", { ascending: false })
      .order("goals_for", { ascending: false });

    if (!standings || standings.length === 0) {
      return NextResponse.json({ rank: null });
    }

    const rank = standings.findIndex((s) => s.team_id === teamId) + 1;
    return NextResponse.json({
      rank: rank > 0 ? rank : null,
    });
  } catch (error: any) {
    console.error("Rank API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
