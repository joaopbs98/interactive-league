import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
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
    const teamId = searchParams.get('teamId');
    const mode = searchParams.get('mode'); // 'history' for past resolved FAs
    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId required' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: league } = await serviceSupabase
      .from('leagues')
      .select('season, fa_deadline, fa_pool_status')
      .eq('id', leagueId)
      .single();

    const season = league?.season || 1;

    if (mode === 'history') {
      const { data: wonBids } = await serviceSupabase
        .from('free_agent_bids')
        .select('player_id, team_id, salary, years, created_at')
        .eq('league_id', leagueId)
        .eq('season', season)
        .eq('status', 'won')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!wonBids?.length) {
        return NextResponse.json({ success: true, data: [] });
      }
      const playerIds = [...new Set(wonBids.map((b) => b.player_id))];
      const teamIds = [...new Set(wonBids.map((b) => b.team_id))];
      const [playersRes, teamsRes] = await Promise.all([
        serviceSupabase.from('league_players').select('player_id, player_name').eq('league_id', leagueId).in('player_id', playerIds),
        serviceSupabase.from('teams').select('id, name, acronym').in('id', teamIds),
      ]);
      const playerMap = new Map((playersRes.data || []).map((p) => [p.player_id, p]));
      const teamMap = new Map((teamsRes.data || []).map((t) => [t.id, t]));
      const history = wonBids.map((b) => ({
        player_id: b.player_id,
        player_name: playerMap.get(b.player_id)?.player_name ?? b.player_id,
        winner_team: teamMap.get(b.team_id)?.name ?? b.team_id,
        winner_acronym: teamMap.get(b.team_id)?.acronym,
        salary: b.salary,
        years: b.years,
        resolved_at: b.created_at,
      }));
      return NextResponse.json({ success: true, data: history });
    }

    const { data: poolRows } = await serviceSupabase
      .from('free_agent_pool')
      .select('player_id, deadline')
      .eq('league_id', leagueId)
      .eq('season', season);
    const poolPlayerIds = new Set((poolRows || []).map((r: { player_id: string }) => r.player_id));
    const poolDeadlineMap = new Map((poolRows || []).map((r: { player_id: string; deadline: string | null }) => [r.player_id, r.deadline]));
    const usePool = poolPlayerIds.size > 0;
    const poolConfirmed = league?.fa_pool_status === 'confirmed';

    if (usePool && !poolConfirmed) {
      return NextResponse.json({ success: true, data: [], fa_deadline: null });
    }

    let query = serviceSupabase
      .from('league_players')
      .select('*')
      .eq('league_id', leagueId)
      .is('team_id', null)
      .order('rating', { ascending: false })
      .limit(100);
    if (usePool) {
      query = query.in('player_id', Array.from(poolPlayerIds));
    }
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let enriched = data || [];
    enriched = enriched.map((a: { player_id: string }) => ({
      ...a,
      deadline: poolDeadlineMap.get(a.player_id) ?? null,
    }));
    if (teamId && enriched.length > 0) {
      const { data: teamCheck } = await serviceSupabase
        .from('teams')
        .select('id')
        .eq('id', teamId)
        .eq('user_id', user.id)
        .single();
      if (teamCheck) {
        const { data: bids } = await serviceSupabase
        .from('free_agent_bids')
        .select('player_id, salary, years, guaranteed_pct, no_trade_clause')
        .eq('league_id', leagueId)
        .eq('team_id', teamId)
        .eq('season', season)
        .eq('status', 'pending');

        const bidMap = new Map((bids || []).map((b: { player_id: string }) => [b.player_id, b]));
        enriched = enriched.map((a: { player_id: string }) => ({
          ...a,
          myBid: bidMap.get(a.player_id) || null,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      data: enriched,
      fa_deadline: league?.fa_deadline ?? null,
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
    const { action, leagueId, teamId, playerId, salary, years, bonus } = body;

    if (!leagueId) {
      return NextResponse.json({ success: false, error: 'leagueId required' }, { status: 400 });
    }
    if (action !== 'clear' && !teamId) {
      return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Phase check
    const { data: league } = await serviceSupabase
      .from('leagues')
      .select('status, season')
      .eq('id', leagueId)
      .single();

    if (league?.status === 'IN_SEASON') {
      return NextResponse.json({ success: false, error: 'Cannot sign players during the season' }, { status: 400 });
    }

    if (action === 'clear') {
      const isHost = await isLeagueHost(serviceSupabase, leagueId, user.id);
      if (!isHost) {
        return NextResponse.json({ success: false, error: 'Host only' }, { status: 403 });
      }
      const { data: leagueRow } = await serviceSupabase
        .from('leagues')
        .select('season')
        .eq('id', leagueId)
        .single();
      const { error: delErr } = await serviceSupabase
        .from('free_agent_bids')
        .delete()
        .eq('league_id', leagueId)
        .eq('season', leagueRow?.season || 1)
        .eq('status', 'pending');
      if (delErr) {
        return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'All pending bids cleared' });
    }

    if (action === 'placeBid') {
      const { playerId, signingBonus, salaryPerYear, contractYears, guaranteedPct, noTradeClause } = body;
      if (!playerId || signingBonus == null || salaryPerYear == null || contractYears == null) {
        return NextResponse.json({ success: false, error: 'playerId, signingBonus, salaryPerYear, contractYears required' }, { status: 400 });
      }
      const bonus = Math.max(0, parseInt(String(signingBonus), 10) || 0);
      const salary = Math.max(0, parseInt(String(salaryPerYear), 10) || 0);
      const years = Math.max(1, Math.min(2, parseInt(String(contractYears), 10) || 2));
      const guaranteed = years === 1 ? 1 : Math.min(1, Math.max(0, parseFloat(String(guaranteedPct ?? 1)) || 1));

      if (salary % 100000 !== 0) {
        return NextResponse.json({ success: false, error: 'Salary must be in $100,000 increments' }, { status: 400 });
      }

      const { data: poolRow } = await serviceSupabase
        .from('free_agent_pool')
        .select('deadline')
        .eq('league_id', leagueId)
        .eq('season', league?.season || 1)
        .eq('player_id', playerId)
        .single();
      const deadline = poolRow?.deadline ? new Date(poolRow.deadline) : null;
      const now = new Date();
      if (deadline && now > deadline) {
        return NextResponse.json({ success: false, error: 'Bid deadline for this player has passed' }, { status: 400 });
      }
      if (deadline) {
        const oneMin = 60 * 1000;
        if (deadline.getTime() - now.getTime() <= oneMin) {
          const newDeadline = new Date(now.getTime() + oneMin);
          await serviceSupabase
            .from('free_agent_pool')
            .update({ deadline: newDeadline.toISOString() })
            .eq('league_id', leagueId)
            .eq('season', league?.season || 1)
            .eq('player_id', playerId);
        }
      }

      const { count } = await serviceSupabase
        .from('league_players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      if ((count || 0) >= 23) {
        return NextResponse.json({ success: false, error: 'Roster is full (23 players max)' }, { status: 400 });
      }

      const { data: faPlayer } = await serviceSupabase
        .from('league_players')
        .select('id, player_id')
        .eq('league_id', leagueId)
        .eq('player_id', playerId)
        .is('team_id', null)
        .single();

      if (!faPlayer) {
        return NextResponse.json({ success: false, error: 'Player is not a free agent' }, { status: 400 });
      }

      const { data: team } = await serviceSupabase
        .from('teams')
        .select('budget')
        .eq('id', teamId)
        .single();

      const { data: currentWages } = await serviceSupabase.rpc('calculate_team_wages', { p_team_id: teamId });
      const wageBillAfter = (currentWages ?? 0) + salary;
      if (wageBillAfter > (team?.budget ?? 0)) {
        return NextResponse.json({ success: false, error: 'Wage bill would exceed available budget' }, { status: 400 });
      }

      await serviceSupabase
        .from('free_agent_bids')
        .delete()
        .eq('league_id', leagueId)
        .eq('player_id', playerId)
        .eq('team_id', teamId)
        .eq('season', league?.season || 1);

      const { error: bidErr } = await serviceSupabase
        .from('free_agent_bids')
        .insert({
          league_id: leagueId,
          player_id: playerId,
          team_id: teamId,
          bonus: 0,
          salary,
          years,
          guaranteed_pct: guaranteed,
          no_trade_clause: !!noTradeClause,
          season: league?.season || 1,
          status: 'pending',
        });

      if (bidErr) {
        return NextResponse.json({ success: false, error: bidErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Bid placed' });
    }

    if (action === 'sign') {
      if (!playerId) {
        return NextResponse.json({ success: false, error: 'playerId required' }, { status: 400 });
      }

      // Roster cap check
      const { count } = await serviceSupabase
        .from('league_players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      if ((count || 0) >= 23) {
        return NextResponse.json({ success: false, error: 'Roster is full (23 players max)' }, { status: 400 });
      }

      // Check player is a free agent in this league
      const { data: player } = await serviceSupabase
        .from('league_players')
        .select('*')
        .eq('league_id', leagueId)
        .eq('player_id', playerId)
        .is('team_id', null)
        .single();

      if (!player) {
        return NextResponse.json({ success: false, error: 'Player is not a free agent' }, { status: 400 });
      }

      const finalSalary = salary || Math.max(500000, (player.rating - 50) * 100000);
      const finalYears = years || 3;
      const finalBonus = bonus || 0;

      // Check budget for bonus
      const { data: team } = await serviceSupabase
        .from('teams')
        .select('budget')
        .eq('id', teamId)
        .single();

      if ((team?.budget || 0) < finalBonus) {
        return NextResponse.json({ success: false, error: 'Insufficient budget for signing bonus' }, { status: 400 });
      }

      // Wage feasibility (per final_doc 3.2): total salaries must not exceed available budget
      const { data: currentWages } = await serviceSupabase.rpc('calculate_team_wages', { p_team_id: teamId });
      const wageBillAfter = (currentWages ?? 0) + finalSalary;
      if (wageBillAfter > (team?.budget ?? 0)) {
        return NextResponse.json({ success: false, error: 'Wage bill would exceed available budget' }, { status: 400 });
      }

      // Sign the player
      await serviceSupabase
        .from('league_players')
        .update({ team_id: teamId })
        .eq('id', player.id);

      // Create contract
      await serviceSupabase
        .from('contracts')
        .insert({
          player_id: playerId,
          team_id: teamId,
          wage: finalSalary,
          signing_bonus: finalBonus,
          start_season: league?.season || 1,
          years: finalYears,
          status: 'active',
        });

      // Deduct signing bonus via ledger
      if (finalBonus > 0) {
        await serviceSupabase.rpc('write_finance_entry', {
          p_team_id: teamId,
          p_league_id: leagueId,
          p_amount: -finalBonus,
          p_reason: 'Signing Bonus',
          p_description: `Signing bonus for ${player.player_name}`,
          p_season: league?.season || 1,
        });
      }

      // Audit
      await serviceSupabase.rpc('write_audit_log', {
        p_league_id: leagueId,
        p_action: 'sign_free_agent',
        p_actor_id: user.id,
        p_payload: { player_id: playerId, player_name: player.player_name, salary: finalSalary, years: finalYears, bonus: finalBonus },
      });

      return NextResponse.json({
        success: true,
        data: { player_name: player.player_name, salary: finalSalary, years: finalYears },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Free agents API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
