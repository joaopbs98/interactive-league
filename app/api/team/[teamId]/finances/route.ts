import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to calculate base wage based on rating and position
function calculateBaseWage(rating: number, position: string): number {
  // Determine if player is defensive or attacking based on first position only
  const firstPosition = position.split(',')[0].trim(); // Get first position
  const isDefensive = firstPosition === 'GK' || 
                     firstPosition === 'CDM' || 
                     ['CB', 'RB', 'LB'].includes(firstPosition);
  
  // Wage table based on rating and position
  const wageTable: { [key: number]: { def: number, att: number } } = {
    95: { def: 48000000, att: 60000000 },
    94: { def: 48000000, att: 60000000 },
    93: { def: 44800000, att: 56000000 },
    92: { def: 41600000, att: 52000000 },
    91: { def: 38400000, att: 48000000 },
    90: { def: 35200000, att: 44000000 },
    89: { def: 32000000, att: 40000000 },
    88: { def: 28800000, att: 36000000 },
    87: { def: 25600000, att: 32000000 },
    86: { def: 22400000, att: 28000000 },
    85: { def: 19200000, att: 24000000 },
    84: { def: 16000000, att: 20000000 },
    83: { def: 14400000, att: 18000000 },
    82: { def: 12800000, att: 16000000 },
    81: { def: 11200000, att: 14000000 },
    80: { def: 10400000, att: 13000000 },
    79: { def: 9600000, att: 12000000 },
    78: { def: 8800000, att: 11000000 },
    77: { def: 8000000, att: 10000000 },
    76: { def: 7200000, att: 9000000 },
    75: { def: 6400000, att: 8000000 },
    74: { def: 5800000, att: 7200000 },
    73: { def: 5100000, att: 6400000 },
    72: { def: 4500000, att: 5600000 },
    71: { def: 3800000, att: 4800000 },
    70: { def: 3200000, att: 4000000 },
    69: { def: 2900000, att: 3600000 },
    68: { def: 2600000, att: 3200000 },
    67: { def: 2200000, att: 2800000 },
    66: { def: 1900000, att: 2400000 },
    65: { def: 1600000, att: 2000000 },
    64: { def: 1440000, att: 1800000 },
    63: { def: 1280000, att: 1600000 },
    62: { def: 1120000, att: 1400000 },
    61: { def: 960000, att: 1200000 },
    60: { def: 800000, att: 1000000 },
    59: { def: 720000, att: 900000 },
    58: { def: 640000, att: 800000 },
    57: { def: 560000, att: 700000 },
    56: { def: 480000, att: 600000 },
    55: { def: 400000, att: 500000 },
    54: { def: 320000, att: 400000 },
    53: { def: 240000, att: 300000 }
  };
  
  // Get wage based on rating and position
  const wage = wageTable[rating] || { def: 800000, att: 1000000 };
  return isDefensive ? wage.def : wage.att;
}

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const teamId = requestUrl.pathname.split('/')[3]; // Extract teamId from path
    const searchParams = requestUrl.searchParams;
    
    console.log('Team Finances API called with teamId:', teamId);
    
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify team ownership
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, user_id, budget, name, merch_percentage, merch_base_revenue, league_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    let leversEnabled = true;
    if (team.league_id) {
      const { data: league } = await supabase
        .from('leagues')
        .select('levers_enabled')
        .eq('id', team.league_id)
        .single();
      leversEnabled = (league?.levers_enabled ?? true) !== false;
    }

    if (team.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all players on the team with their wage calculations
    const { data: teamPlayers, error: playersError } = await supabase
      .from('league_players')
      .select(`
        id,
        player_id,
        player_name,
        full_name,
        rating,
        positions,
        image
      `)
      .eq('team_id', teamId);

    if (playersError) {
      console.error('Error fetching team players for wage calculation:', playersError);
      return NextResponse.json({ error: 'Failed to calculate wages' }, { status: 500 });
    }

    // Calculate detailed wage breakdown
    let totalWageBill = 0;
    const wageBreakdown: any[] = [];
    
    if (teamPlayers && teamPlayers.length > 0) {
      teamPlayers.forEach((player: any) => {
        const baseWage = calculateBaseWage(player.rating || 60, player.positions || 'ST');
        totalWageBill += baseWage;
        
        wageBreakdown.push({
          player_id: player.player_id,
          player_name: player.player_name || player.full_name,
          rating: player.rating,
          positions: player.positions,
          base_wage: baseWage,
          image: player.image
        });
      });
    }

    // Calculate available balance after wage commitments
    const availableBalance = Math.max(0, (team.budget || 0) - totalWageBill);
    
    // Calculate wage by position groups
    const positionWages = {
      GK: 0,
      DEF: 0,
      MID: 0,
      FWD: 0
    };

    wageBreakdown.forEach((player: any) => {
      const firstPosition = player.positions.split(',')[0].trim();
      if (firstPosition === 'GK') {
        positionWages.GK += player.base_wage;
      } else if (['CB', 'RB', 'LB'].includes(firstPosition)) {
        positionWages.DEF += player.base_wage;
      } else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(firstPosition)) {
        positionWages.MID += player.base_wage;
      } else if (['LW', 'RW', 'ST', 'CF'].includes(firstPosition)) {
        positionWages.FWD += player.base_wage;
      }
    });

    console.log('Team finances calculated:', {
      teamName: team.name,
      totalBudget: team.budget,
      totalWageBill,
      availableBalance,
      playerCount: teamPlayers?.length || 0
    });

    const seasonParam = searchParams.get('season');
    const reasonParam = searchParams.get('reason');
    const typeParam = searchParams.get('type'); // income | expense | all
    const searchParam = searchParams.get('search');

    let financeQuery = supabase
      .from('finances')
      .select('id, amount, reason, description, season, date, created_at')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (seasonParam && seasonParam !== 'all') {
      const s = parseInt(seasonParam);
      if (!isNaN(s)) financeQuery = financeQuery.eq('season', s);
    }
    if (reasonParam && reasonParam !== 'all') {
      financeQuery = financeQuery.eq('reason', reasonParam);
    }
    if (typeParam === 'income') {
      financeQuery = financeQuery.gt('amount', 0);
    } else if (typeParam === 'expense') {
      financeQuery = financeQuery.lt('amount', 0);
    }

    const { data: financeRows } = await financeQuery;

    let filteredRows = financeRows ?? [];
    if (searchParam && searchParam.trim()) {
      const q = searchParam.trim().toLowerCase();
      filteredRows = filteredRows.filter(
        (r: { description?: string; reason?: string }) =>
          (r.description ?? '').toLowerCase().includes(q) ||
          (r.reason ?? '').toLowerCase().includes(q)
      );
    }

    return NextResponse.json({ 
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
          totalBudget: team.budget || 0,
          merchPercentage: team.merch_percentage ?? 0,
          merchBaseRevenue: team.merch_base_revenue ?? 0,
          leversEnabled
        },
        transactions: filteredRows.map((r: any) => ({
          id: r.id,
          amount: r.amount,
          reason: r.reason,
          description: r.description,
          season: r.season,
          date: r.date,
          created_at: r.created_at
        })),
        finances: {
          availableBalance,
          totalWageBill,
          committedToWages: totalWageBill,
          remainingBudget: team.budget || 0,
          totalBudget: team.budget || 0
        },
        wageBreakdown: {
          total: totalWageBill,
          byPosition: positionWages,
          players: wageBreakdown
        },
        summary: {
          totalPlayers: teamPlayers?.length || 0,
          averageWage: teamPlayers && teamPlayers.length > 0 ? 
            Math.round(totalWageBill / teamPlayers.length) : 0
        }
      }
    });

  } catch (error) {
    console.error('Team Finances API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = request.nextUrl.pathname.split('/')[3];
    const body = await request.json();
    const { action, ...params } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify team ownership
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, user_id, budget')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let result: any = null;

    switch (action) {
      case 'add_player':
        // Add a player to the team (e.g., from pack, transfer, etc.)
        const { playerId, playerRating, playerPositions } = params;
        
        // Calculate the wage for this player
        const newPlayerWage = calculateBaseWage(playerRating || 60, playerPositions || 'ST');
        
        // Check if team has enough budget for this player's wages
        const currentWageBill = await calculateCurrentWageBill(supabase, teamId);
        const totalBudget = team.budget || 0;
        
        if (totalBudget < (currentWageBill + newPlayerWage)) {
          return NextResponse.json({ 
            error: 'Insufficient budget for player wages',
            details: {
              currentBudget: totalBudget,
              currentWageBill,
              newPlayerWage,
              requiredBudget: currentWageBill + newPlayerWage
            }
          }, { status: 400 });
        }
        
        result = { 
          success: true, 
          message: 'Player can be added within budget',
          wageImpact: newPlayerWage,
          newTotalWageBill: currentWageBill + newPlayerWage
        };
        break;

      case 'remove_player':
        // Remove a player from the team
        const { playerRating: removedPlayerRating, playerPositions: removedPlayerPositions } = params;
        
        // Calculate the wage that will be freed up
        const freedWage = calculateBaseWage(removedPlayerRating || 60, removedPlayerPositions || 'ST');
        
        result = { 
          success: true, 
          message: 'Player removal will free up budget',
          wageImpact: -freedWage,
          freedBudget: freedWage
        };
        break;

      case 'update_budget':
        // Update team budget (e.g., after pack opening, transfers, etc.)
        const { newBudget, reason } = params;
        
        if (typeof newBudget !== 'number' || newBudget < 0) {
          return NextResponse.json({ error: 'Invalid budget amount' }, { status: 400 });
        }
        
        // Update the team budget
        const { data: updateData, error: updateError } = await supabase
          .from('teams')
          .update({ budget: newBudget })
          .eq('id', teamId)
          .select('budget')
          .single();

        if (updateError) {
          return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
        }
        
        result = { 
          success: true, 
          message: 'Budget updated successfully',
          newBudget: updateData.budget,
          reason: reason || 'Manual update'
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Team Finances POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to calculate current wage bill for a team
async function calculateCurrentWageBill(supabase: any, teamId: string): Promise<number> {
  const { data: teamPlayers, error: playersError } = await supabase
    .from('league_players')
    .select('rating, positions')
    .eq('team_id', teamId);

  if (playersError || !teamPlayers) {
    return 0;
  }

  let totalWageBill = 0;
  teamPlayers.forEach((player: any) => {
    const baseWage = calculateBaseWage(player.rating || 60, player.positions || 'ST');
    totalWageBill += baseWage;
  });

  return totalWageBill;
}






