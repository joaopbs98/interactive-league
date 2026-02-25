import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isLeagueHost } from '@/lib/hostUtils';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId required' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: league } = await serviceSupabase
      .from('leagues')
      .select('season, status, draft_active')
      .eq('id', leagueId)
      .single();

    if (!league) {
      return NextResponse.json({ success: false, error: 'League not found' }, { status: 404 });
    }

    // Draft picks (order, current pick, used, bonus)
    const { data: picks, error: picksError } = await serviceSupabase
      .from('draft_picks')
      .select('id, pick_number, is_used, player_id, current_owner_team_id, team_id, season, bonus')
      .eq('league_id', leagueId)
      .eq('season', league.season)
      .order('pick_number', { ascending: true });

    if (picksError) {
      return NextResponse.json({ success: false, error: picksError.message }, { status: 500 });
    }

    const { data: draftPoolRows } = await serviceSupabase
      .from('draft_pool')
      .select('player_id')
      .eq('league_id', leagueId)
      .eq('season', league.season);
    const draftPoolIds = new Set((draftPoolRows || []).map((r: { player_id: string }) => r.player_id));
    const useDraftPool = draftPoolIds.size > 0;

    let poolQuery = serviceSupabase
      .from('league_players')
      .select('id, player_id, player_name, full_name, positions, rating, image')
      .eq('league_id', leagueId)
      .is('team_id', null)
      .order('rating', { ascending: false })
      .limit(100);
    if (useDraftPool) {
      poolQuery = poolQuery.in('player_id', Array.from(draftPoolIds));
    }
    const { data: pool, error: poolError } = await poolQuery;

    if (poolError) {
      return NextResponse.json({ success: false, error: poolError.message }, { status: 500 });
    }

    const currentPick = (picks || []).find((p: { is_used: boolean }) => !p.is_used);
    const userTeamId = (await serviceSupabase
      .from('teams')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single()).data?.id;

    const ownerTeamId = currentPick?.current_owner_team_id ?? currentPick?.team_id;
    const isUserTurn = ownerTeamId === userTeamId;

    const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);

    return NextResponse.json({
      success: true,
      data: {
        league: { season: league.season, status: league.status, draftActive: league.draft_active },
        picks: picks || [],
        pool: pool || [],
        currentPick: currentPick || null,
        isUserTurn: !!isUserTurn,
        userTeamId: userTeamId || null,
        isHost: !!isHost,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { draftPickId, playerId, claimOnly } = body;

    if (!draftPickId) {
      return NextResponse.json({ success: false, error: 'draftPickId required' }, { status: 400 });
    }

    // For merch_pct and upgrade_ticket, playerId is optional (claim without player)
    const selectedPlayerId = claimOnly ? null : playerId;
    if (!claimOnly && !playerId) {
      return NextResponse.json({ success: false, error: 'playerId required for player picks' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await serviceSupabase.rpc('make_draft_pick', {
      p_draft_pick_id: draftPickId,
      p_selected_player_id: selectedPlayerId ?? '',
      p_actor_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
