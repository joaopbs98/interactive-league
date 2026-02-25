import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { teamId } = await params;
    const body = await request.json();
    const { sponsorId } = body;

    if (sponsorId !== null && typeof sponsorId !== "string") {
      return NextResponse.json({ error: "Invalid sponsorId" }, { status: 400 });
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, league_id")
      .eq("id", teamId)
      .eq("user_id", session.user.id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: "Team not found or access denied" }, { status: 404 });
    }

    const { data: league } = await supabase
      .from("leagues")
      .select("status")
      .eq("id", team.league_id)
      .single();

    if (league?.status !== "OFFSEASON") {
      return NextResponse.json(
        { error: "Sponsor changes are only allowed during OFFSEASON" },
        { status: 400 }
      );
    }

    if (sponsorId) {
      const { data: sponsor } = await supabase
        .from("sponsors")
        .select("id")
        .eq("id", sponsorId)
        .single();

      if (!sponsor) {
        return NextResponse.json({ error: "Sponsor not found" }, { status: 400 });
      }
    }

    const { error: updateError } = await supabase
      .from("teams")
      .update({ sponsor_id: sponsorId || null })
      .eq("id", teamId);

    if (updateError) {
      console.error("Error updating sponsor:", updateError);
      return NextResponse.json({ error: "Failed to update sponsor" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sponsorId: sponsorId || null });
  } catch (err: unknown) {
    console.error("Team sponsor API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
