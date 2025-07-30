import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    console.log("API route called");
    
    // Get the request body
    const body = await request.json();
    console.log("Request body:", body);
    const { name, teamName, teamAcronym, logoUrl, invites } = body;

    // Validate required fields
    if (!teamName || !teamAcronym) {
      console.log("Validation failed: missing teamName or teamAcronym");
      return NextResponse.json(
        { error: "Team name and acronym are required" },
        { status: 400 }
      );
    }

    console.log("Creating Supabase client...");
    // Create Supabase client
    const supabase = await createClient();

    console.log("Getting session...");
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

    console.log("Session found, calling Edge Function...");
    
    // Try to call the Supabase Edge Function
    try {
      const { data, error } = await supabase.functions.invoke("createLeague", {
        body: {
          name: name || "My League",
          teamName,
          teamAcronym,
          logoUrl,
          invites: invites || [],
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      console.log("Edge Function success:", data);
      return NextResponse.json({
        success: true,
        data: data,
        message: "League created successfully"
      });
    } catch (functionError: any) {
      console.error("Edge Function failed, trying direct database approach:", functionError);
      
      // Create service role client to bypass RLS
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Fallback: Create league directly in database
      const leagueName = name && name.trim() !== "" ? name : "My League";
      
      // Create league
      const { data: league, error: leagueErr } = await serviceSupabase
        .from("leagues")
        .insert([
          {
            name: leagueName,
            season: 1,
            commissioner_user_id: session.user.id,
          },
        ])
        .select("id")
        .single();
        
      if (leagueErr) {
        console.error("League creation error:", leagueErr);
        throw leagueErr;
      }

      // Create team
      const initialBudget = 280_000_000;
      const { data: team, error: teamErr } = await serviceSupabase
        .from("teams")
        .insert([
          {
            league_id: league.id,
            user_id: session.user.id,
            name: teamName,
            acronym: teamAcronym,
            logo_url: logoUrl,
            budget: initialBudget,
          },
        ])
        .select("id")
        .single();
        
      if (teamErr) {
        console.error("Team creation error:", teamErr);
        throw teamErr;
      }

      // Create initial players
      const positions = [
        "GK", "GK",
        "DEF", "DEF", "DEF", "DEF", "DEF", "DEF",
        "MID", "MID", "MID", "MID", "MID", "MID",
        "ATT", "ATT", "ATT", "ATT",
      ];
      
      const players = positions.map((pos, index) => ({
        player_id: crypto.randomUUID(),
        name: `Player ${index + 1}`,
        positions: pos,
        overall_rating: Math.floor(Math.random() * 11) + 50,
      }));
      
      const { error: playersErr } = await serviceSupabase.from("player").insert(players);
      if (playersErr) {
        console.error("Players creation error:", playersErr);
        throw playersErr;
      }

      // Handle invites if any
      if (Array.isArray(invites) && invites.length > 0) {
        for (const email of invites.filter((e: string) => e && e.trim() !== "")) {
          await serviceSupabase.from("league_invites").insert([
            {
              league_id: league.id,
              email: email.trim(),
            },
          ]);
        }
      }

      console.log("Direct database approach success");
      return NextResponse.json({
        success: true,
        data: {
          leagueId: league.id,
          teamId: team.id,
        },
        message: "League created successfully (direct database approach)"
      });
    }

  } catch (error: any) {
    console.error("API route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 