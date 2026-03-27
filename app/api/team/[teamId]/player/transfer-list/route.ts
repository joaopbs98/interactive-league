import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json(
        { error: "Player ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, user_id")
      .eq("id", teamId)
      .single();

    if (teamError || !team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: rpcError } = await serviceSupabase.rpc("move_player_to_expendables", {
      p_team_id: teamId,
      p_player_id: playerId,
    });

    if (rpcError) {
      console.error("Transfer list error:", rpcError);
      return NextResponse.json(
        { error: rpcError.message || "Failed to add to transfer list" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Player added to transfer list",
    });
  } catch (error: any) {
    console.error("Transfer list error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
