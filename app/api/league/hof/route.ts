import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return NextResponse.json(
        { error: "leagueId required" },
        { status: 400 }
      );
    }

    const serviceSupabase = await getServiceSupabase();
    const { data: hofRows, error } = await serviceSupabase
      .from("hall_of_fame")
      .select(
        `
        team_id,
        season,
        position,
        hof_points,
        team:teams(id, name, acronym)
      `
      )
      .eq("league_id", leagueId)
      .order("season", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byTeam = new Map<
      string,
      {
        team_id: string;
        team_name: string;
        hof_overall: number;
        hof_last_3: number;
        seasons: { season: number; position: number; points: number }[];
      }
    >();

    for (const row of hofRows || []) {
      const teamId = row.team_id as string;
      const teamRaw = row.team;
      const team = Array.isArray(teamRaw)
        ? (teamRaw[0] as { id: string; name: string; acronym?: string } | undefined)
        : (teamRaw as { id: string; name: string; acronym?: string } | null);
      const teamName = team?.name ?? "Unknown";

      if (!byTeam.has(teamId)) {
        byTeam.set(teamId, {
          team_id: teamId,
          team_name: teamName,
          hof_overall: 0,
          hof_last_3: 0,
          seasons: [],
        });
      }

      const entry = byTeam.get(teamId)!;
      const season = row.season as number;
      const position = row.position as number;
      const points = row.hof_points as number;

      entry.seasons.push({ season, position, points });
      entry.hof_overall += points;
    }

    const result = Array.from(byTeam.values()).map((e) => {
      const last3 = e.seasons.slice(-3);
      e.hof_last_3 = last3.reduce((s, x) => s + x.points, 0);
      return e;
    });

    result.sort((a, b) => b.hof_overall - a.hof_overall);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("HOF API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
