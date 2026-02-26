import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
    
    const { teamId, formation, startingLineup, bench, reserves, eafcTacticCode, eafcComment } = requestBody;

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
      .select("id, user_id, name")
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