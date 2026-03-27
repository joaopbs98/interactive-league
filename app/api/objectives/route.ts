import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET: Fetch objectives for user's team in a league (trade objectives + sponsor bonus) */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    const teamId = searchParams.get("teamId");

    if (!leagueId || !teamId) {
      return NextResponse.json({ error: "leagueId and teamId required" }, { status: 400 });
    }

    const { data: teamCheck } = await supabase
      .from("teams")
      .select("id, user_id, league_id")
      .eq("id", teamId)
      .eq("user_id", user.id)
      .single();

    if (!teamCheck || teamCheck.league_id !== leagueId) {
      return NextResponse.json({ error: "Team not found or not in league" }, { status: 403 });
    }

    const serviceSupabase = getServiceSupabase();

    const { data: objectives, error } = await serviceSupabase
      .from("objectives")
      .select(`
        id,
        from_team_id,
        to_team_id,
        description,
        trigger_condition,
        reward_amount,
        fulfilled,
        trade_id,
        created_at
      `)
      .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = objectives || [];
    const teamIds = new Set<string>();
    list.forEach((o: { from_team_id?: string; to_team_id?: string }) => {
      if (o.from_team_id) teamIds.add(o.from_team_id);
      if (o.to_team_id) teamIds.add(o.to_team_id);
    });

    const { data: teams } = await serviceSupabase
      .from("teams")
      .select("id, name, acronym")
      .in("id", Array.from(teamIds));

    const teamMap = new Map((teams || []).map((t: { id: string }) => [t.id, t]));

    const items = list.map((o: Record<string, unknown>) => {
      const fromTeam = teamMap.get(o.from_team_id as string) as { name: string; acronym: string } | undefined;
      const toTeam = teamMap.get(o.to_team_id as string) as { name: string; acronym: string } | undefined;
      const isFromUs = o.from_team_id === teamId;
      return {
        id: o.id,
        description: o.description,
        trigger_condition: o.trigger_condition,
        reward_amount: o.reward_amount,
        fulfilled: o.fulfilled,
        trade_id: o.trade_id,
        created_at: o.created_at,
        from_team: fromTeam ? { name: fromTeam.name, acronym: fromTeam.acronym } : null,
        to_team: toTeam ? { name: toTeam.name, acronym: toTeam.acronym } : null,
        direction: isFromUs ? "we_pay_if_fail" : "we_receive_if_met",
      };
    });

    const { data: sponsorRow } = await serviceSupabase
      .from("teams")
      .select("sponsor_id")
      .eq("id", teamId)
      .single();

    let sponsorObjective: { description: string; bonus_amount: number | null } | null = null;
    if (sponsorRow?.sponsor_id) {
      const { data: league } = await serviceSupabase
        .from("leagues")
        .select("season")
        .eq("id", leagueId)
        .single();
      const season = league?.season ?? 1;
      const { data: term } = await serviceSupabase
        .from("sponsor_season_terms")
        .select("bonus_condition_code, bonus_amount")
        .eq("sponsor_id", sponsorRow.sponsor_id)
        .eq("season", season)
        .limit(1)
        .maybeSingle();
      if (term?.bonus_condition_code) {
        const { getBonusConditionLabel } = await import("@/utils/sponsorLabels");
        sponsorObjective = {
          description: getBonusConditionLabel(term.bonus_condition_code),
          bonus_amount: term.bonus_amount,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tradeObjectives: items,
        sponsorObjective,
      },
    });
  } catch (err) {
    console.error("Objectives API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
