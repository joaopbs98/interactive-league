import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { tradeId } = await params;
    const body = await request.json();
    const { action } = body; // 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get the trade
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    // Verify user owns the team that received the trade
    const { data: teamCheck, error: teamError } = await supabase
      .from('teams')
      .select('id, league_id')
      .eq('id', trade.to_team_id)
      .eq('user_id', session.user.id)
      .single();

    if (teamError || !teamCheck) {
      return NextResponse.json({ error: "Not authorized to respond to this trade" }, { status: 403 });
    }

    if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('trades')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', tradeId);

      if (updateError) {
        console.error('Error rejecting trade:', updateError);
        return NextResponse.json({ error: "Failed to reject trade" }, { status: 500 });
      }

      const { data: fromTeam } = await supabase
        .from('teams')
        .select('id, user_id, league_id')
        .eq('id', trade.from_team_id)
        .single();
      if (fromTeam?.user_id && fromTeam?.league_id) {
        const serviceSupabase = await getServiceSupabase();
        const { data: toTeam } = await supabase.from('teams').select('name').eq('id', trade.to_team_id).single();
        await serviceSupabase.from('notifications').insert({
          user_id: fromTeam.user_id,
          league_id: fromTeam.league_id,
          team_id: fromTeam.id,
          type: 'trade_rejected',
          title: 'Trade rejected',
          message: `${toTeam?.name || 'A team'} has rejected your trade proposal.`,
          read: false,
        });
      }
      return NextResponse.json({ success: true, message: "Trade rejected successfully" });
    }

    // Accept: use atomic execute_trade RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_trade', {
      p_trade_id: tradeId,
      p_actor_user_id: session.user.id,
    });

    if (rpcError) {
      console.error('execute_trade RPC error:', rpcError);
      return NextResponse.json({ error: "Failed to execute trade" }, { status: 500 });
    }

    const result = rpcResult as { success?: boolean; error?: string };
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error ?? "Trade execution failed" },
        { status: 400 }
      );
    }

    const { data: fromTeam } = await supabase
      .from('teams')
      .select('id, user_id, league_id')
      .eq('id', trade.from_team_id)
      .single();
    if (fromTeam?.user_id && fromTeam?.league_id) {
      const serviceSupabase = await getServiceSupabase();
      const { data: toTeam } = await supabase.from('teams').select('name').eq('id', trade.to_team_id).single();
      await serviceSupabase.from('notifications').insert({
        user_id: fromTeam.user_id,
        league_id: fromTeam.league_id,
        team_id: fromTeam.id,
        type: 'trade_accepted',
        title: 'Trade accepted',
        message: `${toTeam?.name || 'A team'} has accepted your trade proposal.`,
        read: false,
      });
    }

    return NextResponse.json({ success: true, message: "Trade accepted successfully" });

  } catch (error: any) {
    console.error('Trade action API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 