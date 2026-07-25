import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const service = () => createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function hostContext(leagueId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  const { data: league } = await supabase.from("leagues").select("id,status,commissioner_user_id").eq("id", leagueId).maybeSingle();
  if (!league || league.commissioner_user_id !== user.id) return { error: NextResponse.json({ error: "Host only" }, { status: 403 }) };
  return { supabase, user, league };
}

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("leagueId") ?? "";
  const context = await hostContext(leagueId);
  if (context.error) return context.error;
  const min = Number(request.nextUrl.searchParams.get("minRating") ?? 0);
  const max = Number(request.nextUrl.searchParams.get("maxRating") ?? 99);
  const position = request.nextUrl.searchParams.get("position")?.trim().toUpperCase();
  const count = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("count") ?? 10)));
  let query = service().from("league_players")
    .select("player_id,player_name,full_name,rating,positions,image")
    .eq("league_id", leagueId).is("team_id", null).gte("rating", min).lte("rating", max)
    .order("rating", { ascending: false }).limit(count * 4);
  if (position) query = query.ilike("positions", `%${position}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, count);
  return NextResponse.json({ candidates: shuffled });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const context = await hostContext(body.leagueId);
  if (context.error) return context.error;
  if (context.league!.status !== "OFFSEASON") return NextResponse.json({ error: "Transfer season is closed" }, { status: 400 });
  if (!body.verified || !Array.isArray(body.lots) || body.lots.length === 0) return NextResponse.json({ error: "Review and verify at least one lot" }, { status: 400 });
  const results = [];
  for (const lot of body.lots) {
    const { data, error } = await context.supabase!.rpc("publish_dutch_auction", {
      p_league_id: body.leagueId,
      p_player_id: lot.playerId,
      p_starting_bid: Number(lot.startingBid),
      p_end_time: lot.endTime,
      p_actor_user_id: context.user!.id,
    });
    results.push(error ? { success: false, error: error.message, playerId: lot.playerId } : { ...(data as object), playerId: lot.playerId });
  }
  const failed = results.filter((x: any) => !x.success);
  return NextResponse.json({ success: failed.length === 0, results, error: failed.length ? `${failed.length} lot(s) failed to publish` : undefined }, { status: failed.length ? 400 : 200 });
}
