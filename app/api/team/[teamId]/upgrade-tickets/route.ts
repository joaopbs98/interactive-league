import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
      .select("id, user_id")
      .eq("id", teamId)
      .single();

    if (!team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Team not found or access denied" }, { status: 404 });
    }

    const { data: tickets, error } = await supabase
      .from("team_upgrade_tickets")
      .select("id, tier, used_on_player_id, used_at, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const available = (tickets ?? []).filter((t) => !t.used_on_player_id);
    const used = (tickets ?? []).filter((t) => t.used_on_player_id);

    return NextResponse.json({
      success: true,
      data: { available, used },
    });
  } catch (err) {
    console.error("Upgrade tickets error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
