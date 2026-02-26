import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    console.log('Contracts API: Starting request');
    const supabase = await createClient();
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const leagueId = searchParams.get('leagueId');
    const type = searchParams.get('type') || 'all';
    
    console.log('Contracts API: Parameters:', { teamId, leagueId, type });

    let data: any = null;

    switch (type) {
      case 'all':
        console.log('Contracts API: Fetching league players from database');
        
        // Get league players with team details
        const { data: contractsData, error: contractsError } = await supabase
          .from('league_players')
          .select(`
            id,
            player_id,
            team_id,
            player_name,
            full_name,
            positions,
            rating,
            image,
            team:teams(
              id,
              name,
              league_id
            )
          `);

        if (contractsError) throw contractsError;
        
        console.log('Contracts API: League players found:', contractsData?.length || 0);
        
        // Filter by league if provided
        let filteredData = contractsData;
        if (leagueId) {
          filteredData = contractsData?.filter((contract: any) => 
            contract.team?.league_id === leagueId
          ) || [];
          console.log('Contracts API: Filtered by league:', filteredData.length, 'players');
        }
        
        // Transform league players data
        data = filteredData?.map((contract: any) => {
          const team = contract.team;
          
          if (!team) {
            console.log('Contracts API: Skipping player with missing team data:', contract);
            return null;
          }
          
          // Calculate base wage based on rating and position
          const baseWage = calculateBaseWage(contract.rating || 60, contract.positions || 'ST');
          
          console.log('Contracts API: Processing player:', {
            player_id: contract.player_id,
            player_name: contract.player_name,
            rating: contract.rating,
            position: contract.positions,
            calculated_base_wage: baseWage,
            team_name: team.name
          });
          
          return {
            player_id: contract.player_id,
            player_name: contract.player_name || contract.full_name || 'Unknown Player',
            positions: contract.positions || 'Unknown',
            rating: contract.rating || 60,
            team_id: team.id,
            team_name: team.name,
            base_wage: baseWage,
            final_wage: baseWage, // For now, same as base wage (no discounts yet)
            contract_value: baseWage, // Contract value based on base wage
            origin_type: 'league_player',
            origin_details: null,
            discounts: []
          };
        }).filter(Boolean) || [];
        
        // Filter by teamId if provided
        if (teamId) {
          console.log('Contracts API: Filtering by teamId:', teamId);
          data = data.filter((contract: any) => contract.team_id === teamId);
        }
        
        console.log('Contracts API: Final data from contracts table:', data.length, 'players');
        break;

      case 'summary':
        console.log('Contracts API: Generating summary from league players table');
        
        // Get league players with team details
        const { data: summaryContractsData, error: summaryContractsError } = await supabase
          .from('league_players')
          .select(`
            team_id,
            rating,
            positions,
            team:teams(
              id,
              name
            )
          `);

        if (summaryContractsError) throw summaryContractsError;
        
        // Filter by league if provided
        let filteredSummaryData = summaryContractsData;
        if (leagueId) {
          filteredSummaryData = summaryContractsData?.filter((contract: any) => 
            contract.team?.league_id === leagueId
          ) || [];
          console.log('Contracts API: Summary filtered by league:', filteredSummaryData.length, 'players');
        }
        
        // Group by team and calculate totals
        const teamSummaries: { [key: string]: any } = {};
        
        filteredSummaryData?.forEach((contract: any) => {
          const team = contract.team;
          
          if (!team) return;
          
          const teamId = team.id;
          
          if (!teamSummaries[teamId]) {
            teamSummaries[teamId] = {
              team_id: teamId,
              team_name: team.name,
              total_players: 0,
              total_base_salary: 0,
              total_final_salary: 0,
              total_savings: 0,
              total_rating: 0,
              players_by_position: { GK: 0, DEF: 0, MID: 0, FWD: 0 }
            };
          }
          
          const summary = teamSummaries[teamId];
          summary.total_players++;
          
          // Calculate base wage for summary
          const baseWage = calculateBaseWage(contract.rating || 60, contract.positions || 'ST');
          summary.total_base_salary += baseWage;
          summary.total_final_salary += baseWage; // For now, same as base wage
          summary.total_rating += contract.rating || 60;
          
          // Count by position
          const positions = contract.positions || '';
          const firstPosition = positions.split(',')[0].trim();
          if (firstPosition === 'GK') {
            summary.players_by_position.GK++;
          } else if (['CB', 'RB', 'LB'].includes(firstPosition)) {
            summary.players_by_position.DEF++;
          } else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(firstPosition)) {
            summary.players_by_position.MID++;
          } else if (['LW', 'RW', 'ST', 'CF'].includes(firstPosition)) {
            summary.players_by_position.FWD++;
          }
        });
        
        // Convert to array and calculate averages and savings
        data = Object.values(teamSummaries).map((summary: any) => ({
          ...summary,
          avg_rating: Math.round(summary.total_rating / summary.total_players),
          total_savings: summary.total_base_salary - summary.total_final_salary
        }));
        break;

      case 'values':
        console.log('Contracts API: Fetching contract values');
        // Get contract value table directly
        const { data: valuesData, error: valuesError } = await supabase
          .from('contract_values')
          .select('*')
          .order('rating', { ascending: false });

        console.log('Contracts API: Values query result:', { valuesData, valuesError });
        if (valuesError) throw valuesError;
        data = valuesData || [];
        break;

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    console.log('Contracts API: Returning data:', data);
    return NextResponse.json({ data });

  } catch (error) {
    console.error('Contracts API: Error details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contracts data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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
    59: { def: 800000, att: 1000000 },
    58: { def: 800000, att: 1000000 },
    57: { def: 800000, att: 1000000 },
    56: { def: 800000, att: 1000000 },
    55: { def: 800000, att: 1000000 },
    54: { def: 800000, att: 1000000 },
    53: { def: 800000, att: 1000000 }
  };
  
  // Get wage based on rating and position
  const wage = wageTable[rating] || { def: 800000, att: 1000000 };
  return isDefensive ? wage.def : wage.att;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, ...params } = body;

    let result: any = null;

    switch (action) {
      case 'apply_discount':
        // Apply wage discount to a player
        const { data: discountData, error: discountError } = await supabase
          .rpc('apply_wage_discount', {
            p_player_id: params.playerId,
            p_discount_type: params.discountType,
            p_discount_percentage: params.discountPercentage,
            p_expires_at: params.expiresAt
          });

        if (discountError) throw discountError;
        result = discountData;
        break;

      case 'record_origin':
        // Record player origin
        const { data: originData, error: originError } = await supabase
          .rpc('record_player_origin', {
            p_player_id: params.playerId,
            p_origin_type: params.originType,
            p_origin_details: params.originDetails
          });

        if (originError) throw originError;
        result = originData;
        break;

      case 'update_contracts':
        // Update existing player contracts with proper values
        const { data: updateData, error: updateError } = await supabase
          .rpc('update_existing_player_contracts');

        if (updateError) throw updateError;
        result = { updated_count: updateData };
        break;

      case 'recalculate_wages':
        // Recalculate wages for all league players based on current ratings
        const { data: recalcData, error: recalcError } = await supabase
          .from('league_players')
          .select(`
            id,
            rating,
            positions
          `);

        if (recalcError) throw recalcError;

        // For league_players, we don't need to update base_wage since it's calculated on-the-fly
        // But we can return the count of players that would have their wages recalculated
        const totalPlayers = recalcData?.length || 0;
        
        result = { 
          updated_count: totalPlayers, 
          total_contracts: totalPlayers,
          message: 'Wages are calculated dynamically based on ratings and positions'
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Error in contracts action:', error);
    return NextResponse.json(
      { error: 'Failed to perform contracts action' },
      { status: 500 }
    );
  }
} 