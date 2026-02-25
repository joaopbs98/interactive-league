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
      .select("id, user_id, expendables")
      .eq("id", teamId)
      .single();

    if (teamError || !team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const expendables = (team.expendables || []) as string[];
    if (!expendables.includes(playerId)) {
      return NextResponse.json(
        { error: "Player is not on transfer list" },
        { status: 400 }
      );
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const newExpendables = expendables.filter((id) => id !== playerId);
    const { error: updateError } = await serviceSupabase
      .from("teams")
      .update({ expendables: newExpendables })
      .eq("id", teamId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to remove from transfer list" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Player removed from transfer list",
    });
  } catch (error: any) {
    console.error("Remove from transfer list error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
