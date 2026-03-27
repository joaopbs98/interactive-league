import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const LOAN_AMOUNT = 60_000_000;
const REPAY_TOTAL = 75_000_000; // 25% interest
const REPAY_INSTALLMENT = Math.ceil(REPAY_TOTAL / 3);

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
    const { data: loans, error } = await serviceSupabase
      .from('loans')
      .select('*')
      .eq('league_id', leagueId)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: loans || [] });
  } catch (error: any) {
    console.error('Loans API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
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
    const { action, leagueId, teamId, loanId, restructurePct } = body;

    if (!leagueId || !teamId) {
      return NextResponse.json({ success: false, error: 'leagueId and teamId required' }, { status: 400 });
    }

    const serviceSupabase = await getServiceSupabase();

    const { data: team } = await serviceSupabase
      .from('teams')
      .select('id, budget, user_id')
      .eq('id', teamId)
      .eq('league_id', leagueId)
      .single();

    if (!team || team.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Team not found or not yours' }, { status: 403 });
    }

    const { data: league } = await serviceSupabase
      .from('leagues')
      .select('season')
      .eq('id', leagueId)
      .single();

    const season = league?.season ?? 1;

    if (action === 'take') {
      if (season < 2 || season > 7) {
        return NextResponse.json({ success: false, error: 'Loans available only in seasons 2-7' }, { status: 400 });
      }

      const { count } = await serviceSupabase
        .from('loans')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('league_id', leagueId)
        .gt('remaining', 0);

      if ((count ?? 0) > 0) {
        return NextResponse.json({ success: false, error: 'You already have an active loan' }, { status: 400 });
      }

      const { data: loan, error } = await serviceSupabase
        .from('loans')
        .insert({
          team_id: teamId,
          league_id: leagueId,
          amount: LOAN_AMOUNT,
          repay_total: REPAY_TOTAL,
          season_taken: season,
          remaining: REPAY_TOTAL,
          repayment_1: REPAY_INSTALLMENT,
          repayment_2: REPAY_INSTALLMENT,
          repayment_3: REPAY_TOTAL - REPAY_INSTALLMENT * 2,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await serviceSupabase.rpc('write_finance_entry', {
        p_team_id: teamId,
        p_league_id: leagueId,
        p_amount: LOAN_AMOUNT,
        p_reason: 'Loan',
        p_description: `Loan taken (Season ${season})`,
        p_season: season,
      });

      return NextResponse.json({ success: true, data: loan });
    }

    if (action === 'restructure' && loanId) {
      const { restructurePct } = body;
      const pct = parseInt(String(restructurePct), 10);
      if (![25, 50, 75, 100].includes(pct)) {
        return NextResponse.json({ success: false, error: 'restructurePct must be 25, 50, 75, or 100' }, { status: 400 });
      }
      const { data: rpcResult, error: rpcError } = await serviceSupabase.rpc('restructure_loan', {
        p_loan_id: loanId,
        p_restructure_pct: pct,
        p_actor_user_id: user.id,
      });
      if (rpcError) {
        return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
      }
      const result = rpcResult as { success?: boolean; error?: string };
      if (!result?.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: rpcResult });
    }

    if (action === 'repay' && loanId) {
      const { data: loan } = await serviceSupabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .eq('team_id', teamId)
        .single();

      if (!loan || loan.remaining <= 0) {
        return NextResponse.json({ success: false, error: 'Loan not found or already paid' }, { status: 400 });
      }

      const installments = [loan.repayment_1, loan.repayment_2, loan.repayment_3].filter(Boolean);
      const repayAmount = installments.length > 0 && loan.repay_made < installments.length
        ? Math.min(installments[loan.repay_made], loan.remaining)
        : Math.min(REPAY_INSTALLMENT, loan.remaining);
      const { data: teamBudget } = await serviceSupabase
        .from('teams')
        .select('budget')
        .eq('id', teamId)
        .single();

      if ((teamBudget?.budget ?? 0) < repayAmount) {
        return NextResponse.json({ success: false, error: 'Insufficient budget for repayment' }, { status: 400 });
      }

      const newRemaining = loan.remaining - repayAmount;
      const newRepayMade = loan.repay_made + 1;

      await serviceSupabase
        .from('loans')
        .update({ remaining: newRemaining, repay_made: newRepayMade, updated_at: new Date().toISOString() })
        .eq('id', loanId);

      await serviceSupabase.rpc('write_finance_entry', {
        p_team_id: teamId,
        p_league_id: leagueId,
        p_amount: -repayAmount,
        p_reason: 'Loan Repayment',
        p_description: `Repayment ${newRepayMade}/3`,
        p_season: season,
      });

      return NextResponse.json({ success: true, data: { remaining: newRemaining, repay_made: newRepayMade } });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Loans POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
