import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, playerId, askingPrice, lookingFor, acceptsTrades } = body;

    if (!teamId || !playerId || askingPrice == null || askingPrice < 0) {
      return NextResponse.json(
        { error: "teamId, playerId, and askingPrice (>= 0) required" },
        { status: 400 }
      );
    }

    const serviceSupabase = await getServiceSupabase();

    const { data: team, error: teamErr } = await serviceSupabase
      .from("teams")
      .select("id, user_id, league_id, expendables")
      .eq("id", teamId)
      .single();

    if (teamErr || !team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Team not found or unauthorized" }, { status: 404 });
    }

    const { data: lp, error: lpErr } = await serviceSupabase
      .from("league_players")
      .select("player_id, team_id")
      .eq("league_id", team.league_id)
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .single();

    if (lpErr || !lp) {
      return NextResponse.json({ error: "Player not found or not owned by team" }, { status: 404 });
    }

    const { data: existing } = await serviceSupabase
      .from("transfer_listings")
      .select("id")
      .eq("league_id", team.league_id)
      .eq("player_id", playerId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Player is already listed" }, { status: 400 });
    }

    const expendables = (team.expendables || []) as string[];
    const newExpendables = expendables.filter((id) => id !== playerId);

    await serviceSupabase
      .from("teams")
      .update({ expendables: newExpendables })
      .eq("id", teamId);

    const { data: listing, error: insertErr } = await serviceSupabase
      .from("transfer_listings")
      .insert({
        league_id: team.league_id,
        player_id: playerId,
        team_id: teamId,
        asking_price: askingPrice,
        looking_for: lookingFor || null,
        accepts_trades: !!acceptsTrades,
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { listingId: listing.id, message: "Player listed for sale" },
    });
  } catch (error: any) {
    console.error("Transfer list POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
