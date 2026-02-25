import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    console.log('Teams API: Starting GET request');
    const supabase = await createClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    
    console.log('Teams API: Parameters:', { leagueId });

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    // Get all teams for the league
    console.log('Teams API: Querying teams table');
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        acronym
      `)
      .eq('league_id', leagueId)
      .order('name', { ascending: true });
    
    console.log('Teams API: Query result:', { teamsData, teamsError });

    if (teamsError) {
      console.error('Teams API: Error fetching teams:', teamsError);
      throw teamsError;
    }

    console.log('Teams API: Found teams:', teamsData?.length || 0);

    return NextResponse.json({ 
      data: teamsData || [],
      success: true 
    });

  } catch (error) {
    console.error('Teams API: Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch teams',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 