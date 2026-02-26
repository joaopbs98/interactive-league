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
    const { listingId, buyerTeamId } = body;

    if (!listingId || !buyerTeamId) {
      return NextResponse.json(
        { error: "listingId and buyerTeamId required" },
        { status: 400 }
      );
    }

    const serviceSupabase = await getServiceSupabase();

    const { data: listing, error: listErr } = await serviceSupabase
      .from("transfer_listings")
      .select("id, league_id, player_id, team_id, asking_price")
      .eq("id", listingId)
      .single();

    if (listErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const { data: buyerTeam } = await serviceSupabase
      .from("teams")
      .select("id, user_id, league_id")
      .eq("id", buyerTeamId)
      .single();

    if (!buyerTeam || buyerTeam.user_id !== user.id) {
      return NextResponse.json({ error: "Buyer team not found or unauthorized" }, { status: 404 });
    }

    if (buyerTeam.league_id !== listing.league_id) {
      return NextResponse.json({ error: "Team must be in the same league" }, { status: 400 });
    }

    if (buyerTeamId === listing.team_id) {
      return NextResponse.json({ error: "Cannot buy your own listing" }, { status: 400 });
    }

    const { data: team } = await serviceSupabase
      .from("teams")
      .select("budget")
      .eq("id", buyerTeamId)
      .single();

    const availableBalance = team?.budget ?? 0;
    if (availableBalance < listing.asking_price) {
      return NextResponse.json(
        { error: `Insufficient funds. Need €${listing.asking_price.toLocaleString()}` },
        { status: 400 }
      );
    }

    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", listing.league_id)
      .single();

    const season = league?.season || 1;

    await serviceSupabase.rpc("write_finance_entry", {
      p_team_id: buyerTeamId,
      p_league_id: listing.league_id,
      p_amount: -listing.asking_price,
      p_reason: "Transfer List Purchase",
      p_description: `Bought player from transfer list`,
      p_season: season,
    });

    await serviceSupabase.rpc("write_finance_entry", {
      p_team_id: listing.team_id,
      p_league_id: listing.league_id,
      p_amount: listing.asking_price,
      p_reason: "Transfer List Sale",
      p_description: `Sold player on transfer list`,
      p_season: season,
    });

    await serviceSupabase
      .from("league_players")
      .update({ team_id: buyerTeamId })
      .eq("league_id", listing.league_id)
      .eq("player_id", listing.player_id);

    await serviceSupabase
      .from("contracts")
      .update({ team_id: buyerTeamId })
      .eq("team_id", listing.team_id)
      .eq("player_id", listing.player_id);

    await serviceSupabase
      .from("transfer_listings")
      .delete()
      .eq("id", listingId);

    const { data: sellerTeam } = await serviceSupabase
      .from("teams")
      .select("id, user_id, league_id")
      .eq("id", listing.team_id)
      .single();

    if (sellerTeam?.user_id) {
      const { data: player } = await serviceSupabase
        .from("player")
        .select("name, full_name")
        .eq("player_id", listing.player_id)
        .single();

      const { data: buyerTeamName } = await serviceSupabase
        .from("teams")
        .select("name")
        .eq("id", buyerTeamId)
        .single();

      const playerName = player?.full_name || player?.name || "A player";
      const buyerName = buyerTeamName?.name || "a team";
      const priceStr = `€${(listing.asking_price / 1_000_000).toFixed(1)}M`;

      await serviceSupabase.from("notifications").insert({
        user_id: sellerTeam.user_id,
        league_id: sellerTeam.league_id,
        team_id: sellerTeam.id,
        type: "transfer_list_sold",
        title: "Player sold",
        message: `${playerName} was bought by ${buyerName} for ${priceStr}.`,
        read: false,
        link: "/main/dashboard/transfer-list",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Player purchased successfully",
    });
  } catch (error: any) {
    console.error("Transfer list buy error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
