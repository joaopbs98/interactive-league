import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (leagueId) {
      const { data: league } = await serviceSupabase
        .from("leagues")
        .select("season")
        .eq("id", leagueId)
        .single();
      const season = league?.season ?? 1;

      const { data: leagueSponsorRows } = await serviceSupabase
        .from("league_sponsors")
        .select("sponsor_id, sort_order")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("sort_order", { ascending: true });

      if (leagueSponsorRows && leagueSponsorRows.length > 0) {
        const sponsorIds = leagueSponsorRows.map((r) => r.sponsor_id);
        const { data: sponsors, error } = await serviceSupabase
          .from("sponsors")
          .select("id, name, base_payment, bonus_amount, bonus_condition")
          .in("id", sponsorIds);
        if (error) {
          console.error("Error fetching league sponsors:", error);
          return NextResponse.json({ error: "Failed to fetch sponsors" }, { status: 500 });
        }
        const orderMap = new Map(leagueSponsorRows.map((r, i) => [r.sponsor_id, i]));
        const sorted = (sponsors || []).sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
        return NextResponse.json({ sponsors: sorted });
      }
    }

    const { data: sponsors, error } = await serviceSupabase
      .from("sponsors")
      .select("id, name, base_payment, bonus_amount, bonus_condition")
      .order("name");

    if (error) {
      console.error("Error fetching sponsors:", error);
      return NextResponse.json({ error: "Failed to fetch sponsors" }, { status: 500 });
    }

    return NextResponse.json({ sponsors: sponsors || [] });
  } catch (err: unknown) {
    console.error("Sponsors API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
