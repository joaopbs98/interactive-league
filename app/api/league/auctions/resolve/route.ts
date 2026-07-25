import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { leagueId } = await request.json();
  const { data, error } = await supabase.rpc("resolve_expired_auctions", { p_league_id: leagueId, p_actor_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { success: boolean; error?: string };
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
