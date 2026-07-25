import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const leagueId = request.nextUrl.searchParams.get("leagueId");
  const { data: team } = await supabase.from("teams").select("id").eq("league_id", leagueId).eq("user_id", user.id).maybeSingle();
  if (!team) return NextResponse.json({ players: [], tickets: [] });
  const [{ data: players }, { data: tickets }, { data: listed }] = await Promise.all([
    supabase.from("league_players").select("player_id,player_name,full_name,rating,positions,image").eq("league_id", leagueId).eq("team_id", team.id).order("rating", { ascending: false }),
    supabase.from("team_upgrade_tickets").select("id,tier").eq("team_id", team.id).is("used_on_player_id", null).order("created_at"),
    supabase.from("auctions").select("player_id,upgrade_ticket_id").eq("league_id", leagueId).in("status", ["draft", "active"]),
  ]);
  const listedPlayers = new Set((listed ?? []).map((x) => x.player_id).filter(Boolean));
  const listedTickets = new Set((listed ?? []).map((x) => x.upgrade_ticket_id).filter(Boolean));
  return NextResponse.json({
    teamId: team.id,
    players: (players ?? []).map((x) => ({ ...x, eligible: !listedPlayers.has(x.player_id) })),
    tickets: (tickets ?? []).map((x) => ({ ...x, eligible: !listedTickets.has(x.id) })),
  });
}
