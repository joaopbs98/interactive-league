import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    console.log("Fetching leagues API route called");
    
    // Create Supabase client
    const supabase = await createClient();

    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json(
        { error: "Session error: " + sessionError.message },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.log("No session found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch all leagues with team counts
    const { data: leagues, error: leaguesErr } = await supabase
      .from("leagues")
      .select(`
        id,
        name,
        season,
        commissioner_user_id,
        created_at,
        teams!inner(id)
      `);

    if (leaguesErr) {
      console.error("Error fetching leagues:", leaguesErr);
      return NextResponse.json(
        { error: "Failed to fetch leagues" },
        { status: 500 }
      );
    }

    // Process leagues to include team counts and filter out leagues user is already in
    const processedLeagues = leagues.map(league => ({
      id: league.id,
      name: league.name,
      season: league.season,
      team_count: league.teams?.length || 0,
      commissioner_user_id: league.commissioner_user_id,
      created_at: league.created_at
    }));

    // Filter out leagues where user already has a team
    const { data: userTeams, error: userTeamsErr } = await supabase
      .from("teams")
      .select("league_id")
      .eq("user_id", session.user.id);

    if (userTeamsErr) {
      console.error("Error fetching user teams:", userTeamsErr);
      return NextResponse.json(
        { error: "Failed to fetch user teams" },
        { status: 500 }
      );
    }

    const userLeagueIds = userTeams.map(team => team.league_id);
    const availableLeagues = processedLeagues.filter(league => 
      !userLeagueIds.includes(league.id)
    );

    console.log("Successfully fetched leagues");
    return NextResponse.json({
      success: true,
      leagues: availableLeagues
    });

  } catch (error: any) {
    console.error("Fetch leagues API route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 