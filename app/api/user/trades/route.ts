import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league');
    
    if (!leagueId) {
      return NextResponse.json(
        { error: "League ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's team in this league
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("league_id", leagueId)
      .eq("user_id", session.user.id)
      .single();

    if (teamError || !team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Get all trades involving this team
    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select(`
        id,
        from_team_id,
        to_team_id,
        status,
        proposed_date,
        accepted_date,
        from_team:teams!trades_from_team_id_fkey(name),
        to_team:teams!trades_to_team_id_fkey(name),
        trade_items(
          id,
          item_type,
          player_id,
          amount,
          from_team,
          player:player(
            player_id,
            name,
            positions,
            overall_rating,
            image
          )
        )
      `)
      .or(`from_team_id.eq.${team.id},to_team_id.eq.${team.id}`)
      .order("proposed_date", { ascending: false });

    if (tradesError) {
      return NextResponse.json(
        { error: "Failed to fetch trades" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trades: trades || [],
      currentTeam: team
    });

  } catch (error: any) {
    console.error("Trades API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league');
    const body = await request.json();
    const { toTeamId, items } = body;
    
    if (!leagueId || !toTeamId || !items) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user's team in this league
    const { data: fromTeam, error: teamError } = await supabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", session.user.id)
      .single();

    if (teamError || !fromTeam) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Create the trade
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .insert({
        from_team_id: fromTeam.id,
        to_team_id: toTeamId,
        status: "proposed",
        proposed_date: new Date().toISOString()
      })
      .select("id")
      .single();

    if (tradeError) {
      return NextResponse.json(
        { error: "Failed to create trade" },
        { status: 500 }
      );
    }

    // Create trade items
    const tradeItems = items.map((item: any) => ({
      trade_id: trade.id,
      item_type: item.type,
      player_id: item.player_id || null,
      amount: item.amount || null,
      from_team: item.from_team || false
    }));

    const { error: itemsError } = await supabase
      .from("trade_items")
      .insert(tradeItems);

    if (itemsError) {
      return NextResponse.json(
        { error: "Failed to create trade items" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trade_id: trade.id
    });

  } catch (error: any) {
    console.error("Create trade API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 