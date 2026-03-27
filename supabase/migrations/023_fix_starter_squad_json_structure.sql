-- Migration 023: Fix starter squad JSON structure and player distribution
-- This migration fixes the generate_starter_squad function to properly structure JSON data
-- and distribute players into starting_lineup, bench, and reserves fields

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_starter_squad(UUID, UUID);

-- Create the corrected function that properly structures JSON data
CREATE OR REPLACE FUNCTION generate_starter_squad(p_team_id UUID, p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_squad_size INTEGER := 18;
  v_players player[];
  v_player player;
  v_gk_count INTEGER := 0;
  v_def_count INTEGER := 0;
  v_mid_count INTEGER := 0;
  v_att_count INTEGER := 0;
  v_flex_count INTEGER := 0;
  v_total_players INTEGER := 0;
  v_squad_json JSONB := '[]'::JSONB;
  v_starting_lineup JSONB := '[]'::JSONB;
  v_bench JSONB := '[]'::JSONB;
  v_reserves JSONB := '[]'::JSONB;
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
  
  -- Build squad JSON with proper player objects
  FOR i IN 1..array_length(v_players, 1) LOOP
    v_squad_json := v_squad_json || jsonb_build_object(
      'player_id', v_players[i].player_id,
      'name', COALESCE(v_players[i].name, v_players[i].full_name, 'Unknown Player'),
      'positions', v_players[i].positions,
      'overall_rating', v_players[i].overall_rating,
      'image', v_players[i].image,
      'wage', v_players[i].wage,
      'value', v_players[i].value,
      'age', v_players[i].age,
      'height', v_players[i].height,
      'weight', v_players[i].weight,
      'nationality', v_players[i].nationality,
      'club', v_players[i].club,
      'league', v_players[i].league,
      'preferred_foot', v_players[i].preferred_foot,
      'weak_foot', v_players[i].weak_foot,
      'skill_moves', v_players[i].skill_moves,
      'international_reputation', v_players[i].international_reputation,
      'work_rate', v_players[i].work_rate,
      'body_type', v_players[i].body_type,
      'real_face', v_players[i].real_face,
      'release_clause', v_players[i].release_clause,
      'team_position', v_players[i].team_position,
      'team_jersey_number', v_players[i].team_jersey_number,
      'loaned_from', v_players[i].loaned_from,
      'contract_valid_until', v_players[i].contract_valid_until,
      'nation_position', v_players[i].nation_position,
      'nation_jersey_number', v_players[i].nation_jersey_number,
      'pace', v_players[i].pace,
      'shooting', v_players[i].shooting,
      'passing', v_players[i].passing,
      'dribbling', v_players[i].dribbling,
      'defending', v_players[i].defending,
      'physic', v_players[i].physic,
      'attacking_crossing', v_players[i].attacking_crossing,
      'attacking_finishing', v_players[i].attacking_finishing,
      'attacking_heading_accuracy', v_players[i].attacking_heading_accuracy,
      'attacking_short_passing', v_players[i].attacking_short_passing,
      'attacking_volleys', v_players[i].attacking_volleys,
      'skill_dribbling', v_players[i].skill_dribbling,
      'skill_curve', v_players[i].skill_curve,
      'skill_fk_accuracy', v_players[i].skill_fk_accuracy,
      'skill_long_passing', v_players[i].skill_long_passing,
      'skill_ball_control', v_players[i].skill_ball_control,
      'movement_acceleration', v_players[i].movement_acceleration,
      'movement_sprint_speed', v_players[i].movement_sprint_speed,
      'movement_agility', v_players[i].movement_agility,
      'movement_balance', v_players[i].movement_balance,
      'movement_reactions', v_players[i].movement_reactions,
      'movement_ball_control', v_players[i].movement_ball_control,
      'power_shot_power', v_players[i].power_shot_power,
      'power_jumping', v_players[i].power_jumping,
      'power_stamina', v_players[i].power_stamina,
      'power_strength', v_players[i].power_strength,
      'power_long_shots', v_players[i].power_long_shots,
      'mentality_aggression', v_players[i].mentality_aggression,
      'mentality_interceptions', v_players[i].mentality_interceptions,
      'mentality_positioning', v_players[i].mentality_positioning,
      'mentality_vision', v_players[i].mentality_vision,
      'mentality_penalties', v_players[i].mentality_penalties,
      'mentality_composure', v_players[i].mentality_composure,
      'defending_marking', v_players[i].defending_marking,
      'defending_standing_tackle', v_players[i].defending_standing_tackle,
      'defending_sliding_tackle', v_players[i].defending_sliding_tackle,
      'goalkeeping_diving', v_players[i].goalkeeping_diving,
      'goalkeeping_handling', v_players[i].goalkeeping_handling,
      'goalkeeping_kicking', v_players[i].goalkeeping_kicking,
      'goalkeeping_positioning', v_players[i].goalkeeping_positioning,
      'goalkeeping_reflexes', v_players[i].goalkeeping_reflexes,
      'goalkeeping_speed', v_players[i].goalkeeping_speed
    );
  END LOOP;
  
  -- Distribute players into starting_lineup (11), bench (7), reserves (remaining)
  FOR i IN 1..array_length(v_players, 1) LOOP
    IF i <= 11 THEN
      -- Starting lineup (first 11 players)
      v_starting_lineup := v_starting_lineup || v_squad_json->(i-1);
    ELSIF i <= 18 THEN
      -- Bench (next 7 players)
      v_bench := v_bench || v_squad_json->(i-1);
    ELSE
      -- Reserves (remaining players)
      v_reserves := v_reserves || v_squad_json->(i-1);
    END IF;
  END LOOP;
  
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
  
  -- Update team with properly structured JSON data
  UPDATE teams 
  SET 
    squad = v_squad_json,
    starting_lineup = v_starting_lineup,
    bench = v_bench,
    reserves = v_reserves
  WHERE id = p_team_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Starter squad generated successfully with proper JSON structure',
    'player_count', array_length(v_players, 1),
    'squad_size', jsonb_array_length(v_squad_json),
    'starting_lineup_size', jsonb_array_length(v_starting_lineup),
    'bench_size', jsonb_array_length(v_bench),
    'reserves_size', jsonb_array_length(v_reserves),
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