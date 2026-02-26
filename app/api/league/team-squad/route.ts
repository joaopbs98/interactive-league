import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/league/team-squad?leagueId=X&teamId=Y&view=full
 * Returns squad of a team in the league. User must have a team in the same league.
 * - view=full: returns team info + full squad with roles. Used for opponent squad view.
 * - default: minimal squad for trade proposals.
 */
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
    const viewFull = searchParams.get("view") === "full";

    if (!leagueId || !teamId) {
      return NextResponse.json({ error: "leagueId and teamId required" }, { status: 400 });
    }

    // Verify user has a team in this league
    const { data: userTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!userTeam) {
      return NextResponse.json({ error: "You must be in this league to view team squads" }, { status: 403 });
    }

    // Verify target team is in the same league and fetch team info
    const { data: targetTeam, error: teamErr } = await supabase
      .from("teams")
      .select("id, name, acronym, formation, league_id, starting_lineup, bench, reserves")
      .eq("id", teamId)
      .eq("league_id", leagueId)
      .single();

    if (teamErr || !targetTeam) {
      return NextResponse.json({ error: "Team not found in this league" }, { status: 404 });
    }

    const { data: players, error } = await supabase
      .from("league_players")
      .select("id, player_id, player_name, full_name, positions, rating, image, potential, is_youngster")
      .eq("league_id", leagueId)
      .eq("team_id", teamId)
      .order("rating", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const toPlayerIds = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item) =>
        typeof item === "string" ? item : (item as { player_id?: string })?.player_id
      ).filter(Boolean) as string[];
    };

    const startingIds = toPlayerIds(targetTeam.starting_lineup);
    const benchIds = toPlayerIds(targetTeam.bench);
    const reservesIds = toPlayerIds(targetTeam.reserves);

    const squad = (players || []).map((p) => {
      const pos = p.positions;
      const posStr = Array.isArray(pos) ? pos[0] : (typeof pos === "string" ? pos.split(",")[0]?.trim() : "") || "";
      const role = startingIds.includes(p.player_id) ? "starting" : benchIds.includes(p.player_id) ? "bench" : reservesIds.includes(p.player_id) ? "reserves" : "squad";
      return {
        id: p.player_id,
        league_player_id: (p as { id?: string }).id,
        player_id: p.player_id,
        name: p.full_name || p.player_name || p.player_id,
        full_name: p.full_name,
        positions: p.positions,
        position: posStr,
        rating: p.rating,
        overall_rating: p.rating,
        image: p.image || "",
        potential: p.potential ?? null,
        is_youngster: p.is_youngster ?? false,
        ...(viewFull && { role }),
      };
    });

    if (viewFull) {
      return NextResponse.json({
        success: true,
        team: {
          id: targetTeam.id,
          name: targetTeam.name,
          acronym: targetTeam.acronym,
          formation: targetTeam.formation || "3-1-4-2",
        },
        squad,
        starting_lineup: startingIds,
        bench: benchIds,
        reserves: reservesIds,
      });
    }

    return NextResponse.json({ success: true, squad });
  } catch (err: unknown) {
    console.error("Team squad API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
