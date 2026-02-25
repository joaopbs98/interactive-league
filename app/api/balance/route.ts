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
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    console.log('Balance API called with teamId:', teamId);
    
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Get current user
    console.log('Getting user from auth...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth result:', { user: user?.id, error: authError });
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

    // Calculate total wage bill for the team
    const { data: teamPlayers, error: playersError } = await supabase
      .from('league_players')
      .select('rating, positions')
      .eq('team_id', teamId);

    if (playersError) {
      console.error('Error fetching team players for wage calculation:', playersError);
      return NextResponse.json({ error: 'Failed to calculate wages' }, { status: 500 });
    }

    // Calculate total wage bill using the wage table
    let totalWageBill = 0;
    if (teamPlayers && teamPlayers.length > 0) {
      teamPlayers.forEach((player: any) => {
        const baseWage = calculateBaseWage(player.rating || 60, player.positions || 'ST');
        totalWageBill += baseWage;
      });
    }

    // Available balance = budget - wage commitments
    const availableBalance = Math.max(0, (team.budget || 0) - totalWageBill);
    
    console.log('Team budget:', team.budget);
    console.log('Total wage bill:', totalWageBill);
    console.log('Available balance (after wages):', availableBalance);

    return NextResponse.json({ 
      success: true,
      data: {
        availableBalance: availableBalance,
        totalBudget: team.budget || 0,
        totalWageBill: totalWageBill,
        committedToWages: totalWageBill
      }
    });

  } catch (error) {
    console.error('Balance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 