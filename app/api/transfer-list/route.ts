import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    if (!leagueId) {
      return NextResponse.json(
        { error: "leagueId required" },
        { status: 400 }
      );
    }

    const serviceSupabase = await getServiceSupabase();

    const { data: listings, error } = await serviceSupabase
      .from("transfer_listings")
      .select(
        `
        id,
        player_id,
        team_id,
        asking_price,
        listed_at,
        team:teams(id, name, acronym)
      `
      )
      .eq("league_id", leagueId)
      .order("listed_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const playerIds = (listings || []).map((r: any) => r.player_id);
    let playerData: Record<string, any> = {};
    if (playerIds.length > 0) {
      const { data: lpRows } = await serviceSupabase
        .from("league_players")
        .select("player_id, player_name, positions, rating, full_name, image")
        .eq("league_id", leagueId)
        .in("player_id", playerIds);
      for (const lp of lpRows || []) {
        playerData[(lp as any).player_id] = lp;
      }
      const { data: pRows } = await serviceSupabase
        .from("player")
        .select("player_id, club_position, club_rating")
        .in("player_id", playerIds);
      for (const p of pRows || []) {
        const existing = playerData[(p as any).player_id] || {};
        playerData[(p as any).player_id] = { ...existing, club_position: (p as any).club_position, club_rating: (p as any).club_rating };
      }
    }

    const enriched = (listings || []).map((row: any) => {
      const lp = playerData[row.player_id] || {};
      return {
        id: row.id,
        player_id: row.player_id,
        team_id: row.team_id,
        asking_price: row.asking_price,
        listed_at: row.listed_at,
        looking_for: row.looking_for,
        accepts_trades: row.accepts_trades ?? false,
        seller_team: row.team,
        player_name: lp.player_name || lp.full_name || "Unknown",
        positions: lp.positions || "",
        rating: lp.rating ?? 0,
        club_position: lp.club_position,
        club_rating: lp.club_rating,
        image: lp.image,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error("Transfer list GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
