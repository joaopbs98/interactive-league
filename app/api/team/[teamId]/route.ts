import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    console.log("Fetching team data API route called");
    
    const { teamId } = await params;
    
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

    // Fetch team data with league information and squad
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        acronym,
        logo_url,
        budget,
        league_id,
        squad,
        leagues!inner(
          id,
          name,
          season
        )
      `)
      .eq("id", teamId)
      .eq("user_id", session.user.id)
      .single();

    if (teamErr) {
      console.error("Error fetching team:", teamErr);
      return NextResponse.json(
        { error: "Team not found or access denied" },
        { status: 404 }
      );
    }

    // Extract league data
    const league = team.leagues;

    console.log(`Team ${teamId} squad data:`, team.squad);
    console.log(`Squad type:`, typeof team.squad);
    console.log(`Squad is array:`, Array.isArray(team.squad));
    console.log(`Squad has ${Array.isArray(team.squad) ? team.squad.length : 0} players`);
    
    // Check if squad is a JSON string that needs parsing
    let squadData = team.squad;
    if (typeof team.squad === 'string') {
      try {
        squadData = JSON.parse(team.squad);
        console.log("Parsed squad data:", squadData);
      } catch (e) {
        console.error("Failed to parse squad JSON:", e);
        squadData = [];
      }
    }

    // Get active injuries for this team to filter out injured players
    const { data: injuries, error: injuriesError } = await supabase
      .from('injuries')
      .select('player_id, type, games_remaining')
      .eq('team_id', teamId)
      .gt('games_remaining', 0);

    if (injuriesError) {
      console.error("Error fetching injuries:", injuriesError);
    }

    // Create a map of injury details by player ID
    const injuryMap = new Map();
    injuries?.forEach(injury => {
      injuryMap.set(injury.player_id, {
        type: injury.type,
        games_remaining: injury.games_remaining
      });
    });
    
    console.log("Injury map:", Object.fromEntries(injuryMap));

    // Get player IDs from squad to fetch full player details
    const playerIds = (Array.isArray(squadData) ? squadData : []).map(player => player.player_id);
    
    console.log("Player IDs from squad:", playerIds);
    console.log("Squad data structure:", JSON.stringify(squadData, null, 2));
    
    // Fetch full player details including images from the player table
    console.log("Fetching player details for IDs:", playerIds);
    console.log("Player IDs types:", playerIds.map(id => ({ id, type: typeof id })));
    
    let { data: playerDetails, error: playerDetailsError } = await supabase
      .from('player')
      .select(`
        player_id,
        name,
        full_name,
        image,
        description,
        positions,
        overall_rating,
        club_name,
        wage,
        value
      `)
      .in('player_id', playerIds);

    if (playerDetailsError) {
      console.error("Error fetching player details:", playerDetailsError);
      // Continue without player details if there's an error
      playerDetails = [];
    }

    console.log("Player details fetched:", playerDetails?.length || 0, "players");
    console.log("Sample player detail:", playerDetails?.[0]);

    // Create a map of player details by player_id for quick lookup
    const playerDetailsMap = new Map();
    (playerDetails || []).forEach(player => {
      playerDetailsMap.set(player.player_id, player);
    });

    console.log("Player details map size:", playerDetailsMap.size);
    console.log("Sample player detail from map:", playerDetailsMap.get(playerIds[0]));

    // Convert squad data to the expected format and mark injured players
    const allSquad = (Array.isArray(squadData) ? squadData : []).map(player => {
      const injury = injuryMap.get(player.player_id);
      const playerDetail = playerDetailsMap.get(player.player_id);
      
      const enhancedPlayer = {
        player_id: player.player_id,
        name: playerDetail?.name || playerDetail?.full_name || player.name || player.full_name || 'Unknown Player',
        positions: playerDetail?.positions || player.positions,
        overall_rating: playerDetail?.overall_rating || player.overall_rating || player.rating,
        club_name: playerDetail?.club_name || player.club_name,
        image: playerDetail?.image || player.image || '/assets/noImage.jpeg', // Use image from player table with fallback
        wage: playerDetail?.wage || player.wage,
        value: playerDetail?.value || player.value,
        isInjured: !!injury,
        injuryType: injury?.type,
        gamesRemaining: injury?.games_remaining
      };
      
      console.log(`Player ${player.player_id} image mapping:`, {
        originalImage: player.image,
        playerDetailImage: playerDetail?.image,
        finalImage: enhancedPlayer.image
      });
      
      return enhancedPlayer;
    });
    
    const availableSquad = allSquad.filter(player => !player.isInjured);
    console.log(`Filtered squad: ${availableSquad.length} available players out of ${allSquad.length} total`);

    // Clean up team data (remove the nested leagues object)
    const cleanTeam = {
      id: team.id,
      name: team.name,
      acronym: team.acronym,
      logo_url: team.logo_url,
      budget: team.budget,
      squad: allSquad, // Include all players but mark injured ones
      league_id: team.league_id
    };

    console.log("Successfully fetched team data");
    return NextResponse.json({
      success: true,
      team: cleanTeam,
      league: league
    });

  } catch (error: any) {
    console.error("Fetch team data API route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 