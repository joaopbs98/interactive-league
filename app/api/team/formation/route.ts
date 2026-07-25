import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { validateTactic } from "@/lib/tactics/catalogue.mjs";
import { validateRosterSelection } from "@/lib/tactics/rosterValidation.mjs";
import { toPlayerIds } from "@/lib/simulation/adapter.mjs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const teamId = request.nextUrl.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
  const { data: team } = await supabase.from("teams").select("id, league_id, user_id").eq("id", teamId).single();
  if (!team || team.user_id !== session.user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { data: tactic } = await supabase.from("team_tactics").select("id, formation, build_up_style, defensive_approach, line_height, engine_version").eq("team_id", teamId).eq("is_active", true).maybeSingle();
  if (!tactic) return NextResponse.json({ success: true, tactic: null });
  const { data: assignments } = await supabase.from("team_tactic_assignments").select("slot_index, slot_position, player_id, role, focus").eq("tactic_id", tactic.id).order("slot_index");
  return NextResponse.json({ success: true, tactic: { ...tactic, assignments: assignments || [] } });
}

export async function POST(request: NextRequest) {
  try {
    console.log("Formation API - POST request received");
    
    const supabase = await createClient();
    console.log("Formation API - Supabase client created");
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log("Formation API - Session check:", { session: !!session, error: sessionError });
    
    if (sessionError || !session) {
      console.log("Formation API - Authentication failed");
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    console.log("Formation API - Parsing request body...");
    const requestBody = await request.json();
    console.log("Formation API - Request body parsed:", requestBody);
    
    const { teamId, formation, startingLineup, bench, reserves, eafcTacticCode, eafcComment, tactic } = requestBody;

    if (!teamId) {
      return NextResponse.json({ error: "Team ID is required" }, { status: 400 });
    }

    console.log("Formation API - Received data:", { teamId, formation, startingLineup, bench, reserves });
    console.log("Formation API - Data types:", {
      teamId: typeof teamId,
      formation: typeof formation,
      startingLineup: typeof startingLineup,
      bench: typeof bench,
      reserves: typeof reserves,
      startingLineupLength: startingLineup?.length,
      benchLength: bench?.length,
      reservesLength: reserves?.length
    });

    // Prepare the update data
    // starting_lineup, bench and reserves are all JSONB columns
    const updateData: Record<string, unknown> = {
      formation: formation || "3-1-4-2",
      starting_lineup: startingLineup || [],  // jsonb - keep as array
      bench: bench || [],                     // jsonb - keep as array of strings
      reserves: reserves || []                // jsonb - keep as array of strings
    };
    if (eafcTacticCode !== undefined) {
      updateData.eafc_tactic_code = eafcTacticCode === "" ? null : eafcTacticCode;
    }
    if (eafcComment !== undefined) {
      updateData.eafc_comment = eafcComment === "" ? null : eafcComment;
    }
    
    console.log("Formation API - Update data:", updateData);

    // First, let's verify the team exists and belongs to the user
    const { data: existingTeam, error: teamCheckError } = await supabase
      .from("teams")
      .select("id, user_id, name, league_id")
      .eq("id", teamId)
      .single();

    console.log("Formation API - Team check result:", { existingTeam, teamCheckError });
    console.log("Formation API - Session user ID:", session.user.id);
    console.log("Formation API - Team ID being updated:", teamId);

    if (teamCheckError) {
      console.error("Error checking team existence:", teamCheckError);
      return NextResponse.json({ 
        error: "Team not found or access denied", 
        details: teamCheckError 
      }, { status: 404 });
    }

    if (!existingTeam) {
      console.error("No team found with ID:", teamId);
      return NextResponse.json({ 
        error: "Team not found", 
        teamId: teamId 
      }, { status: 404 });
    }

    if (existingTeam.user_id !== session.user.id) {
      console.error("User ID mismatch:", { 
        teamUserId: existingTeam.user_id, 
        sessionUserId: session.user.id 
      });
      return NextResponse.json({ 
        error: "Not authorized to update this team" 
      }, { status: 403 });
    }

    const startingIds = toPlayerIds(startingLineup);
    const benchIds = toPlayerIds(bench);
    const reserveIds = toPlayerIds(reserves);
    const selectedIds = [...new Set([...startingIds, ...benchIds, ...reserveIds])];
    const { data: ownedPlayers, error: rosterError } = selectedIds.length ? await supabase
      .from("league_players")
      .select("player_id, player_name, injury_games_remaining, suspension_games_remaining")
      .eq("league_id", existingTeam.league_id)
      .eq("team_id", teamId)
      .in("player_id", selectedIds) : { data: [], error: null };
    if (rosterError) return NextResponse.json({ error: "Could not validate squad selection" }, { status: 500 });
    const rosterErrors = validateRosterSelection({ starting: startingIds, bench: benchIds, reserves: reserveIds, ownedPlayers: ownedPlayers || [] });
    if (rosterErrors.length) return NextResponse.json({ error: "Invalid squad selection", details: rosterErrors }, { status: 400 });

    if (tactic) {
      const normalizedTactic = { ...tactic, formation };
      const validation = validateTactic(normalizedTactic);
      if (!validation.valid) return NextResponse.json({ error: "Invalid tactic", details: validation.errors }, { status: 400 });
      const { data, error: tacticError } = await supabase.rpc("save_team_tactic", {
        p_team_id: teamId,
        p_actor_user_id: session.user.id,
        p_formation: formation,
        p_starting_lineup: startingLineup,
        p_bench: bench || [],
        p_reserves: reserves || [],
        p_eafc_tactic_code: eafcTacticCode || "",
        p_eafc_comment: eafcComment || "",
        p_build_up_style: tactic.buildUpStyle,
        p_defensive_approach: tactic.defensiveApproach,
        p_line_height: tactic.lineHeight,
        p_assignments: tactic.assignments,
      });
      if (tacticError) {
        const missingTacticRpc = /save_team_tactic.*schema cache|function public\.save_team_tactic/i.test(tacticError.message || "");
        if (!missingTacticRpc) return NextResponse.json({ error: tacticError.message }, { status: 500 });
        const { error: fallbackError } = await supabase.from("teams").update({
          formation,
          starting_lineup: startingIds,
          bench: benchIds,
          reserves: reserveIds,
          eafc_tactic_code: eafcTacticCode || "",
          eafc_comment: eafcComment || "",
        }).eq("id", teamId).eq("user_id", session.user.id);
        if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        return NextResponse.json({
          success: true,
          warning: "Matchday squad saved, but advanced simulation tactics require the pending database migration",
        });
      }
      if (!data?.success) return NextResponse.json({ error: data?.error || "Failed to save tactic" }, { status: 500 });
      return NextResponse.json({ success: true, message: "Tactic updated successfully", data });
    }

    // Update team formation and lineup including bench and reserves
    const { error } = await supabase
      .from("teams")
      .update(updateData)
      .eq("id", teamId)
      .eq("user_id", session.user.id);

    if (error) {
      console.error("Error updating team formation:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return NextResponse.json({ error: "Failed to update formation", details: error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Formation updated successfully" 
    });

  } catch (error: any) {
    console.error("Update formation API error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json({ 
      error: error.message || "Internal server error",
      details: error.toString(),
      stack: error.stack 
    }, { status: 500 });
  }
}
