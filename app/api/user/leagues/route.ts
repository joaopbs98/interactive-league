import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    console.log("Fetching user leagues API route called");
    
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
      return NextResponse.json(
        { error: "Missing Supabase URL configuration" },
        { status: 500 }
      );
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
      return NextResponse.json(
        { error: "Missing Supabase anon key configuration" },
        { status: 500 }
      );
    }
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
      return NextResponse.json(
        { error: "Missing service role key configuration" },
        { status: 500 }
      );
    }
    
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

    console.log("User ID from session:", session.user.id);

    // Create service role client to bypass RLS
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First, let's check if the team exists with service role (bypassing RLS)
    const { data: serviceTeams, error: serviceTeamsErr } = await serviceSupabase
      .from("teams")
      .select(`
        id,
        name,
        acronym,
        logo_url,
        league_id,
        user_id,
        leagues!teams_league_id_fkey(
          id,
          name,
          season,
          status,
          commissioner_user_id,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", session.user.id);

    console.log("Service role teams found:", serviceTeams);
    console.log("Service role teams error:", serviceTeamsErr);

    // Now try with regular client (with RLS)
    const { data: userTeams, error: userTeamsErr } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        acronym,
        logo_url,
        league_id,
        user_id,
        leagues!teams_league_id_fkey(
          id,
          name,
          season,
          status,
          commissioner_user_id,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", session.user.id);

    console.log("User teams found:", userTeams);
    console.log("User teams error:", userTeamsErr);

    // If both queries failed, return error with debug info
    if (userTeamsErr && serviceTeamsErr) {
      console.error("Both regular and service role queries failed");
      return NextResponse.json(
        { 
          error: "Failed to fetch user teams",
          debug: {
            userTeamsError: userTeamsErr,
            serviceTeamsError: serviceTeamsErr,
            userId: session.user.id
          }
        },
        { status: 500 }
      );
    }

    // Use service teams if regular teams failed or is empty
    const teamsToUse = userTeamsErr || userTeams.length === 0 ? (serviceTeams || []) : userTeams;
    console.log("Teams to use:", teamsToUse);

    // If no teams found, return empty array
    if (!teamsToUse || teamsToUse.length === 0) {
      console.log("No teams found for user");
      return NextResponse.json({
        success: true,
        leagues: [],
        debug: {
          message: "No teams found for user",
          userId: session.user.id
        }
      });
    }

    // Get team counts for each league
    const leagueIds = teamsToUse.map((team: any) => team.league_id);
    
    const { data: teamCounts, error: teamCountsErr } = await serviceSupabase
      .from("teams")
      .select("league_id")
      .in("league_id", leagueIds);

    if (teamCountsErr) {
      console.error("Error fetching team counts:", teamCountsErr);
      // Continue without team counts rather than failing completely
      console.log("Continuing without team counts");
    }

    console.log("Team counts:", teamCounts);

    // Count teams per league
    const leagueTeamCounts = teamCounts ? teamCounts.reduce((acc, team) => {
      acc[team.league_id] = (acc[team.league_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) : {};

    console.log("League team counts:", leagueTeamCounts);

    // Process leagues with team information
    const processedLeagues = teamsToUse.map((team: any) => ({
      id: team.leagues.id,
      name: team.leagues.name,
      season: team.leagues.season,
      status: team.leagues.status,
      team_count: leagueTeamCounts[team.league_id] || 1, // Default to 1 if count not available
      commissioner_user_id: team.leagues.commissioner_user_id,
      created_at: team.leagues.created_at,
      updated_at: team.leagues.updated_at,
      my_team: {
        id: team.id,
        name: team.name,
        acronym: team.acronym,
        logo_url: team.logo_url
      }
    }));

    console.log("Processed leagues:", processedLeagues);
    console.log("Successfully fetched user leagues");
    return NextResponse.json({
      success: true,
      leagues: processedLeagues,
      debug: {
        message: "Successfully processed leagues",
        userId: session.user.id,
        leagueCount: processedLeagues.length
      }
    });

  } catch (error: any) {
    console.error("Fetch user leagues API route error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        debug: {
          message: "Exception caught in user leagues API",
          error: error.toString()
        }
      },
      { status: 500 }
    );
  }
} 