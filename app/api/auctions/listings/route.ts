import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json();
  const { data, error } = await supabase.rpc("create_auction_house_listing", {
    p_league_id: body.leagueId,
    p_team_id: body.teamId,
    p_asset_type: body.assetType,
    p_asset_id: body.assetId,
    p_starting_bid: Number(body.startingBid),
    p_reserve: Number(body.reserve),
    p_end_time: body.endTime,
    p_actor_user_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success: boolean; error?: string };
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { auctionId } = await request.json();
  const { data, error } = await supabase.rpc("cancel_auction_listing", { p_auction_id: auctionId, p_actor_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success: boolean; error?: string };
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
