import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    console.log('League Players API: Starting GET request');
    const supabase = await createClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const teamId = searchParams.get('teamId');
    const type = searchParams.get('type') || 'all';
    
    console.log('League Players API: Parameters:', { leagueId, teamId, type });

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    let query = supabase
      .from('league_players')
      .select(`
        id,
        player_id,
        player_name,
        positions,
        rating,
        team_id,
        created_at
      `)
      .eq('league_id', leagueId);

    // Filter by team if specified
    if (teamId) {
      // When teamId is provided, get players that belong to that team
      query = query.eq('team_id', teamId);
    } else if (type === 'available') {
      // Only show available players (not assigned to any team)
      query = query.is('team_id', null);
    }

    const { data: playersData, error: playersError } = await query.order('rating', { ascending: false });

    console.log('League Players API: Query result:', { playersData, playersError });

    if (playersError) {
      console.error('League Players API: Error fetching players:', playersError);
      throw playersError;
    }

    console.log('League Players API: Found players:', playersData?.length || 0);

    return NextResponse.json({ 
      data: playersData || [],
      success: true 
    });

  } catch (error) {
    console.error('League Players API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch league players',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('League Players API: Starting POST request');
    const supabase = await createClient();
    
    const body = await request.json();
    const { action, leagueId, ...params } = body;

    console.log('League Players API: Action:', action);

    let result: any = null;

    switch (action) {
      case 'generate_players':
        // Generate league-specific player pool
        const { data: generateData, error: generateError } = await supabase
          .rpc('generate_league_players', {
            p_league_id: leagueId,
            p_player_count: params.playerCount || 1000
          });

        if (generateError) throw generateError;
        result = { message: 'League players generated successfully' };
        break;

      case 'generate_starter_squad':
        // Generate starter squad for a team
        const { data: squadData, error: squadError } = await supabase
          .rpc('generate_starter_squad', {
            p_team_id: params.teamId,
            p_league_id: leagueId
          });

        if (squadError) throw squadError;
        result = squadData;
        break;

      case 'clear_all_squads':
        // Clear all squads in the league (remove players from teams and reset formation data)
        console.log('League Players API: Clearing squads for league:', leagueId);
        
        // First, get all teams in this league
        const { data: teams, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .eq('league_id', leagueId);

        if (teamsError) throw teamsError;
        
        console.log('League Players API: Found teams to clear:', teams?.length || 0);

        // Clear all players from teams in league_players table
        const { error: clearPlayersError } = await supabase
          .from('league_players')
          .update({ team_id: null })
          .eq('league_id', leagueId);

        if (clearPlayersError) throw clearPlayersError;

        // Clear squad, starting_lineup, bench, and reserves fields for all teams in the league
        const { data: clearData, error: clearError } = await supabase
          .from('teams')
          .update({ 
            squad: null,
            starting_lineup: [],
            bench: [],
            reserves: []
          })
          .eq('league_id', leagueId);

        if (clearError) throw clearError;
        
        console.log('League Players API: Cleared squads for teams:', teams?.map(t => t.name));
        result = { message: `All squads cleared successfully for ${teams?.length || 0} teams` };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    console.error('League Players API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform league players action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 