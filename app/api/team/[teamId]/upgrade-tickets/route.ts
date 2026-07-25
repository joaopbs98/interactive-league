import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: team } = await supabase
      .from("teams")
      .select("id, user_id, league_id")
      .eq("id", teamId)
      .single();

    if (!team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Team not found or access denied" }, { status: 404 });
    }

    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: tickets, error } = await service
      .from("team_upgrade_tickets")
      .select("id, tier, used_on_player_id, used_at, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: league } = await supabase
      .from("leagues")
      .select("season,status")
      .eq("id", team.league_id)
      .single();
    const previousSeason = Math.max(1, Number(league?.season ?? 1) - 1);
    const { data: snapshot } = await service
      .from("team_season_roster_snapshots")
      .select("player_id")
      .eq("team_id", teamId)
      .eq("season", previousSeason);
    const eligiblePlayerIds = (snapshot ?? []).map((row) => row.player_id);
    const available = (tickets ?? []).filter((t) => !t.used_on_player_id).map((ticket) => ({
      ...ticket,
      eligible_player_ids: eligiblePlayerIds,
    }));
    const used = (tickets ?? []).filter((t) => t.used_on_player_id);

    return NextResponse.json({
      success: true,
      data: { available, used, previousSeason, transferSeason: league?.status === "OFFSEASON" },
    });
  } catch (err) {
    console.error("Upgrade tickets error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
