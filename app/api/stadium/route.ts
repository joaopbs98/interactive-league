import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { stadiumAttendance, stadiumRevenue } from '@/lib/stadiumLogic';
import { isLeagueHost } from '@/lib/hostUtils';

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    const teamId = searchParams.get('teamId');

    if (!leagueId || !teamId) {
      return NextResponse.json({ success: false, error: 'leagueId and teamId required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const { data: team, error } = await serviceSupabase
      .from('teams')
      .select('id, name, capacity, visitor_focus, confirm_vf, seasonal_performance, sc_appearance, league_id')
      .eq('id', teamId)
      .eq('league_id', leagueId)
      .single();

    if (error || !team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    const capacity = team.capacity ?? 40000;
    const visitorFocus = team.visitor_focus ?? '';
    const seasonalPerformance = team.seasonal_performance ?? '';

    const attendance = stadiumAttendance(capacity, visitorFocus, seasonalPerformance);

    const { data: league } = await serviceSupabase
      .from('leagues')
      .select('season, total_rounds')
      .eq('id', leagueId)
      .single();

    const { data: standing } = await serviceSupabase
      .from('standings')
      .select('played')
      .eq('league_id', leagueId)
      .eq('team_id', teamId)
      .eq('season', league?.season ?? 1)
      .single();

    const totalGamesPlayed = standing?.played ?? (league?.total_rounds ?? 30);
    const revenue = stadiumRevenue(attendance, visitorFocus, totalGamesPlayed);

    return NextResponse.json({
      success: true,
      data: {
        ...team,
        capacity,
        attendance,
        revenue,
        totalGamesPlayed,
      },
    });
  } catch (error: any) {
    console.error('Stadium API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, teamId, visitor_focus, confirm_vf, seasonal_performance, sc_appearance, capacity } = body;

    if (!leagueId || !teamId) {
      return NextResponse.json({ success: false, error: 'leagueId and teamId required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();
    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);

    // Verify team ownership (for team-scoped fields) or host (for host-scoped fields)
    const { data: teamCheck } = await serviceSupabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .eq('league_id', leagueId)
      .single();

    if (!teamCheck) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    const isOwner = teamCheck.user_id === user.id;

    const updates: Record<string, unknown> = {};
    // Team owner can set: visitor_focus, confirm_vf (for their own team)
    if (isOwner) {
      if (typeof visitor_focus === 'string') updates.visitor_focus = visitor_focus;
      if (typeof confirm_vf === 'boolean') updates.confirm_vf = confirm_vf;
    }
    // Host can set: seasonal_performance, sc_appearance, capacity (for any team)
    if (isHost) {
      if (typeof seasonal_performance === 'string') updates.seasonal_performance = seasonal_performance;
      if (typeof sc_appearance === 'boolean') updates.sc_appearance = sc_appearance;
      if (typeof capacity === 'number' && capacity > 0) updates.capacity = capacity;
    }

    if (Object.keys(updates).length === 0) {
      if (!isOwner && !isHost) {
        return NextResponse.json({ success: false, error: 'Only team owner or host can update stadium' }, { status: 403 });
      }
      return NextResponse.json({ success: false, error: 'No valid updates' }, { status: 400 });
    }

    const { error } = await serviceSupabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .eq('league_id', leagueId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updates });
  } catch (error: any) {
    console.error('Stadium PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
