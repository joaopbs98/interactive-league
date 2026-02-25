import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isLeagueHost } from '@/lib/hostUtils';

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, leagueId, ...params } = body;

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'League ID required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();

    switch (action) {
      case 'generate_schedule': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const { data: validation } = await serviceSupabase.rpc('validate_league_registration', {
          p_league_id: leagueId
        });
        if (validation && !validation.valid && validation.invalid_teams?.length > 0) {
          const msg = validation.invalid_teams
            .map((t: { team_name: string; errors: string[] }) => `${t.team_name}: ${(t.errors || []).join('; ')}`)
            .join('. ');
          return NextResponse.json({ success: false, error: `Registration invalid: ${msg}` }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('generate_schedule', {
          p_league_id: leagueId,
          p_season: league?.season || 1
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        await serviceSupabase
          .from('leagues')
          .update({ status: 'IN_SEASON' })
          .eq('id', leagueId);

        return NextResponse.json({ success: true, data });
      }

      case 'simulate_matchday': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('status')
          .eq('id', leagueId)
          .single();

        if (league?.status !== 'IN_SEASON') {
          return NextResponse.json({ success: false, error: 'League must be IN_SEASON' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('simulate_matchday', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'simulate_matchday_competition': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const competitionType = body.competitionType as string;
        if (!['ucl', 'uel', 'uecl'].includes(competitionType)) {
          return NextResponse.json({ success: false, error: 'competitionType must be ucl, uel, or uecl' }, { status: 400 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('status')
          .eq('id', leagueId)
          .single();

        if (league?.status !== 'IN_SEASON') {
          return NextResponse.json({ success: false, error: 'League must be IN_SEASON' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('simulate_matchday_competition', {
          p_league_id: leagueId,
          p_competition_type: competitionType,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'end_season': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('end_season', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data?.success) {
          await serviceSupabase.rpc('update_league_stock_prices', { p_league_id: leagueId });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'recalculate_compindex': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { error } = await serviceSupabase.rpc('update_league_compindex', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: { message: 'CompIndex recalculated' } });
      }

      case 'validate_registration': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('validate_league_registration', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'apply_fine': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { teamId, amount, reason } = params;
        if (!teamId || !amount || !reason) {
          return NextResponse.json({ success: false, error: 'teamId, amount, and reason required' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('apply_fine', {
          p_league_id: leagueId,
          p_team_id: teamId,
          p_amount: amount,
          p_reason: reason,
          p_actor_id: user.id
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'generate_injuries': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('generate_random_injuries', {
          p_league_id: leagueId,
          p_actor_id: user.id,
          p_count: params.count || 3
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'auto_starter_squad': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { teamId } = params;
        if (!teamId) {
          return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const { data, error } = await serviceSupabase.rpc('auto_starter_squad', {
          p_team_id: teamId,
          p_league_id: leagueId,
          p_season: league?.season || 1
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'generate_all_starter_squads': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const { data: leagueTeams } = await serviceSupabase
          .from('teams')
          .select('id')
          .eq('league_id', leagueId);

        const results: { teamId: string; success: boolean; error?: string; action?: string }[] = [];
        for (const team of leagueTeams || []) {
          const { count } = await serviceSupabase
            .from('league_players')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);

          const playerCount = count || 0;

          if (playerCount === 0) {
            const { error } = await serviceSupabase.rpc('auto_starter_squad', {
              p_team_id: team.id,
              p_league_id: leagueId,
              p_season: league?.season || 1
            });
            results.push({ teamId: team.id, success: !error, error: error?.message, action: 'generated' });
          } else if (playerCount < 21) {
            const { data, error } = await serviceSupabase.rpc('top_up_squad_to_21', {
              p_team_id: team.id,
              p_league_id: leagueId
            });
            const r = data as { success?: boolean; added?: number };
            results.push({
              teamId: team.id,
              success: !error && (r?.success ?? true),
              error: error?.message,
              action: 'topped_up'
            });
          }
        }

        return NextResponse.json({
          success: true,
          data: { generated: results.filter(r => r.success).length, total: results.length, results }
        });
      }

      case 'start_draft': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('start_draft', {
          p_league_id: leagueId
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'insert_result': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { matchId, homeScore, awayScore } = params;
        if (!matchId || homeScore == null || awayScore == null) {
          return NextResponse.json({ success: false, error: 'matchId, homeScore, awayScore required' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('insert_match_result', {
          p_match_id: matchId,
          p_home_score: parseInt(String(homeScore), 10),
          p_away_score: parseInt(String(awayScore), 10),
          p_actor_user_id: user.id,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'set_competition_result': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { teamId, season, stage } = params;
        if (!teamId || !stage) {
          return NextResponse.json({ success: false, error: 'teamId and stage required' }, { status: 400 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ?? league?.season ?? 1;

        const { data, error } = await serviceSupabase.rpc('set_team_competition_result', {
          p_team_id: teamId,
          p_league_id: leagueId,
          p_season: targetSeason,
          p_stage: stage,
          p_actor_user_id: user.id,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'update_draft_pick_bonus': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { draftPickId, bonus } = params;
        if (!draftPickId || !bonus) {
          return NextResponse.json({ success: false, error: 'draftPickId and bonus required' }, { status: 400 });
        }

        const { data, error } = await serviceSupabase.rpc('update_draft_pick_bonus', {
          p_draft_pick_id: draftPickId,
          p_bonus: bonus,
          p_actor_user_id: user.id,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'resolve_free_agency': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data, error } = await serviceSupabase.rpc('resolve_free_agency', {
          p_league_id: leagueId,
        });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: { assigned: data?.assigned ?? 0, skipped: data?.skipped ?? 0 },
        });
      }

      case 'add_mock_teams': {
        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id!);
        if (!isHost) {
          return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
        }

        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season, max_teams')
          .eq('id', leagueId)
          .single();

        const maxTeams = league?.max_teams ?? 20;
        const { count } = await serviceSupabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', leagueId);

        const slots = maxTeams - (count || 0);
        if (slots <= 0) {
          return NextResponse.json(
            { success: false, error: `League already has ${count} teams (max ${maxTeams})` },
            { status: 400 }
          );
        }

        const season = league?.season || 1;
        const created: string[] = [];

        for (let n = 1; n <= slots; n++) {
          const { data: team, error: teamErr } = await serviceSupabase
            .from('teams')
            .insert({
              league_id: leagueId,
              user_id: null,
              name: `Mock Team ${n}`,
              acronym: `MT${n}`,
              budget: 0,
            })
            .select('id')
            .single();

          if (teamErr || !team) {
            console.error('add_mock_teams: failed to create team', teamErr);
            continue;
          }

          const { error: squadErr } = await serviceSupabase.rpc('auto_starter_squad', {
            p_team_id: team.id,
            p_league_id: leagueId,
            p_season: season,
          });

          if (squadErr) {
            console.error('add_mock_teams: auto_starter_squad failed for', team.id, squadErr);
          }
          created.push(team.id);
        }

        return NextResponse.json({
          success: true,
          data: { added: created.length, message: `Added ${created.length} mock team(s)` },
        });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Game API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
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
    const type = searchParams.get('type');

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();

    switch (type) {
      case 'standings': {
        const season = searchParams.get('season');
        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ? parseInt(season) : league?.season || 1;

        const { data, error } = await serviceSupabase
          .from('standings')
          .select(`
            *,
            team:teams(id, name, acronym, logo_url)
          `)
          .eq('league_id', leagueId)
          .eq('season', targetSeason)
          .order('points', { ascending: false })
          .order('goal_diff', { ascending: false })
          .order('goals_for', { ascending: false });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'competition_standings': {
        const season = searchParams.get('season');
        const competitionType = searchParams.get('competitionType'); // ucl | uel | uecl
        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ? parseInt(season) : league?.season || 1;

        let query = serviceSupabase
          .from('competition_standings')
          .select(`
            *,
            team:teams(id, name, acronym, logo_url)
          `)
          .eq('league_id', leagueId)
          .eq('season', targetSeason);

        if (competitionType && ['ucl', 'uel', 'uecl'].includes(competitionType)) {
          query = query.eq('competition_type', competitionType);
        }

        const { data, error } = await query
          .order('group_name', { ascending: true })
          .order('points', { ascending: false })
          .order('goal_diff', { ascending: false })
          .order('goals_for', { ascending: false });

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'schedule': {
        const season = searchParams.get('season');
        const round = searchParams.get('round');
        const { data: league } = await serviceSupabase
          .from('leagues')
          .select('season, current_round, total_rounds')
          .eq('id', leagueId)
          .single();

        const targetSeason = season ? parseInt(season) : league?.season || 1;

        let query = serviceSupabase
          .from('matches')
          .select(`
            *,
            home_team:teams!matches_home_team_id_fkey(id, name, acronym, logo_url),
            away_team:teams!matches_away_team_id_fkey(id, name, acronym, logo_url)
          `)
          .eq('league_id', leagueId)
          .eq('season', targetSeason)
          .order('round', { ascending: true });

        if (round) {
          query = query.eq('round', parseInt(round));
        }

        const { data, error } = await query;

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data,
          meta: {
            current_round: league?.current_round,
            total_rounds: league?.total_rounds
          }
        });
      }

      case 'audit_logs': {
        const { data, error } = await serviceSupabase
          .from('audit_logs')
          .select('*')
          .eq('league_id', leagueId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
      }

      case 'league_info': {
        const { data: leagueRow, error } = await serviceSupabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();

        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        const season = leagueRow?.season ?? 1;
        const { count: unsimulatedCount } = await serviceSupabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', leagueId)
          .eq('season', season)
          .eq('match_status', 'scheduled');

        const [uclRes, uelRes, ueclRes] = await Promise.all([
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'ucl'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'uel'),
          serviceSupabase.from('matches').select('id', { count: 'exact', head: true }).eq('league_id', leagueId).eq('season', season).eq('competition_type', 'uecl'),
        ]);

        const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);

        return NextResponse.json({
          success: true,
          data: {
            ...leagueRow,
            unsimulated_match_count: unsimulatedCount ?? 0,
            has_ucl_matches: (uclRes.count ?? 0) > 0,
            has_uel_matches: (uelRes.count ?? 0) > 0,
            has_uecl_matches: (ueclRes.count ?? 0) > 0,
            is_host: isHost,
          },
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'type parameter required (standings, schedule, audit_logs, league_info)' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Game API GET error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
