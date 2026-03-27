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

/** GET: List host teams for a league. Commissioner only. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leagueId = request.nextUrl.searchParams.get("leagueId");
    if (!leagueId) {
      return NextResponse.json({ error: "leagueId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("commissioner_user_id")
      .eq("id", leagueId)
      .single();

    if (!league || league.commissioner_user_id !== user.id) {
      return NextResponse.json({ error: "Only the commissioner can manage host teams" }, { status: 403 });
    }

    const { data: hostTeams, error } = await serviceSupabase
      .from("league_host_teams")
      .select("team_id, teams(id, name, acronym)")
      .eq("league_id", leagueId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: (hostTeams || []).map((ht: any) => ({
        team_id: ht.team_id,
        team: ht.teams,
      })),
    });
  } catch (err: unknown) {
    console.error("Host teams GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** POST: Add a team as host. Commissioner only. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, teamId } = body;
    if (!leagueId || !teamId) {
      return NextResponse.json({ error: "leagueId and teamId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("commissioner_user_id")
      .eq("id", leagueId)
      .single();

    if (!league || league.commissioner_user_id !== user.id) {
      return NextResponse.json({ error: "Only the commissioner can manage host teams" }, { status: 403 });
    }

    const { data: team } = await serviceSupabase
      .from("teams")
      .select("id, league_id")
      .eq("id", teamId)
      .eq("league_id", leagueId)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team not found or does not belong to this league" }, { status: 404 });
    }

    const { error: insertError } = await serviceSupabase
      .from("league_host_teams")
      .upsert({ league_id: leagueId, team_id: teamId }, { onConflict: "league_id,team_id" });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Host teams POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/** DELETE: Remove a team from host list. Commissioner only. */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leagueId = request.nextUrl.searchParams.get("leagueId");
    const teamId = request.nextUrl.searchParams.get("teamId");
    if (!leagueId || !teamId) {
      return NextResponse.json({ error: "leagueId and teamId required" }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data: league } = await serviceSupabase
      .from("leagues")
      .select("commissioner_user_id")
      .eq("id", leagueId)
      .single();

    if (!league || league.commissioner_user_id !== user.id) {
      return NextResponse.json({ error: "Only the commissioner can manage host teams" }, { status: 403 });
    }

    const { error: deleteError } = await serviceSupabase
      .from("league_host_teams")
      .delete()
      .eq("league_id", leagueId)
      .eq("team_id", teamId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Host teams DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
