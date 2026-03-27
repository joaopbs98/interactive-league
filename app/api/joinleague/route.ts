import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leagueId, inviteCode, teamName, teamAcronym, logoUrl } = body;

    if (!teamName || !teamAcronym) {
      return NextResponse.json(
        { success: false, error: "Team name and acronym are required" },
        { status: 400 }
      );
    }

    if (!leagueId && !inviteCode) {
      return NextResponse.json(
        { success: false, error: "League ID or invite code required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve league by invite code if provided
    let resolvedLeagueId = leagueId;
    if (inviteCode && !leagueId) {
      const { data: league, error: lookupErr } = await serviceSupabase
        .from("leagues")
        .select("id")
        .eq("invite_code", inviteCode.toUpperCase())
        .single();

      if (lookupErr || !league) {
        return NextResponse.json(
          { success: false, error: "Invalid invite code" },
          { status: 404 }
        );
      }
      resolvedLeagueId = league.id;
    }

    // Check league exists
    const { data: league, error: leagueErr } = await serviceSupabase
      .from("leagues")
      .select("id, season, status, max_teams")
      .eq("id", resolvedLeagueId)
      .single();

    if (leagueErr || !league) {
      return NextResponse.json(
        { success: false, error: "League not found" },
        { status: 404 }
      );
    }

    const maxTeams = league.max_teams ?? 20;
    const { count: teamCount } = await serviceSupabase
      .from("teams")
      .select("*", { count: "exact", head: true })
      .eq("league_id", resolvedLeagueId);

    if ((teamCount ?? 0) >= maxTeams) {
      return NextResponse.json(
        { success: false, error: `League is full (${teamCount}/${maxTeams} teams)` },
        { status: 400 }
      );
    }

    // Check user isn't already in this league
    const { data: existingTeam } = await serviceSupabase
      .from("teams")
      .select("id")
      .eq("league_id", resolvedLeagueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingTeam) {
      return NextResponse.json(
        { success: false, error: "You already have a team in this league" },
        { status: 400 }
      );
    }

    // Check league limit (max 2)
    const { data: userTeams } = await serviceSupabase
      .from("teams")
      .select("league_id")
      .eq("user_id", user.id);

    const uniqueLeagues = new Set((userTeams || []).map(t => t.league_id));
    if (uniqueLeagues.size >= 2) {
      return NextResponse.json(
        { success: false, error: "You can only be in a maximum of 2 leagues" },
        { status: 400 }
      );
    }

    // Create team (budget starts at 0, auto_starter_squad will credit via ledger)
    const { data: team, error: teamErr } = await serviceSupabase
      .from("teams")
      .insert({
        league_id: resolvedLeagueId,
        user_id: user.id,
        name: teamName,
        acronym: teamAcronym,
        logo_url: logoUrl,
        budget: 0,
      })
      .select("id")
      .single();

    if (teamErr) {
      console.error("Team creation error:", teamErr);
      return NextResponse.json(
        { success: false, error: "Failed to create team" },
        { status: 500 }
      );
    }

    // Auto-generate starter squad (copies from player table -> league_players for this league)
    const { data: squadResult, error: squadErr } = await serviceSupabase.rpc('auto_starter_squad', {
      p_team_id: team.id,
      p_league_id: resolvedLeagueId,
      p_season: league.season || 1
    });

    if (squadErr) {
      console.error("Starter squad generation error:", squadErr);
      // Ensure initial budget even if squad fails (host can generate via Host Controls)
      await serviceSupabase.rpc('write_finance_entry', {
        p_team_id: team.id,
        p_league_id: resolvedLeagueId,
        p_amount: 250000000,
        p_reason: 'Initial Budget',
        p_description: 'Starting budget (squad generation failed)',
        p_season: league.season || 1,
      });
    }

    // Audit log
    await serviceSupabase.rpc('write_audit_log', {
      p_league_id: resolvedLeagueId,
      p_action: 'join_league',
      p_actor_id: user.id,
      p_payload: { team_name: teamName }
    });

    return NextResponse.json({
      success: true,
      data: {
        leagueId: resolvedLeagueId,
        teamId: team.id,
        squadResult: squadResult,
      },
    });
  } catch (error: any) {
    console.error("JoinLeague error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
