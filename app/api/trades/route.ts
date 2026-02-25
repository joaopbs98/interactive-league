import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 });
    }

    // Fetch trades where the user's team is involved
    const { data: trades, error } = await supabase
      .from('trades')
      .select(`
        *,
        from_team:teams!trades_from_team_id_fkey(id, name, logo_url),
        to_team:teams!trades_to_team_id_fkey(id, name, logo_url),
        trade_items(*, draft_pick:draft_picks(id, pick_number, season, is_used))
      `)
      .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching trades:', error);
      return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
    }

    return NextResponse.json({ trades: trades || [] });

  } catch (error: any) {
    console.error('Trades API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { fromTeamId, toTeamId, items, message } = body;

    if (!fromTeamId || !toTeamId || !items || items.length === 0) {
      return NextResponse.json({ error: "Invalid trade data" }, { status: 400 });
    }

    // Verify user owns the from team
    const { data: teamCheck, error: teamError } = await supabase
      .from('teams')
      .select('id, league_id')
      .eq('id', fromTeamId)
      .eq('user_id', session.user.id)
      .single();

    if (teamError || !teamCheck) {
      return NextResponse.json({ error: "Not authorized to trade from this team" }, { status: 403 });
    }

    // Phase lock: trades only in OFFSEASON
    if (teamCheck.league_id) {
      const { data: league } = await supabase
        .from('leagues')
        .select('status')
        .eq('id', teamCheck.league_id)
        .single();

      if (league?.status === 'IN_SEASON') {
        return NextResponse.json({ error: "Trades are not allowed during the season" }, { status: 400 });
      }
    }

    // Create trade
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        from_team_id: fromTeamId,
        to_team_id: toTeamId,
        status: 'pending',
        message: message || '',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (tradeError) {
      console.error('Error creating trade:', tradeError);
      return NextResponse.json({ error: "Failed to create trade" }, { status: 500 });
    }

    // Validate draft picks: must be owned by fromTeam and not used
    for (const item of items) {
      if (item.type === 'draft_pick' && item.draftPickId) {
        const { data: pick } = await supabase
          .from('draft_picks')
          .select('id, current_owner_team_id, team_id, is_used')
          .eq('id', item.draftPickId)
          .single();
        if (!pick || pick.is_used) {
          return NextResponse.json({ error: 'Invalid or already used draft pick' }, { status: 400 });
        }
        const ownerId = pick.current_owner_team_id ?? pick.team_id;
        if (ownerId !== fromTeamId) {
          return NextResponse.json({ error: 'Draft pick not owned by your team' }, { status: 400 });
        }
      }
    }

    // Create trade items (valid types: player, money, objective, draft_pick, request)
    const validTypes = ['player', 'money', 'objective', 'draft_pick', 'request'];
    const tradeItems = items
      .filter((item: any) => validTypes.includes(item.type))
      .map((item: any) => {
        const base: Record<string, unknown> = {
          trade_id: trade.id,
          item_type: item.type,
          player_id: (item.type === 'player' || item.type === 'request') ? item.playerId : null,
          amount: item.type === 'money' ? item.amount : null,
          objective_id: item.type === 'objective' ? item.objectiveId : null,
          draft_pick_id: item.type === 'draft_pick' ? item.draftPickId : null,
        };
        if (item.type === 'player' && item.contractTakeoverPct != null) {
          const pct = Math.min(100, Math.max(10, Math.round(Number(item.contractTakeoverPct) / 10) * 10));
          base.contract_takeover_pct = pct;
        }
        return base;
      });

    const { error: itemsError } = await supabase
      .from('trade_items')
      .insert(tradeItems);

    if (itemsError) {
      console.error('Error creating trade items:', itemsError);
      return NextResponse.json({ error: "Failed to create trade items" }, { status: 500 });
    }

    // Notify to_team owner of new trade proposal
    const { data: toTeam } = await supabase
      .from('teams')
      .select('id, user_id, league_id')
      .eq('id', toTeamId)
      .single();
    if (toTeam?.user_id && toTeam?.league_id) {
      const serviceSupabase = await getServiceSupabase();
      const { data: fromTeam } = await supabase
        .from('teams')
        .select('name')
        .eq('id', fromTeamId)
        .single();
      await serviceSupabase.from('notifications').insert({
        user_id: toTeam.user_id,
        league_id: toTeam.league_id,
        team_id: toTeam.id,
        type: 'trade_proposal',
        title: 'New trade proposal',
        message: `${fromTeam?.name || 'A team'} has sent you a trade proposal.`,
        read: false,
      });
    }

    return NextResponse.json({ 
      success: true, 
      trade: { ...trade, items: tradeItems } 
    });

  } catch (error: any) {
    console.error('Create trade API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 