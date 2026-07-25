import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isLeagueHost } from "@/lib/hostUtils";
import { getWageFromCsv } from "@/lib/wageTable";
import { visiblePlayerScope } from "@/lib/playerScopeRules.mjs";

/**
 * GET /api/league/players/[playerId]?leagueId=X
 * Returns player details for any player in the league, regardless of ownership
 * (own team, another team, or free agent). Used by the unified player profile page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
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

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);

    // Fetch league_player - no team_id filter, so this works for free agents too
    const { data: leaguePlayer, error: lpError } = await serviceSupabase
      .from("league_players")
      .select("id, player_id, team_id, league_id, player_name, full_name, image, description, rating, positions, potential, international_reputation, country_name, country_flag, dob, height_cm, weight_kg, value, preferred_foot, skill_moves, weak_foot, body_type, is_youngster, is_veteran, acceleration, sprint_speed, agility, reactions, balance, shot_power, jumping, stamina, strength, long_shots, aggression, interceptions, positioning, vision, penalties, composure, crossing, finishing, heading_accuracy, short_passing, volleys, dribbling, curve, fk_accuracy, long_passing, ball_control, defensive_awareness, standing_tackle, sliding_tackle, gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes")
      .eq("league_id", leagueId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (lpError) {
      return NextResponse.json({ error: lpError.message }, { status: 500 });
    }

    // Fetch base player
    let playerQuery = serviceSupabase
      .from("player")
      .select("*")
      .eq("player_id", playerId);
    // Existing league rows may reference historical custom compatibility rows.
    // Without a league row, only the immutable master catalogue is discoverable.
    if (!leaguePlayer) {
      playerQuery = playerQuery
        .or(visiblePlayerScope(leagueId))
        .not("player_id", "like", "custom_%");
    }
    const { data: player, error: playerError } = await playerQuery.single();

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Players not present in league_players (e.g. catalog free agents from the
    // Players Database) are treated as free agents using the master player row.
    const effectiveLeaguePlayer = leaguePlayer || {
      id: null,
      player_id: player.player_id,
      team_id: null,
      league_id: leagueId,
      player_name: player.name,
      full_name: player.full_name,
      image: player.image,
      description: player.description,
      rating: player.overall_rating,
      positions: player.positions,
      potential: player.potential,
      international_reputation: player.international_reputation,
      country_name: player.country_name,
      country_flag: player.country_flag,
      dob: player.dob,
      height_cm: player.height_cm,
      weight_kg: player.weight_kg,
      value: player.value,
      preferred_foot: player.preferred_foot,
      skill_moves: player.skill_moves,
      weak_foot: player.weak_foot,
      body_type: player.body_type,
      is_youngster: false,
      is_veteran: false,
      acceleration: player.acceleration,
      sprint_speed: player.sprint_speed,
      agility: player.agility,
      reactions: player.reactions,
      balance: player.balance,
      shot_power: player.shot_power,
      jumping: player.jumping,
      stamina: player.stamina,
      strength: player.strength,
      long_shots: player.long_shots,
      aggression: player.aggression,
      interceptions: player.interceptions,
      positioning: player.positioning,
      vision: player.vision,
      penalties: player.penalties,
      composure: player.composure,
      crossing: player.crossing,
      finishing: player.finishing,
      heading_accuracy: player.heading_accuracy,
      short_passing: player.short_passing,
      volleys: player.volleys,
      dribbling: player.dribbling,
      curve: player.curve,
      fk_accuracy: player.fk_accuracy,
      long_passing: player.long_passing,
      ball_control: player.ball_control,
      defensive_awareness: player.defensive_awareness,
      standing_tackle: player.standing_tackle,
      sliding_tackle: player.sliding_tackle,
      gk_diving: player.gk_diving,
      gk_handling: player.gk_handling,
      gk_kicking: player.gk_kicking,
      gk_positioning: player.gk_positioning,
      gk_reflexes: player.gk_reflexes,
    };

    const ownerTeamId = effectiveLeaguePlayer.team_id as string | null;
    const isOwnTeam = ownerTeamId === userTeam.id;
    const isFreeAgent = ownerTeamId == null;

    // Owner team info (for ilTeam/ilLeague), if owned
    let ilTeam: { name: string; acronym: string } | null = null;
    let ilLeague: { name?: string; season?: number } | null = null;
    let ownerTeam: { id: string; name: string; acronym: string; expendables?: string[] } | null = null;

    if (ownerTeamId) {
      const { data: targetTeam } = await serviceSupabase
        .from("teams")
        .select("id, name, acronym, expendables, leagues!teams_league_id_fkey(name, season)")
        .eq("id", ownerTeamId)
        .single();

      if (targetTeam) {
        ownerTeam = targetTeam as any;
        ilTeam = { name: targetTeam.name, acronym: targetTeam.acronym };
        const leagues = (targetTeam as any).leagues;
        ilLeague = leagues ? { name: leagues.name, season: leagues.season } : null;
      }
    }

    // For own team, transfer list / sale status
    let isOnTransferList = false;
    let isListedForSale = false;
    let askingPrice: number | null = null;
    let contractFull: { wage: number | null; start_season: number | null; years: number | null } | null = null;

    if (isOwnTeam && ownerTeam) {
      const expendables = (ownerTeam.expendables || []) as string[];
      isOnTransferList = expendables.includes(playerId);
      const { data: contract } = await serviceSupabase
        .from("contracts")
        .select("wage, start_season, years")
        .eq("player_id", playerId)
        .eq("team_id", ownerTeamId)
        .single();
      contractFull = contract;
    }

    // Listing/asking price - the "Value" shown on the profile is set by the
    // selling team and only applies while the player is on the transfer list.
    const { data: listing } = await serviceSupabase
      .from("transfer_listings")
      .select("id, asking_price")
      .eq("league_id", leagueId)
      .eq("player_id", playerId)
      .maybeSingle();
    isListedForSale = !!listing;
    if (listing?.asking_price != null) {
      const parsed = parseInt(String(listing.asking_price).replace(/[^0-9]/g, ""), 10);
      askingPrice = isNaN(parsed) ? null : parsed;
    }

    const valueNum = askingPrice;

    const rawWage = contractFull?.wage ?? player.wage;
    let wageNum: number | null = null;
    if (rawWage != null && rawWage !== "") {
      const parsed = parseInt(String(rawWage).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed)) wageNum = parsed;
    }
    if (wageNum == null) {
      wageNum = getWageFromCsv(effectiveLeaguePlayer.rating ?? 60, effectiveLeaguePlayer.positions ?? "");
    }

    return NextResponse.json({
      success: true,
      player: {
        ...player,
        name: effectiveLeaguePlayer.player_name ?? player.name,
        full_name: effectiveLeaguePlayer.full_name ?? player.full_name,
        image: effectiveLeaguePlayer.image ?? player.image,
        description: effectiveLeaguePlayer.description ?? player.description,
        overall_rating: effectiveLeaguePlayer.rating ?? player.overall_rating,
        positions: effectiveLeaguePlayer.positions ?? player.positions,
        potential: effectiveLeaguePlayer.potential ?? player.potential,
        international_reputation: effectiveLeaguePlayer.international_reputation ?? player.international_reputation,
        country_name: effectiveLeaguePlayer.country_name ?? player.country_name,
        country_flag: effectiveLeaguePlayer.country_flag ?? player.country_flag,
        dob: effectiveLeaguePlayer.dob ?? player.dob,
        height_cm: effectiveLeaguePlayer.height_cm ?? player.height_cm,
        weight_kg: effectiveLeaguePlayer.weight_kg ?? player.weight_kg,
        preferred_foot: effectiveLeaguePlayer.preferred_foot ?? player.preferred_foot,
        skill_moves: effectiveLeaguePlayer.skill_moves ?? player.skill_moves,
        weak_foot: effectiveLeaguePlayer.weak_foot ?? player.weak_foot,
        body_type: effectiveLeaguePlayer.body_type ?? player.body_type,
        value: valueNum,
        wage: wageNum,
        isOnTransferList,
        isListedForSale,
        teamId: ownerTeamId,
        leagueId,
        ilTeam,
        ilLeague,
        ilContract: contractFull
          ? {
              start_season: contractFull.start_season,
              years: contractFull.years,
              contract_until_season: (contractFull.start_season ?? 0) + (contractFull.years ?? 0),
            }
          : null,
        leaguePlayerId: effectiveLeaguePlayer.id,
        leaguePlayer: effectiveLeaguePlayer,
      },
      context: {
        isOwnTeam,
        isHost,
        isFreeAgent,
        teamId: ownerTeamId,
      },
    });
  } catch (error: any) {
    console.error("Unified player GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
