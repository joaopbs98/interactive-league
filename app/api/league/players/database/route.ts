import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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

    // Filters
    const search = searchParams.get("search") || "";
    const position = searchParams.get("position") || "";
    const teamId = searchParams.get("teamId") || "";
    const ratingMin = searchParams.get("ratingMin");
    const ratingMax = searchParams.get("ratingMax");
    // Advanced filters
    const positions = searchParams.get("positions")?.split(",").filter(Boolean) || [];
    const valueMin = searchParams.get("valueMin");
    const valueMax = searchParams.get("valueMax");
    const wageMin = searchParams.get("wageMin");
    const wageMax = searchParams.get("wageMax");
    const ageMin = searchParams.get("ageMin");
    const ageMax = searchParams.get("ageMax");

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all league players with team info
    let query = serviceSupabase
      .from("league_players")
      .select(`
        id,
        player_id,
        player_name,
        full_name,
        positions,
        rating,
        team_id,
        image,
        league_id
      `)
      .eq("league_id", leagueId);

    // Apply team filter
    if (teamId) {
      if (teamId === "free") {
        query = query.is("team_id", null);
      } else {
        query = query.eq("team_id", teamId);
      }
    }

    // Apply position filter (primary position contains)
    if (position) {
      query = query.ilike("positions", `%${position}%`);
    }

    // Rating range
    if (ratingMin) query = query.gte("rating", parseInt(ratingMin, 10));
    if (ratingMax) query = query.lte("rating", parseInt(ratingMax, 10));

    const { data: leaguePlayers, error: lpError } = await query.order("rating", {
      ascending: false,
    });

    if (lpError) {
      return NextResponse.json(
        { error: lpError.message, success: false },
        { status: 500 }
      );
    }

    const playerIds = (leaguePlayers || []).map((p) => p.player_id).filter(Boolean);
    if (playerIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        teams: [],
      });
    }

    // Fetch player details from player table (value, wage, age, etc.)
    let playerQuery = serviceSupabase
      .from("player")
      .select(
        "player_id, full_name, value, wage, age, overall_rating, positions"
      )
      .in("player_id", playerIds);

    const { data: playerDetails, error: playerError } = await playerQuery;

    if (playerError) {
      console.error("Player details error:", playerError);
    }

    const playerMap = new Map(
      (playerDetails || []).map((p) => [p.player_id, p])
    );

    // Fetch teams in league for filter dropdown
    const { data: teams } = await serviceSupabase
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId)
      .order("name");

    // Merge and build result
    let result = (leaguePlayers || []).map((lp: any) => {
      const pd = (playerMap.get(lp.player_id) || {}) as { full_name?: string; value?: number; wage?: number; age?: number; overall_rating?: number };
      return {
        ...lp,
        full_name: lp.full_name || pd.full_name || lp.player_name,
        value: pd.value,
        wage: pd.wage,
        age: pd.age,
        overall_rating: pd.overall_rating ?? lp.rating,
        team_name: null as string | null,
      };
    });

    // Fetch team names
    const teamIds = [...new Set(result.map((p) => p.team_id).filter(Boolean))];
    const { data: teamData } = await serviceSupabase
      .from("teams")
      .select("id, name")
      .in("id", teamIds);

    const teamNameMap = new Map((teamData || []).map((t) => [t.id, t.name]));
    result = result.map((p) => ({
      ...p,
      team_name: p.team_id ? teamNameMap.get(p.team_id) || "Unknown" : "Free Agent",
    }));

    // Client-side filters (for advanced filters that need player table data)
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.full_name || "").toLowerCase().includes(s) ||
          (p.player_name || "").toLowerCase().includes(s) ||
          (p.positions || "").toLowerCase().includes(s)
      );
    }

    if (positions.length > 0) {
      result = result.filter((p) =>
        positions.some((pos) =>
          (p.positions || "").toLowerCase().includes(pos.toLowerCase())
        )
      );
    }

    if (valueMin != null && valueMin !== "") {
      result = result.filter((p) => (p.value ?? 0) >= parseInt(valueMin, 10));
    }
    if (valueMax != null && valueMax !== "") {
      result = result.filter((p) => (p.value ?? 0) <= parseInt(valueMax, 10));
    }
    if (wageMin != null && wageMin !== "") {
      result = result.filter((p) => (p.wage ?? 0) >= parseInt(wageMin, 10));
    }
    if (wageMax != null && wageMax !== "") {
      result = result.filter((p) => (p.wage ?? 0) <= parseInt(wageMax, 10));
    }
    if (ageMin != null && ageMin !== "") {
      result = result.filter((p) => (p.age ?? 0) >= parseInt(ageMin, 10));
    }
    if (ageMax != null && ageMax !== "") {
      result = result.filter((p) => (p.age ?? 99) <= parseInt(ageMax, 10));
    }

    return NextResponse.json({
      success: true,
      data: result,
      teams: teams || [],
    });
  } catch (error: any) {
    console.error("Players database API error:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
