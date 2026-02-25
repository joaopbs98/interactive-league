import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const leagueId = searchParams.get('leagueId');

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Verify team ownership
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, user_id, league_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const targetLeagueId = leagueId || team.league_id;

    // League-wide history: fetch all pack purchases from teams in the league
    const { data: leagueTeams, error: leagueTeamsError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('league_id', targetLeagueId);

    if (leagueTeamsError || !leagueTeams?.length) {
      return NextResponse.json({ packHistory: [] });
    }

    const teamIds = leagueTeams.map((t) => t.id);
    const teamMap = new Map(leagueTeams.map((t) => [t.id, t.name]));

    const { data: packHistory, error: historyError } = await supabase
      .from('pack_purchases')
      .select(`
        id,
        team_id,
        purchased_at,
        total_cost,
        players_obtained,
        pack:pack_id (
          id,
          name,
          pack_type,
          price
        )
      `)
      .in('team_id', teamIds)
      .order('purchased_at', { ascending: false });

    if (historyError) {
      console.error('Pack history error:', historyError);
      return NextResponse.json({ error: 'Failed to fetch pack history' }, { status: 500 });
    }

    // Enrich with team names
    const enriched = (packHistory || []).map((p: any) => ({
      ...p,
      team_name: teamMap.get(p.team_id) || 'Unknown',
    }));

    return NextResponse.json({ packHistory: enriched });

  } catch (error) {
    console.error('Packs API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Pack opening API called');
    const supabase = await createClient();
    
    // Get current user
    console.log('Getting user from auth for pack opening...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth result for pack opening:', { user: user?.id, error: authError });
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { packId, teamId } = await request.json();
    console.log('Pack opening request:', { packId, teamId });

    if (!packId || !teamId) {
      return NextResponse.json({ error: 'Pack ID and Team ID are required' }, { status: 400 });
    }

    // Verify team ownership and get team data
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, user_id, budget, league_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Phase lock: allow during IN_SEASON only when transfer window is open
    const { data: leagueStatus } = await supabase
      .from('leagues')
      .select('status, transfer_window_open')
      .eq('id', team.league_id)
      .single();

    if (leagueStatus?.status === 'IN_SEASON' && !leagueStatus?.transfer_window_open) {
      return NextResponse.json({ error: 'Cannot open packs during the season. Wait for transfer window or offseason.' }, { status: 400 });
    }

    // Roster cap: only during IN_SEASON when transfer window is CLOSED do we enforce 23.
    // During transfer window or OFFSEASON, no cap (allow 23+ for packs; trim to 21-23 at registration).
    const isTransferWindowOrOffseason = leagueStatus?.transfer_window_open === true || leagueStatus?.status === 'OFFSEASON';
    if (!isTransferWindowOrOffseason) {
      const { count: rosterCount } = await supabase
        .from('league_players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);
      if ((rosterCount || 0) > 20) {
        return NextResponse.json({ error: 'Roster too full to open packs. Release players first (max 23, packs give 3).' }, { status: 400 });
      }
    }

    // Get the current league season
    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .select('season')
      .eq('id', team.league_id)
      .single();

    if (leagueError || !leagueData) {
      console.error('League data error:', leagueError);
      return NextResponse.json({ error: 'Failed to get league season' }, { status: 500 });
    }

    const currentSeason = leagueData.season;
    console.log('Current season for pack opening:', currentSeason);
    
    // Get pack details for the current season
    console.log('Fetching pack with ID:', packId, 'for season:', currentSeason);
    const { data: pack, error: packError } = await supabase
      .from('packs')
      .select('*')
      .eq('id', packId)
      .eq('season', currentSeason)
      .single();

    console.log('Pack query result:', { pack, packError });

    if (packError || !pack) {
      console.error('Pack not found for current season:', packError);
      
      // Let's also check what packs exist in the database for the current season
      const { data: seasonPacks, error: seasonPacksError } = await supabase
        .from('packs')
        .select('*')
        .eq('season', currentSeason);
      
      console.log('Season packs in database:', { seasonPacks, seasonPacksError });
      
      return NextResponse.json({ 
        error: `Pack not found for Season ${currentSeason}`,
        debug: {
          requestedPackId: packId,
          currentSeason: currentSeason,
          packError: packError,
          availableSeasonPacks: seasonPacks
        }
      }, { status: 404 });
    }

    // Check if team has enough budget
    if (team.budget < pack.price) {
      return NextResponse.json({ 
        error: 'Insufficient budget',
        required: pack.price,
        available: team.budget
      }, { status: 400 });
    }

    // Get pack rating odds for the current season
    const { data: packOdds, error: oddsError } = await supabase
      .from('pack_rating_odds')
      .select('rating, probability')
      .eq('pack_id', packId)
      .gt('probability', 0)
      .order('rating', { ascending: false });

    if (oddsError) {
      console.error('Error fetching pack odds:', oddsError);
      return NextResponse.json({ error: 'Failed to fetch pack odds' }, { status: 500 });
    }

    if (!packOdds || packOdds.length === 0) {
      console.error(`No pack odds found for pack ${packId} in season ${currentSeason}. Please ensure pack_rating_odds table has data.`);
      return NextResponse.json({ 
        error: `No pack odds found for pack ${packId} in season ${currentSeason}. Please ensure the pack_rating_odds table has data.` 
      }, { status: 400 });
    }

    console.log('Pack odds found:', packOdds);

    // Generate server-side RNG seed for auditability (IL25 spec)
    const rngSeed = crypto.randomUUID();

    // Generate players based on pack odds
    const players = [];
    const positions = ['ST', 'CM', 'CB', 'GK', 'LB', 'RB', 'CDM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF'];
    
    for (let i = 0; i < pack.player_count; i++) {
      // Select rating based on probability weights
      const targetRating = selectRatingFromOdds(packOdds);
      
      // Get a random position
      const position = positions[Math.floor(Math.random() * positions.length)];
      
      // Find available players with this rating and position from the player table
      // First try to find players with the exact position
      let { data: availablePlayers, error: playerQueryError } = await supabase
        .from('player')
        .select('player_id, name, full_name, overall_rating, positions, image, country_name')
        .eq('overall_rating', targetRating)
        .ilike('positions', `%${position}%`)
        .not('player_id', 'in', `(
          SELECT DISTINCT player_id 
          FROM league_players 
          WHERE league_id = '${team.league_id}'
        )`)
        .limit(10);

      if (playerQueryError) {
        console.error('Error querying available players:', playerQueryError);
        return NextResponse.json({ error: 'Failed to query available players' }, { status: 500 });
      }

      // If no players found with exact position, try any player with the rating
      if (!availablePlayers || availablePlayers.length === 0) {
        console.log(`No available players found for rating ${targetRating} and position ${position}, trying any position`);
        
        const { data: anyPlayers, error: anyPlayerError } = await supabase
          .from('player')
          .select('player_id, name, full_name, overall_rating, positions, image, country_name')
          .eq('overall_rating', targetRating)
          .not('player_id', 'in', `(
            SELECT DISTINCT player_id 
            FROM league_players 
            WHERE league_id = '${team.league_id}'
          )`)
          .limit(5);

        if (anyPlayerError) {
          console.error('Error querying any players:', anyPlayerError);
          return NextResponse.json({ error: 'Failed to query available players' }, { status: 500 });
        }

        if (anyPlayers && anyPlayers.length > 0) {
          const randomPlayer = anyPlayers[Math.floor(Math.random() * anyPlayers.length)];
          players.push(randomPlayer);
        } else {
          // If still no players found, try to find any player with similar rating (±2)
          console.log(`No players found for rating ${targetRating}, trying similar ratings`);
          
          const { data: similarPlayers, error: similarError } = await supabase
            .from('player')
            .select('player_id, name, full_name, overall_rating, positions, image, country_name')
            .gte('overall_rating', targetRating - 2)
            .lte('overall_rating', targetRating + 2)
            .not('player_id', 'in', `(
              SELECT DISTINCT player_id 
              FROM league_players 
              WHERE league_id = '${team.league_id}'
            )`)
            .limit(5);

          if (similarError) {
            console.error('Error querying similar players:', similarError);
            return NextResponse.json({ error: 'Failed to query available players' }, { status: 500 });
          }

          if (similarPlayers && similarPlayers.length > 0) {
            const randomPlayer = similarPlayers[Math.floor(Math.random() * similarPlayers.length)];
            players.push(randomPlayer);
          } else {
            // Last resort: create a placeholder player
            console.log(`Creating placeholder player for rating ${targetRating}`);
            const placeholderPlayer = {
              player_id: `placeholder_${Date.now()}_${i}`,
              name: `Generated Player ${i + 1}`,
              overall_rating: targetRating,
              positions: position,
              age: Math.floor(Math.random() * 18) + 18 // 18-35
            };
            players.push(placeholderPlayer);
          }
        }
      } else {
        // Select a random player from available options
        const randomPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
        players.push(randomPlayer);
      }
    }

    // Create league players for the pack contents
    const leaguePlayers = [];
    for (const player of players) {
      // Skip placeholder players
      if (player.player_id.startsWith('placeholder_')) {
        continue;
      }

      const insertData = {
        player_id: player.player_id,
        team_id: teamId,
        player_name: player.name,
        full_name: player.name,
        image: (player as { image?: string }).image,
        positions: player.positions,
        rating: player.overall_rating,
        league_id: team.league_id,
        origin_type: 'packed'
      };
      
      console.log('Attempting to insert player:', insertData);
      
      const { data: leaguePlayer, error: playerError } = await supabase
        .from('league_players')
        .insert(insertData)
        .select()
        .single();

      if (playerError) {
        console.error('League player creation error:', playerError);
        console.error('Insert data was:', insertData);
      } else {
        console.log('Successfully created league player:', leaguePlayer);
        leaguePlayers.push(leaguePlayer);
        const wage = Math.max(500000, ((player.overall_rating ?? 60) - 50) * 100000);
        await supabase.from('contracts').upsert({
          player_id: player.player_id,
          team_id: teamId,
          wage,
          start_season: currentSeason,
          years: 3,
          status: 'active',
          wage_discount_percent: 20,
        }, { onConflict: "team_id,player_id" });
      }
    }

    // Add players to team reserves
    const { data: currentTeam, error: teamQueryError } = await supabase
      .from('teams')
      .select('reserves')
      .eq('id', teamId)
      .single();

    if (teamQueryError) {
      console.error('Error fetching team reserves:', teamQueryError);
      return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 });
    }

    // Get current reserves or initialize empty array
    const currentReserves = currentTeam.reserves || [];
    
    // Add new players to reserves - only store player IDs as strings
    const newPlayerIds = players
      .filter(p => !p.player_id.startsWith('placeholder_'))
      .map(p => p.player_id);
    
    const updatedReserves = [...currentReserves, ...newPlayerIds];

    // Update team reserves
    const { error: reservesUpdateError } = await supabase
      .from('teams')
      .update({ reserves: updatedReserves })
      .eq('id', teamId);

    if (reservesUpdateError) {
      console.error('Error updating team reserves:', reservesUpdateError);
      return NextResponse.json({ error: 'Failed to update team reserves' }, { status: 500 });
    }

    // Log the purchase (with RNG seed for auditability)
    const { error: purchaseError } = await supabase
      .from('pack_purchases')
      .insert({
        team_id: teamId,
        pack_id: packId,
        total_cost: pack.price,
        rng_seed: rngSeed,
        players_obtained: players.map(p => ({ 
          player_id: p.player_id, 
          name: p.name,
          overall_rating: p.overall_rating,
          positions: p.positions
        })),
        purchased_at: new Date().toISOString()
      });

    if (purchaseError) {
      console.error('Purchase logging error:', purchaseError);
    }

    // Update team budget
    const { error: budgetError } = await supabase
      .from('teams')
      .update({ budget: team.budget - pack.price })
      .eq('id', teamId);

    if (budgetError) {
      console.error('Budget update error:', budgetError);
    }

    return NextResponse.json({
      success: true,
      message: 'Pack opened successfully',
      pack: pack,
      players: players.map(p => ({
        player_id: p.player_id,
        name: p.name,
        full_name: (p as { full_name?: string }).full_name,
        overall_rating: p.overall_rating,
        positions: p.positions,
        image: (p as { image?: string }).image,
        country_name: (p as { country_name?: string }).country_name
      })),
      leaguePlayers: leaguePlayers,
      newBudget: team.budget - pack.price,
      currentSeason: currentSeason
    });

  } catch (error: any) {
    console.error('Pack opening error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to select rating based on probability weights
function selectRatingFromOdds(packOdds: any[]): number {
  if (!packOdds || packOdds.length === 0) {
    return Math.floor(Math.random() * 15) + 60; // Fallback: 60-74 rating
  }
  
  // Create weighted selection based on probability
  const totalWeight = packOdds.reduce((sum, odd) => sum + odd.probability, 0);
  let random = Math.random() * totalWeight;
  
  for (const odd of packOdds) {
    random -= odd.probability;
    if (random <= 0) {
      return odd.rating;
    }
  }
  
  // Fallback to highest rating if something goes wrong
  return packOdds[0]?.rating || 60;
} 