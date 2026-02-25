import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isLeagueHost } from "@/lib/hostUtils";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET: Fetch league sponsors for season (host or any user in league) */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();
    const season = league?.season ?? 1;

    const { data: rows, error } = await serviceSupabase
      .from("league_sponsors")
      .select("sponsor_id, sort_order")
      .eq("league_id", leagueId)
      .eq("season", season)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, data: [], sponsorIds: [] });
    }

    const sponsorIds = rows.map((r) => r.sponsor_id);
    const { data: sponsors } = await serviceSupabase
      .from("sponsors")
      .select("id, name, base_payment, bonus_amount, bonus_condition")
      .in("id", sponsorIds);
    const orderMap = new Map(rows.map((r, i) => [r.sponsor_id, i]));
    const sorted = (sponsors || []).sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));

    return NextResponse.json({ success: true, data: sorted, sponsorIds });
  } catch (err: unknown) {
    console.error("League sponsors GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

const OBJECTIVE_CODES: Record<string, string> = {
  POSITION_4: "position<=4",
  POSITION_6: "position<=6",
  CHAMPION: "champion",
  UCL_WINNER: "ucl winners",
  UCL_FINALIST: "ucl finalist",
  UCL_SEMI: "ucl semi",
  UCL_GROUP: "ucl group",
  UEL_WINNER: "uel winners",
  UEL_FINALIST: "uel finalist",
  UEL_GROUP: "uel group",
  UECL_WINNER: "uecl winners",
  UECL_GROUP: "uecl group",
};

/** POST: Add/remove sponsors for season, or create custom sponsor. Host only. Max 3. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, leagueId, sponsorIds, name, basePayment, bonusAmount, objectiveCode } = body;

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }

    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();
    const season = league?.season ?? 1;

    if (action === "create") {
      const bonusCondition = objectiveCode ? (OBJECTIVE_CODES[objectiveCode] ?? objectiveCode) : null;
      const { data: newSponsor, error: createErr } = await serviceSupabase
        .from("sponsors")
        .insert({
          name: name || "Custom Sponsor",
          base_payment: Math.max(0, parseInt(String(basePayment), 10) || 0),
          bonus_amount: Math.max(0, parseInt(String(bonusAmount), 10) || 0),
          bonus_condition: bonusCondition,
        })
        .select("id")
        .single();
      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, sponsorId: newSponsor?.id });
    }

    if (action === "set") {
      const ids = Array.isArray(sponsorIds) ? sponsorIds.slice(0, 3) : [];
      if (ids.length > 3) {
        return NextResponse.json({ error: "Max 3 sponsors per season" }, { status: 400 });
      }

      await serviceSupabase
        .from("league_sponsors")
        .delete()
        .eq("league_id", leagueId)
        .eq("season", season);

      for (let i = 0; i < ids.length; i++) {
        const { error: insErr } = await serviceSupabase.from("league_sponsors").insert({
          league_id: leagueId,
          season,
          sponsor_id: ids[i],
          sort_order: i,
        });
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true, message: `Set ${ids.length} sponsor(s)` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("League sponsors POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
