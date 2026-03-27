import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Player generation data
const FIRST_NAMES = [
  'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Theodore',
  'Jack', 'Levi', 'Alexander', 'Jackson', 'Mateo', 'Daniel', 'Michael', 'Mason', 'Sebastian', 'Ethan',
  'Logan', 'Owen', 'Samuel', 'Jacob', 'Asher', 'Aiden', 'John', 'Theo', 'Arlo', 'Leo', 'Hudson',
  'Charlie', 'Felix', 'Kai', 'Aaron', 'Luca', 'Adrian', 'Nolan', 'Caleb', 'Eli', 'Isaac', 'Miles',
  'Jaxon', 'Wyatt', 'Oscar', 'Luke', 'Jayden', 'Nathan', 'Isaac', 'Hunter', 'Levi', 'Christian',
  'Julian', 'Landon', 'Grayson', 'Jonathan', 'Isaiah', 'Charles', 'Thomas', 'Christopher', 'Jose',
  'Andrew', 'David', 'Joshua', 'Ethan', 'Ryan', 'John', 'Nicholas', 'Tyler', 'Alexander', 'Samuel'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper'
];

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'];

const POSITION_GROUPS = {
  'GK': ['GK'],
  'DEF': ['CB', 'LB', 'RB'],
  'MID': ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  'ATT': ['LW', 'RW', 'ST', 'CF']
};

// Helper functions
function generateRandomName(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

function generateRandomPosition(): string {
  return POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
}

function generateRandomAge(): number {
  // Weighted towards younger players (18-25 more common)
  const weights = [0.3, 0.25, 0.2, 0.15, 0.1]; // 18-22, 23-26, 27-30, 31-33, 34-35
  const ranges = [[18, 22], [23, 26], [27, 30], [31, 33], [34, 35]];
  
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (let i = 0; i < weights.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      const [min, max] = ranges[i];
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  }
  
  return 22; // fallback
}

function calculateWage(rating: number, age: number): number {
  // Base wage calculation based on rating and age
  let baseWage = rating * 100000; // €100k per rating point
  
  // Age modifier (younger players get slight discount, older players slight premium)
  if (age <= 22) baseWage *= 0.9;
  else if (age >= 30) baseWage *= 1.1;
  
  // Add some randomness (±20%)
  const randomFactor = 0.8 + (Math.random() * 0.4);
  baseWage *= randomFactor;
  
  return Math.round(baseWage);
}

function generatePlayerAttributes(rating: number) {
  // Generate realistic attributes based on overall rating
  const baseStats = {
    pace: Math.max(30, Math.min(99, rating + Math.floor(Math.random() * 20) - 10)),
    shooting: Math.max(30, Math.min(99, rating + Math.floor(Math.random() * 20) - 10)),
    passing: Math.max(30, Math.min(99, rating + Math.floor(Math.random() * 20) - 10)),
    dribbling: Math.max(30, Math.min(99, rating + Math.floor(Math.random() * 20) - 10)),
    defending: Math.max(30, Math.min(99, rating + Math.floor(Math.random() * 20) - 10)),
    physical: Math.max(30, Math.min(99, rating + Math.floor(Math.random() * 20) - 10))
  };
  
  return baseStats;
}

function selectRatingFromOdds(odds: any[]): number {
  // Convert odds to cumulative probabilities
  let cumulative = 0;
  const cumulativeOdds = odds.map(odd => {
    cumulative += odd.probability;
    return { rating: odd.rating, cumulative };
  });
  
  // Generate random number and find corresponding rating
  const random = Math.random();
  for (const odd of cumulativeOdds) {
    if (random <= odd.cumulative) {
      return odd.rating;
    }
  }
  
  // Fallback to highest rating if something goes wrong
  return odds[odds.length - 1]?.rating || 75;
}

function generatePlayer(rating: number) {
  const name = generateRandomName();
  const position = generateRandomPosition();
  const age = generateRandomAge();
  const wage = calculateWage(rating, age);
  const attributes = generatePlayerAttributes(rating);
  
  return {
    name,
    positions: position,
    overall_rating: rating,
    age,
    wage,
    ...attributes
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { packId, teamId, season } = await req.json();
    
    if (!packId || !teamId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pack details
    const { data: pack, error: packError } = await supabase
      .from('packs')
      .select('*')
      .eq('id', packId)
      .single();

    if (packError || !pack) {
      console.error('Pack error:', packError);
      return new Response(
        JSON.stringify({ error: 'Pack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get team details and check available balance
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, budget')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      console.error('Team error:', teamError);
      return new Response(
        JSON.stringify({ error: 'Team not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get available balance (budget - total wages)
    const { data: availableBalance, error: balanceError } = await supabase
      .rpc('get_team_available_balance', { p_team_id: teamId });

    if (balanceError) {
      console.error('Balance calculation error:', balanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to calculate available balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if team has enough balance
    if (availableBalance < pack.price) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance', 
          required: pack.price, 
          available: availableBalance 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pack odds for the season
    const { data: odds, error: oddsError } = await supabase
      .from('pack_rating_odds')
      .select('rating, probability')
      .eq('pack_id', packId)
      .gt('probability', 0)
      .order('rating');

    if (oddsError || !odds || odds.length === 0) {
      console.error('Odds error:', oddsError);
      return new Response(
        JSON.stringify({ error: 'Pack odds not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate players
    const players = [];
    for (let i = 0; i < 3; i++) { // Always generate 3 players
      const rating = selectRatingFromOdds(odds);
      const player = generatePlayer(rating);
      players.push(player);
    }

    // Insert players into database and add to team
    const playerIds = [];
    const playerDestinations = []; // Track where each player went (squad or expendables)
    
    for (const player of players) {
      // Insert player into database
      const { data: insertedPlayer, error: insertError } = await supabase
        .from('player')
        .insert({
          name: player.name,
          positions: player.positions,
          overall_rating: player.overall_rating,
          age: player.age,
          pace: player.pace,
          shooting: player.shooting,
          passing: player.passing,
          dribbling: player.dribbling,
          defending: player.defending,
          physical: player.physical
        })
        .select('player_id')
        .single();

      if (insertError) {
        console.error('Player insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create player' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      playerIds.push(insertedPlayer.player_id);

      // Add player to team with automatic expendables handling
      const { data: destination, error: addError } = await supabase
        .rpc('add_player_to_team_with_expendables', {
          p_team_id: teamId,
          p_player_id: insertedPlayer.player_id,
          p_wage: player.wage,
          p_season: season || 6
        });

      if (addError) {
        console.error('Add player to team error:', addError);
        return new Response(
          JSON.stringify({ error: 'Failed to add player to team' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      playerDestinations.push(destination);
    }

    // Deduct pack cost from team budget
    const { error: budgetError } = await supabase
      .from('teams')
      .update({ budget: team.budget - pack.price })
      .eq('id', teamId);

    if (budgetError) {
      console.error('Budget update error:', budgetError);
      return new Response(
        JSON.stringify({ error: 'Failed to update team budget' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record pack purchase
    const { error: purchaseError } = await supabase
      .from('pack_purchases')
      .insert({
        team_id: teamId,
        pack_id: packId,
        total_cost: pack.price,
        players_obtained: players
      });

    if (purchaseError) {
      console.error('Purchase record error:', purchaseError);
    }

    // Record financial transaction
    const { error: financeError } = await supabase
      .from('finances')
      .insert({
        team_id: teamId,
        amount: -pack.price,
        reason: 'Pack Purchase',
        season: season || 6,
        date: new Date().toISOString()
      });

    if (financeError) {
      console.error('Finance record error:', financeError);
    }

    // Get updated available balance
    const { data: newBalance } = await supabase
      .rpc('get_team_available_balance', { p_team_id: teamId });

    // Add destination info to players
    const playersWithDestinations = players.map((player, index) => ({
      ...player,
      player_id: playerIds[index],
      destination: playerDestinations[index]
    }));

    return new Response(
      JSON.stringify({
        success: true,
        pack: {
          name: pack.tier,
          price: pack.price
        },
        players: playersWithDestinations,
        remainingBalance: newBalance || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pack opening error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 