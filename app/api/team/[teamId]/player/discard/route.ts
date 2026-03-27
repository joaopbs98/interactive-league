import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const MIN_SQUAD_SIZE = 18;

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

    // Count current squad size
    const { count, error: countError } = await serviceSupabase
      .from("league_players")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);

    if (countError) {
      return NextResponse.json(
        { error: "Failed to verify squad size" },
        { status: 500 }
      );
    }

    const squadSize = count ?? 0;
    if (squadSize <= MIN_SQUAD_SIZE) {
      return NextResponse.json(
        {
          error: `Cannot discard. Your team must have at least ${MIN_SQUAD_SIZE} players. You currently have ${squadSize}.`,
        },
        { status: 400 }
      );
    }

    const { data: rpcResult, error: rpcError } = await serviceSupabase.rpc("release_player_il25", {
      p_team_id: teamId,
      p_player_id: playerId,
      p_actor_user_id: user.id,
    });

    if (rpcError) {
      console.error("Discard RPC error:", rpcError);
      return NextResponse.json(
        { error: rpcError.message || "Failed to release player" },
        { status: 500 }
      );
    }

    const result = rpcResult as { success?: boolean; error?: string; penalty?: number };
    if (!result?.success) {
      return NextResponse.json(
        { error: result.error || "Failed to release player" },
        { status: 400 }
      );
    }

    const penaltyMsg = result.penalty && result.penalty > 0
      ? ` Penalty: $${(result.penalty / 1_000_000).toFixed(1)}M`
      : "";
    return NextResponse.json({
      success: true,
      message: `Player released to free agents.${penaltyMsg}`,
      penalty: result.penalty,
    });
  } catch (error: any) {
    console.error("Discard error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
