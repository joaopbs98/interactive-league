import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isLeagueHost } from "@/lib/hostUtils";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    console.log('Injuries API: Starting GET request');
    const supabase = await createClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    
    console.log('Injuries API: Parameters:', { leagueId });

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    // Get all injuries for the league
    console.log('Injuries API: Querying injuries table');
    const { data: injuriesData, error: injuriesError } = await supabase
      .from('injuries')
      .select(`
        id,
        player_id,
        team_id,
        league_id,
        type,
        description,
        games_remaining,
        return_date,
        created_at
      `)
      .eq('league_id', leagueId)
      .gt('games_remaining', 0)
      .order('created_at', { ascending: false });
    
    console.log('Injuries API: Query result:', { injuriesData, injuriesError });

    if (injuriesError) {
      console.error('Injuries API: Error fetching injuries:', injuriesError);
      throw injuriesError;
    }

    console.log('Injuries API: Found injuries:', injuriesData?.length || 0);

    return NextResponse.json({ 
      data: injuriesData || [],
      success: true 
    });

  } catch (error) {
    console.error('Injuries API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch injuries',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Injuries API: Starting POST request');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { team_id, player_id, type, description, games_remaining, return_date } = body;

    console.log('Injuries API: Creating injury:', { team_id, player_id, type, games_remaining });

    // Validate required fields
    if (!team_id || !player_id || !type || !games_remaining) {
      return NextResponse.json({ 
        error: 'Missing required fields: team_id, player_id, type, games_remaining' 
      }, { status: 400 });
    }

    // Validate type
    if (!['injury', 'suspension'].includes(type)) {
      return NextResponse.json({ 
        error: 'Type must be either "injury" or "suspension"' 
      }, { status: 400 });
    }

    // Check if player is already injured/suspended
    const { data: existingInjury, error: checkError } = await supabase
      .from('injuries')
      .select('id')
      .eq('player_id', player_id)
      .gt('games_remaining', 0)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Injuries API: Error checking existing injury:', checkError);
      throw checkError;
    }

    if (existingInjury) {
      return NextResponse.json({ 
        error: 'Player is already injured or suspended' 
      }, { status: 400 });
    }

    // Get the league_id for the team
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('league_id')
      .eq('id', team_id)
      .single();

    if (teamError || !teamData) {
      return NextResponse.json({ 
        error: 'Team not found' 
      }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, teamData.league_id, user.id);
    if (!isHost) {
      return NextResponse.json({ error: 'Only the league host can add injuries or suspensions' }, { status: 403 });
    }

    // Create the injury
    const { data: newInjury, error: insertError } = await supabase
      .from('injuries')
      .insert({
        player_id,
        team_id,
        league_id: teamData.league_id,
        type,
        description: description || null,
        games_remaining,
        return_date: return_date || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Injuries API: Error creating injury:', insertError);
      throw insertError;
    }

    console.log('Injuries API: Created injury:', newInjury);

    return NextResponse.json({ 
      data: newInjury,
      success: true 
    });

  } catch (error) {
    console.error('Injuries API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to create injury',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('Injuries API: Starting DELETE request');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const injuryId = searchParams.get('id');

    console.log('Injuries API: Deleting injury:', injuryId);

    if (!injuryId) {
      return NextResponse.json({ error: 'Injury ID is required' }, { status: 400 });
    }

    const { data: injury, error: injuryError } = await supabase
      .from('injuries')
      .select('league_id')
      .eq('id', injuryId)
      .single();

    if (injuryError || !injury) {
      return NextResponse.json({ error: 'Injury not found' }, { status: 404 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, injury.league_id, user.id);
    if (!isHost) {
      return NextResponse.json({ error: 'Only the league host can remove injuries or suspensions' }, { status: 403 });
    }

    // Delete the injury
    const { error: deleteError } = await supabase
      .from('injuries')
      .delete()
      .eq('id', injuryId);

    if (deleteError) {
      console.error('Injuries API: Error deleting injury:', deleteError);
      throw deleteError;
    }

    console.log('Injuries API: Deleted injury:', injuryId);

    return NextResponse.json({ 
      success: true 
    });

  } catch (error) {
    console.error('Injuries API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete injury',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 