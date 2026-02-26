import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isLeagueHost } from "@/lib/hostUtils";
import { getWageFromCsv } from "@/lib/wageTable";

/**
 * GET /api/league/team/[teamId]/player/[playerId]?leagueId=X
 * Returns player details for any team in the league.
 * User must have a team in the same league.
 * Used for opponent player profile (view, propose trade) and host edit.
 */
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

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    // Verify user has a team in this league
    const { data: userTeam, error: userTeamErr } = await supabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (userTeamErr || !userTeam) {
      return NextResponse.json({ error: "You must be in this league to view players" }, { status: 403 });
    }

    const isOwnTeam = userTeam.id === teamId;

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);

    // Fetch target team
    const { data: targetTeam, error: teamErr } = await serviceSupabase
      .from("teams")
      .select("id, name, acronym, league_id, expendables, leagues!teams_league_id_fkey(id, name, season)")
      .eq("id", teamId)
      .eq("league_id", leagueId)
      .single();

    if (teamErr || !targetTeam) {
      return NextResponse.json({ error: "Team not found in this league" }, { status: 404 });
    }

    // Fetch league_player - use league_id from target team for correct scoping
    const { data: leaguePlayer, error: lpError } = await serviceSupabase
      .from("league_players")
      .select("id, player_id, team_id, league_id, rating, positions, potential, is_youngster, is_veteran, acceleration, sprint_speed, agility, reactions, balance, shot_power, jumping, stamina, strength, long_shots, aggression, interceptions, positioning, vision, penalties, composure, crossing, finishing, heading_accuracy, short_passing, volleys, dribbling, curve, fk_accuracy, long_passing, ball_control, defensive_awareness, standing_tackle, sliding_tackle, gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes")
      .eq("league_id", targetTeam.league_id)
      .eq("team_id", teamId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (lpError || !leaguePlayer) {
      return NextResponse.json(
        { error: lpError?.message || "Player not on this team" },
        { status: 404 }
      );
    }

    // Fetch base player
    const { data: player, error: playerError } = await serviceSupabase
      .from("player")
      .select("*")
      .eq("player_id", playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // For own team, transfer list / sale status
    let isOnTransferList = false;
    let isListedForSale = false;
    let contractFull: { wage: number | null; start_season: number | null; years: number | null } | null = null;

    if (isOwnTeam) {
      const expendables = (targetTeam.expendables || []) as string[];
      isOnTransferList = expendables.includes(playerId);
      const { data: listing } = await serviceSupabase
        .from("transfer_listings")
        .select("id")
        .eq("league_id", leagueId)
        .eq("player_id", playerId)
        .maybeSingle();
      isListedForSale = !!listing;

      const { data: contract } = await serviceSupabase
        .from("contracts")
        .select("wage, start_season, years")
        .eq("player_id", playerId)
        .eq("team_id", teamId)
        .single();
      contractFull = contract;
    }

    // Value/wage
    const rawValue = player.value;
    let valueNum: number | null = null;
    if (rawValue != null && rawValue !== "") {
      const parsed = parseInt(String(rawValue).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed)) valueNum = parsed;
    }
    if (valueNum == null) {
      const rating = Math.min(99, Math.max(40, leaguePlayer.rating ?? 60));
      const pos = (leaguePlayer.positions || "").split(",")[0]?.trim().toUpperCase() || "";
      const isDef = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(pos);
      const { data: cvRows } = await serviceSupabase
        .from("contract_values")
        .select("att_value, def_value, rating")
        .lte("rating", rating)
        .order("rating", { ascending: false })
        .limit(1);
      const cv = cvRows?.[0];
      if (cv) valueNum = isDef ? cv.def_value : cv.att_value;
    }

    const rawWage = contractFull?.wage ?? player.wage;
    let wageNum: number | null = null;
    if (rawWage != null && rawWage !== "") {
      const parsed = parseInt(String(rawWage).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed)) wageNum = parsed;
    }
    if (wageNum == null) {
      wageNum = getWageFromCsv(leaguePlayer.rating ?? 60, leaguePlayer.positions ?? "");
    }

    const ilTeam = { name: targetTeam.name, acronym: targetTeam.acronym };
    const ilLeague = (targetTeam as { leagues?: { name?: string; season?: number } }).leagues
      ? { name: (targetTeam as any).leagues?.name, season: (targetTeam as any).leagues?.season }
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
        leagueId: targetTeam.league_id,
        ilTeam,
        ilLeague,
        ilContract: contractFull
          ? {
              start_season: contractFull.start_season,
              years: contractFull.years,
              contract_until_season: (contractFull.start_season ?? 0) + (contractFull.years ?? 0),
            }
          : null,
        leaguePlayerId: leaguePlayer.id,
        leaguePlayer,
      },
      context: {
        isOwnTeam,
        isHost,
      },
    });
  } catch (error: any) {
    console.error("League team player GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
