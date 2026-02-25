import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const body = await request.json();
    const { pctToSell } = body;

    if (!teamId || pctToSell == null) {
      return NextResponse.json({ error: "teamId and pctToSell required" }, { status: 400 });
    }

    const pct = Number(pctToSell);
    if (isNaN(pct) || pct <= 0) {
      return NextResponse.json({ error: "pctToSell must be a positive number" }, { status: 400 });
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
      return NextResponse.json({ error: "Team not found or unauthorized" }, { status: 403 });
    }

    if (team.league_id) {
      const { data: league } = await supabase
        .from("leagues")
        .select("levers_enabled")
        .eq("id", team.league_id)
        .single();
      if ((league?.levers_enabled ?? true) === false) {
        return NextResponse.json({ error: "Levers are disabled for this league" }, { status: 400 });
      }
    }

    const serviceSupabase = await getServiceSupabase();
    const { data, error } = await serviceSupabase.rpc("sell_merch_percentage", {
      p_team_id: teamId,
      p_pct_to_sell: pct,
      p_actor_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; payout?: number; pct_sold?: number; new_merch_pct?: number };
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to sell merch" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        payout: result.payout,
        pctSold: result.pct_sold,
        newMerchPct: result.new_merch_pct,
      },
    });
  } catch (err) {
    console.error("Sell merch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
