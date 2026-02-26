-- Migration 020: Fix starter squad to distribute players to starting_lineup, bench, and reserves
-- This migration updates the generate_starter_squad function to properly distribute players
-- to starting_lineup (11 players), bench (7 players), and reserves (remaining players)

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_starter_squad(UUID, UUID);

-- Create the updated function that distributes players correctly
CREATE OR REPLACE FUNCTION generate_starter_squad(p_team_id UUID, p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_squad_size INTEGER := 18; -- Updated squad size
  v_players player[];
  v_player player;
  v_gk_count INTEGER := 0;
  v_def_count INTEGER := 0;
  v_mid_count INTEGER := 0;
  v_att_count INTEGER := 0;
  v_flex_count INTEGER := 0;
  v_total_players INTEGER := 0;
  v_available_players CURSOR FOR
    SELECT * FROM player 
    WHERE overall_rating BETWEEN 40 AND 60
    AND player_id NOT IN (
      -- Exclude players already assigned to teams in this league
      SELECT DISTINCT lp.player_id 
      FROM league_players lp
      WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
    )
    AND player_id NOT IN (
      -- Exclude players already assigned to teams in other leagues
      SELECT DISTINCT lp.player_id 
      FROM league_players lp
      WHERE lp.league_id != p_league_id AND lp.team_id IS NOT NULL
    )
    ORDER BY random();
  v_starting_lineup JSONB := '[]'::JSONB;
  v_bench JSONB := '[]'::JSONB;
  v_reserves JSONB := '[]'::JSONB;
  v_player_json JSONB;
  result JSON;
BEGIN
  -- Get available players from global pool
  OPEN v_available_players;
  
  -- First pass: Get required position players
  WHILE v_total_players < v_squad_size LOOP
    FETCH v_available_players INTO v_player;
    
    IF NOT FOUND THEN
      EXIT;
    END IF;
    
    -- Check if player fits position requirements
    IF v_gk_count < 2 AND (v_player.positions LIKE '%GK%') THEN
      v_players := array_append(v_players, v_player);
      v_gk_count := v_gk_count + 1;
      v_total_players := v_total_players + 1;
    ELSIF v_def_count < 5 AND (
      v_player.positions LIKE '%LB%' OR 
      v_player.positions LIKE '%CB%' OR 
      v_player.positions LIKE '%RB%'
    ) THEN
      v_players := array_append(v_players, v_player);
      v_def_count := v_def_count + 1;
      v_total_players := v_total_players + 1;
    ELSIF v_mid_count < 5 AND (
      v_player.positions LIKE '%CDM%' OR 
      v_player.positions LIKE '%CM%' OR 
      v_player.positions LIKE '%CAM%' OR 
      v_player.positions LIKE '%LM%' OR 
      v_player.positions LIKE '%RM%'
    ) THEN
      v_players := array_append(v_players, v_player);
      v_mid_count := v_mid_count + 1;
      v_total_players := v_total_players + 1;
    ELSIF v_att_count < 4 AND (
      v_player.positions LIKE '%LW%' OR 
      v_player.positions LIKE '%CF%' OR 
      v_player.positions LIKE '%ST%' OR 
      v_player.positions LIKE '%RW%'
    ) THEN
      v_players := array_append(v_players, v_player);
      v_att_count := v_att_count + 1;
      v_total_players := v_total_players + 1;
    ELSIF v_flex_count < 2 THEN
      -- Flex positions can be any player
      v_players := array_append(v_players, v_player);
      v_flex_count := v_flex_count + 1;
      v_total_players := v_total_players + 1;
    END IF;
  END LOOP;
  
  CLOSE v_available_players;
  
  -- If we don't have enough players, get more flex players
  IF v_total_players < v_squad_size THEN
    OPEN v_available_players;
    WHILE v_total_players < v_squad_size LOOP
      FETCH v_available_players INTO v_player;
      
      IF NOT FOUND THEN
        EXIT;
      END IF;
      
      -- Check if player is already in the squad
      IF NOT (v_player.player_id = ANY(SELECT unnest(array(SELECT player_id FROM unnest(v_players))))) THEN
        v_players := array_append(v_players, v_player);
        v_total_players := v_total_players + 1;
      END IF;
    END LOOP;
    CLOSE v_available_players;
  END IF;
  
  -- Insert players into league_players table and assign to team
  FOR i IN 1..array_length(v_players, 1) LOOP
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id)
    VALUES (
      p_league_id,
      v_players[i].player_id,
      COALESCE(v_players[i].name, v_players[i].full_name, 'Unknown Player'),
      v_players[i].positions,
      v_players[i].overall_rating,
      p_team_id
    )
    ON CONFLICT (league_id, player_id) 
    DO UPDATE SET 
      team_id = p_team_id,
      updated_at = NOW();
  END LOOP;
  
  -- Distribute players to starting_lineup, bench, and reserves
  FOR i IN 1..array_length(v_players, 1) LOOP
    -- Create player JSON object
    v_player_json := jsonb_build_object(
      'player_id', v_players[i].player_id,
      'name', COALESCE(v_players[i].name, v_players[i].full_name, 'Unknown Player'),
      'positions', v_players[i].positions,
      'overall_rating', v_players[i].overall_rating,
      'club_name', v_players[i].club_name,
      'image', v_players[i].image,
      'wage', v_players[i].wage,
      'value', v_players[i].value,
      'dob', v_players[i].dob,
      'height_cm', v_players[i].height_cm,
      'weight_kg', v_players[i].weight_kg,
      'preferred_foot', v_players[i].preferred_foot,
      'weak_foot', v_players[i].weak_foot,
      'skill_moves', v_players[i].skill_moves,
      'work_rate', v_players[i].work_rate,
      'body_type', v_players[i].body_type,
      'real_face', v_players[i].real_face,
      'international_reputation', v_players[i].international_reputation,
      'release_clause', v_players[i].release_clause,
      'club_contract_valid_until', v_players[i].club_contract_valid_until,
      'club_joined', v_players[i].club_joined,
      'club_kit_number', v_players[i].club_kit_number,
      'club_position', v_players[i].club_position,
      'club_rating', v_players[i].club_rating,
      'country_name', v_players[i].country_name,
      'country_flag', v_players[i].country_flag,
      'country_kit_number', v_players[i].country_kit_number,
      'country_position', v_players[i].country_position,
      'country_rating', v_players[i].country_rating,
      'acceleration', v_players[i].acceleration,
      'sprint_speed', v_players[i].sprint_speed,
      'finishing', v_players[i].finishing,
      'shot_power', v_players[i].shot_power,
      'long_shots', v_players[i].long_shots,
      'volleys', v_players[i].volleys,
      'penalties', v_players[i].penalties,
      'vision', v_players[i].vision,
      'crossing', v_players[i].crossing,
      'free_kick_accuracy', v_players[i].fk_accuracy,
      'short_passing', v_players[i].short_passing,
      'long_passing', v_players[i].long_passing,
      'curve', v_players[i].curve,
      'agility', v_players[i].agility,
      'balance', v_players[i].balance,
      'reactions', v_players[i].reactions,
      'ball_control', v_players[i].ball_control,
      'dribbling', v_players[i].dribbling,
      'composure', v_players[i].composure,
      'interceptions', v_players[i].interceptions,
      'heading_accuracy', v_players[i].heading_accuracy,
      'marking', v_players[i].defensive_awareness,
      'standing_tackle', v_players[i].standing_tackle,
      'sliding_tackle', v_players[i].sliding_tackle,
      'jumping', v_players[i].jumping,
      'stamina', v_players[i].stamina,
      'strength', v_players[i].strength,
      'aggression', v_players[i].aggression,
      'gk_diving', v_players[i].gk_diving,
      'gk_handling', v_players[i].gk_handling,
      'gk_kicking', v_players[i].gk_kicking,
      'gk_positioning', v_players[i].gk_positioning,
      'gk_reflexes', v_players[i].gk_reflexes
    );
    
    -- Distribute players: first 11 to starting_lineup, next 7 to bench, rest to reserves
    IF i <= 11 THEN
      v_starting_lineup := v_starting_lineup || v_player_json;
    ELSIF i <= 18 THEN
      v_bench := v_bench || v_player_json;
    ELSE
      v_reserves := v_reserves || v_player_json;
    END IF;
  END LOOP;
  
  -- Update team with squad and distribution
  UPDATE teams 
  SET 
    squad = (
      SELECT json_agg(v_players)
      FROM unnest(v_players)
    ),
    starting_lineup = v_starting_lineup,
    bench = v_bench,
    reserves = v_reserves
  WHERE id = p_team_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Starter squad generated successfully with proper distribution',
    'player_count', array_length(v_players, 1),
    'starting_lineup_count', jsonb_array_length(v_starting_lineup),
    'bench_count', jsonb_array_length(v_bench),
    'reserves_count', jsonb_array_length(v_reserves),
    'position_distribution', json_build_object(
      'goalkeepers', v_gk_count,
      'defenders', v_def_count,
      'midfielders', v_mid_count,
      'attackers', v_att_count,
      'flex_positions', v_flex_count
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 