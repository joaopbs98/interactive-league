import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    console.log('League Seasons API: Starting GET request');
    console.log('League Seasons API: Request URL:', request.url);
    const supabase = await createClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    
    console.log('League Seasons API: Parameters:', { leagueId });
    console.log('League Seasons API: All search params:', Object.fromEntries(searchParams.entries()));

    if (!leagueId) {
      console.log('League Seasons API: No leagueId provided');
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    // Get league information including active season
    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .select(`
        id,
        name,
        active_season,
        season
      `)
      .eq('id', leagueId)
      .single();

    console.log('League Seasons API: Query result:', { leagueData, leagueError });

    if (leagueError) {
      console.error('League Seasons API: Error fetching league:', leagueError);
      throw leagueError;
    }

    return NextResponse.json({ 
      data: leagueData,
      success: true 
    });

  } catch (error) {
    console.error('League Seasons API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch league season',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('League Seasons API: Starting POST request');
    const supabase = await createClient();
    
    const body = await request.json();
    const { action, leagueId, ...params } = body;

    console.log('League Seasons API: Action:', action);

    let result: any = null;

    switch (action) {
      case 'advance_season': {
        // Fetch current league to get season values
        const { data: currentLeague, error: fetchErr } = await supabase
          .from('leagues')
          .select('active_season, season')
          .eq('id', leagueId)
          .single();
        if (fetchErr || !currentLeague) throw fetchErr || new Error('League not found');

        const newActiveSeason = (currentLeague.active_season ?? currentLeague.season ?? 1) + 1;
        const newSeason = (currentLeague.season ?? 1) + 1;

        const { data: advanceData, error: advanceError } = await supabase
          .from('leagues')
          .update({ active_season: newActiveSeason, season: newSeason })
          .eq('id', leagueId)
          .select()
          .single();

        if (advanceError) throw advanceError;

        // Update pack weights for the new season
        const { error: weightsError } = await supabase
          .rpc('update_pack_weights_for_season', {
            p_league_id: leagueId,
            p_season: newActiveSeason
          });

        if (weightsError) {
          console.warn('Failed to update pack weights:', weightsError);
        }

        result = advanceData;
        break;
      }

      case 'set_season':
        // Set specific season
        const { data: setData, error: setError } = await supabase
          .from('leagues')
          .update({ 
            active_season: params.season,
            season: params.season
          })
          .eq('id', leagueId)
          .select()
          .single();

        if (setError) throw setError;
        
        // Update pack weights for the specified season
        const { error: setWeightsError } = await supabase
          .rpc('update_pack_weights_for_season', {
            p_league_id: leagueId,
            p_season: params.season
          });

        if (setWeightsError) {
          console.warn('Failed to update pack weights:', setWeightsError);
        }

        result = setData;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    console.error('League Seasons API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform season action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 