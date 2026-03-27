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
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", session.user.id)
      .single();

    if (teamError || !team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Get all contracts for this team with player details
    const { data: contracts, error: contractsError } = await supabase
      .from("contracts")
      .select(`
        id,
        player_id,
        wage,
        years,
        start_season,
        end_season,
        signing_bonus,
        player:player(
          player_id,
          name,
          positions,
          overall_rating,
          image
        )
      `)
      .eq("team_id", team.id)
      .eq("end_season", false); // Only active contracts

    if (contractsError) {
      return NextResponse.json(
        { error: "Failed to fetch contracts" },
        { status: 500 }
      );
    }

    // Calculate remaining seasons (assuming current season is 1 for now)
    const currentSeason = 1;
    const contractsWithRemaining = contracts?.map(contract => ({
      ...contract,
      seasonsRemaining: contract.years - (currentSeason - contract.start_season),
      salary: `€${contract.wage.toLocaleString()}/month`
    })) || [];

    return NextResponse.json({
      success: true,
      contracts: contractsWithRemaining
    });

  } catch (error: any) {
    console.error("Contracts API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 