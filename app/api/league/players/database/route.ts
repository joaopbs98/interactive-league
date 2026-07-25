import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { visiblePlayerScope } from "@/lib/playerScopeRules.mjs";

const DEFAULT_PAGE_SIZE = 24;

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

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch teams in league for filter dropdown (always needed)
    const { data: teams } = await serviceSupabase
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId)
      .order("name");

    if (teamId === "free") {
      // "Free Agents" = every player in the master catalog NOT currently
      // rostered to a club (team_id set) in this league.
      const { data: rosteredRows } = await serviceSupabase
        .from("league_players")
        .select("player_id")
        .eq("league_id", leagueId)
        .not("team_id", "is", null);

      const rosteredIds = (rosteredRows || []).map((r) => r.player_id).filter(Boolean);

      let query = serviceSupabase
        .from("player")
        .select(
          "player_id, full_name, name, positions, overall_rating, image, value, wage, country_name, country_flag",
          { count: "exact" }
        )
        .or(visiblePlayerScope(leagueId))
        .not("player_id", "like", "custom_%");

      if (rosteredIds.length > 0) {
        query = query.not("player_id", "in", `(${rosteredIds.join(",")})`);
      }

      if (search) {
        const s = search.replace(/[%,]/g, "");
        query = query.or(
          `full_name.ilike.%${s}%,name.ilike.%${s}%,positions.ilike.%${s}%`
        );
      }

      if (position) {
        query = query.ilike("positions", `%${position}%`);
      }

      if (positions.length > 0) {
        query = query.or(
          positions.map((pos) => `positions.ilike.%${pos}%`).join(",")
        );
      }

      if (ratingMin) query = query.gte("overall_rating", parseInt(ratingMin, 10));
      if (ratingMax) query = query.lte("overall_rating", parseInt(ratingMax, 10));

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: rows, error: rowsError, count } = await query
        .order("overall_rating", { ascending: false })
        .range(from, to);

      if (rowsError) {
        return NextResponse.json(
          { error: rowsError.message, success: false },
          { status: 500 }
        );
      }

      const data = (rows || []).map((p) => ({
        id: p.player_id,
        player_id: p.player_id,
        player_name: p.name,
        full_name: p.full_name || p.name,
        positions: p.positions,
        rating: p.overall_rating,
        overall_rating: p.overall_rating,
        team_id: null,
        team_name: "Free Agent",
        image: p.image,
        value: parseNumeric(p.value),
        wage: parseNumeric(p.wage),
        country_name: p.country_name,
        country_flag: p.country_flag,
      }));

      return NextResponse.json({
        success: true,
        data,
        total: count ?? data.length,
        page,
        pageSize,
        teams: teams || [],
      });
    }

    // Rostered players (own team / other team / all teams) - sourced from league_players
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
      .eq("league_id", leagueId)
      .not("team_id", "is", null);

    if (teamId) {
      query = query.eq("team_id", teamId);
    }

    if (position) {
      query = query.ilike("positions", `%${position}%`);
    }

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
        total: 0,
        page,
        pageSize,
        teams: teams || [],
      });
    }

    // Fetch player details from player table (value, wage, etc.)
    const { data: playerDetails, error: playerError } = await serviceSupabase
      .from("player")
      .select("player_id, full_name, value, wage, overall_rating, positions, country_name, country_flag")
      .in("player_id", playerIds);

    if (playerError) {
      console.error("Player details error:", playerError);
    }

    const playerMap = new Map(
      (playerDetails || []).map((p) => [p.player_id, p])
    );

    let result = (leaguePlayers || []).map((lp: any) => {
      const pd = (playerMap.get(lp.player_id) || {}) as { full_name?: string; value?: string; wage?: string; overall_rating?: number; country_name?: string; country_flag?: string };
      return {
        ...lp,
        full_name: lp.full_name || pd.full_name || lp.player_name,
        value: parseNumeric(pd.value),
        wage: parseNumeric(pd.wage),
        overall_rating: pd.overall_rating ?? lp.rating,
        country_name: pd.country_name,
        country_flag: pd.country_flag,
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
    // Note: age filters are not applied - the player table has no age column.
    void ageMin;
    void ageMax;

    const total = result.length;
    const from = (page - 1) * pageSize;
    const paged = result.slice(from, from + pageSize);

    return NextResponse.json({
      success: true,
      data: paged,
      total,
      page,
      pageSize,
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

function parseNumeric(raw: string | number | null | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const parsed = parseInt(String(raw).replace(/[^0-9]/g, ""), 10);
  return isNaN(parsed) ? undefined : parsed;
}
