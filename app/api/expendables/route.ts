import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    console.log('Expendables API called with teamId:', teamId);
    
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Get current user
    console.log('Getting user from auth for expendables...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth result for expendables:', { user: user?.id, error: authError });
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify team ownership and get league_id
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, user_id, league_id, expendables')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const playerIds = (team.expendables || []) as string[];
    if (playerIds.length === 0) {
      return NextResponse.json({ success: true, data: { expendables: [] } });
    }

    // Enrich with full player data from league_players (has player_id, player_name, positions, rating, full_name, image)
    const { data: leaguePlayers } = await supabase
      .from('league_players')
      .select('player_id, player_name, positions, rating, full_name, image')
      .eq('team_id', teamId)
      .in('player_id', playerIds);

    const enriched = (leaguePlayers || []).map((lp) => ({
      player_id: lp.player_id,
      name: lp.player_name || lp.full_name || 'Unknown',
      positions: lp.positions || '',
      overall_rating: lp.rating ?? 0,
      image: lp.image,
    }));

    return NextResponse.json({ 
      success: true,
      data: { expendables: enriched }
    });

  } catch (error) {
    console.error('Expendables API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 