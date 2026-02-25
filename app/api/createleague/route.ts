import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, teamName, teamAcronym, logoUrl, invites, maxTeams } = body;

    if (!teamName || !teamAcronym) {
      return NextResponse.json(
        { success: false, error: "Team name and acronym are required" },
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

    const inviteCode = generateInviteCode();
    const leagueName = name && name.trim() !== "" ? name : "My League";
    const maxTeamsVal = [12, 16, 18, 20].includes(Number(maxTeams)) ? Number(maxTeams) : 20;

    // Create league with status and invite code
    const { data: league, error: leagueErr } = await serviceSupabase
      .from("leagues")
      .insert({
        name: leagueName,
        season: 1,
        commissioner_user_id: user.id,
        status: 'PRESEASON_SETUP',
        invite_code: inviteCode,
        current_round: 0,
        max_teams: maxTeamsVal,
      })
      .select("id")
      .single();

    if (leagueErr) {
      console.error("League creation error:", leagueErr);
      return NextResponse.json(
        { success: false, error: "Failed to create league" },
        { status: 500 }
      );
    }

    // Create team
    const { data: team, error: teamErr } = await serviceSupabase
      .from("teams")
      .insert({
        league_id: league.id,
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

    // Auto-generate starter squad (18 players from player table -> league_players, contracts, initial budget via ledger)
    const { data: squadResult, error: squadErr } = await serviceSupabase.rpc('auto_starter_squad', {
      p_team_id: team.id,
      p_league_id: league.id,
      p_season: 1
    });

    if (squadErr) {
      console.error("Starter squad generation error:", squadErr);
      // Ensure initial budget even if squad fails (user can use Host Controls to generate later)
      await serviceSupabase.rpc('write_finance_entry', {
        p_team_id: team.id,
        p_league_id: league.id,
        p_amount: 250000000,
        p_reason: 'Initial Budget',
        p_description: 'Starting budget (squad generation failed)',
        p_season: 1,
      });
    }

    // Audit log
    await serviceSupabase.rpc('write_audit_log', {
      p_league_id: league.id,
      p_action: 'create_league',
      p_actor_id: user.id,
      p_payload: { league_name: leagueName, team_name: teamName, invite_code: inviteCode }
    });

    return NextResponse.json({
      success: true,
      data: {
        leagueId: league.id,
        teamId: team.id,
        inviteCode: inviteCode,
        squadResult: squadResult,
      },
    });
  } catch (error: any) {
    console.error("CreateLeague error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
