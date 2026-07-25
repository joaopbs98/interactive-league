import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const leagueId = request.nextUrl.searchParams.get("leagueId");
  const mode = request.nextUrl.searchParams.get("mode") ?? "dutch";
  const status = request.nextUrl.searchParams.get("status") ?? "active";
  if (!leagueId) return NextResponse.json({ error: "leagueId required" }, { status: 400 });

  const { data: viewerTeam } = await supabase.from("teams").select("id").eq("league_id", leagueId).eq("user_id", user.id).maybeSingle();
  const { data: expired } = await supabase.from("auctions").select("id").eq("league_id", leagueId).eq("status", "active").lte("end_time", new Date().toISOString());
  for (const auction of expired ?? []) {
    await supabase.rpc("finish_auction", { p_auction_id: auction.id, p_actor_user_id: user.id });
  }

  const { data, error } = await supabase
    .from("auctions")
    .select(`*, player:player_id(*), ticket:upgrade_ticket_id(id,tier), seller:team_id(id,name), winner:winning_team_id(id,name), bids(id,team_id,amount,created_at,team:team_id(id,name))`)
    .eq("league_id", leagueId)
    .eq("mode", mode)
    .eq("status", status)
    .order(status === "active" ? "end_time" : "finished_at", { ascending: status === "active" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const auctions = (data ?? []).map((auction: any) => {
    const bids = [...(auction.bids ?? [])].sort((a, b) => b.amount - a.amount || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const high = bids[0] ?? null;
    const mine = viewerTeam ? bids.filter((bid) => bid.team_id === viewerTeam.id).sort((a, b) => b.amount - a.amount)[0] : null;
    return {
      ...auction,
      bids,
      currentBid: high?.amount ?? null,
      minimumNextBid: high ? high.amount + 100000 : auction.starting_bid,
      leader: high?.team ?? null,
      viewerTeamId: viewerTeam?.id ?? null,
      isSeller: viewerTeam?.id === auction.team_id,
      viewerBid: mine?.amount ?? null,
    };
  });
  return NextResponse.json({ auctions });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { auctionId, amount, leagueId } = await request.json();
  const { data: team } = await supabase.from("teams").select("id").eq("league_id", leagueId).eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  const { data, error } = await supabase.rpc("place_auction_bid", {
    p_auction_id: auctionId,
    p_team_id: team.id,
    p_amount: Number(amount),
    p_actor_user_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success: boolean; error?: string; minimum?: number };
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
