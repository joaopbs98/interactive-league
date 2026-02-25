import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getWageFromCsv } from "@/lib/wageTable";

const MIN_SQUAD_SIZE = 18;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; playerId: string }> }
) {
  try {
    const { teamId, playerId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify team ownership and fetch IL team + league info
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name, acronym, user_id, league_id, expendables, leagues(id, name, season)")
      .eq("id", teamId)
      .single();

    if (teamError || !team || team.user_id !== user.id) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Verify player is on this team (league_players)
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: leaguePlayer, error: lpError } = await serviceSupabase
      .from("league_players")
      .select("id, player_id, team_id, league_id, rating, positions, potential, is_youngster, acceleration, sprint_speed, agility, reactions, balance, shot_power, jumping, stamina, strength, long_shots, aggression, interceptions, positioning, vision, penalties, composure, crossing, finishing, heading_accuracy, short_passing, volleys, dribbling, curve, fk_accuracy, long_passing, ball_control, defensive_awareness, standing_tackle, sliding_tackle, gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes")
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .single();

    if (lpError || !leaguePlayer) {
      return NextResponse.json({ error: "Player not on this team" }, { status: 404 });
    }

    // Fetch full player stats from player table
    const { data: player, error: playerError } = await serviceSupabase
      .from("player")
      .select("*")
      .eq("player_id", playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Fetch contract wage (our source of truth for wage in this league)
    const { data: contract } = await serviceSupabase
      .from("contracts")
      .select("wage")
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .single();

    const expendables = (team.expendables || []) as string[];
    const isOnTransferList = expendables.includes(playerId);

    const { data: listing } = await serviceSupabase
      .from("transfer_listings")
      .select("id")
      .eq("league_id", team.league_id)
      .eq("player_id", playerId)
      .maybeSingle();
    const isListedForSale = !!listing;

    // Parse value - player table stores as TEXT; fallback to contract_values by rating
    const rawValue = player.value;
    let valueNum: number | null = null;
    if (rawValue != null && rawValue !== "") {
      const parsed = parseInt(String(rawValue).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed)) valueNum = parsed;
    }
    if (valueNum == null) {
      const rating = Math.min(99, Math.max(40, player.overall_rating ?? 60));
      const pos = (player.positions || "").split(",")[0]?.trim().toUpperCase() || "";
      const isDef = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(pos);
      // Get closest rating <= player rating (contract_values may not have every rating)
      const { data: cvRows } = await serviceSupabase
        .from("contract_values")
        .select("att_value, def_value, rating")
        .lte("rating", rating)
        .order("rating", { ascending: false })
        .limit(1);
      const cv = cvRows?.[0];
      if (cv) valueNum = isDef ? cv.def_value : cv.att_value;
    }

    const rawWage = contract?.wage ?? player.wage;
    let wageNum: number | null = null;
    if (rawWage != null && rawWage !== "") {
      const parsed = parseInt(String(rawWage).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed)) wageNum = parsed;
    }
    if (wageNum == null) {
      const rating = player.overall_rating ?? 60;
      const pos = player.positions ?? "";
      wageNum = getWageFromCsv(rating, pos);
    }

    // IL contract info (for Club section)
    const { data: contractFull } = await serviceSupabase
      .from("contracts")
      .select("wage, start_season, years")
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .single();

    const ilTeam = {
      name: team.name,
      acronym: team.acronym,
    };
    const ilLeague = (team as any).leagues
      ? { name: (team as any).leagues.name, season: (team as any).leagues.season }
      : null;

    return NextResponse.json({
      success: true,
      player: {
        ...player,
        value: valueNum,
        wage: wageNum,
        isOnTransferList,
        isListedForSale,
        teamId,
        leagueId: team.league_id,
        ilTeam,
        ilLeague,
        ilContract: contractFull
          ? {
              start_season: contractFull.start_season,
              years: contractFull.years,
              contract_until_season: contractFull.start_season + (contractFull.years ?? 0),
            }
          : null,
        leaguePlayerId: leaguePlayer.id,
        leaguePlayer,
      },
    });
  } catch (error: any) {
    console.error("Player fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
