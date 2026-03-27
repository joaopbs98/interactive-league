-- Migration 015: Update starter squad generation with proper position distribution
-- This migration updates the generate_starter_squad function to create teams with 18 players
-- and proper position distribution as specified in the requirements

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_starter_squad(UUID, UUID);

-- Create the updated function with proper position distribution
CREATE OR REPLACE FUNCTION generate_starter_squad(p_team_id UUID, p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_squad_size INTEGER := 18; -- Updated squad size
  v_players league_players[];
  v_player league_players;
  v_gk_count INTEGER := 0;
  v_def_count INTEGER := 0;
  v_mid_count INTEGER := 0;
  v_att_count INTEGER := 0;
  v_flex_count INTEGER := 0;
  v_total_players INTEGER := 0;
  v_available_players CURSOR FOR
    SELECT * FROM league_players 
    WHERE league_id = p_league_id 
    AND team_id IS NULL 
    AND rating BETWEEN 40 AND 60
    ORDER BY random();
  result JSON;
BEGIN
  -- Get available players for this league
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
      IF NOT (v_player.id = ANY(SELECT unnest(array(SELECT id FROM unnest(v_players))))) THEN
        v_players := array_append(v_players, v_player);
        v_total_players := v_total_players + 1;
      END IF;
    END LOOP;
    CLOSE v_available_players;
  END IF;
  
  -- Assign players to team
  FOR i IN 1..array_length(v_players, 1) LOOP
    UPDATE league_players 
    SET team_id = p_team_id 
    WHERE id = v_players[i].id;
  END LOOP;
  
  -- Build squad data for the team
  UPDATE teams 
  SET squad = (
    SELECT json_agg(
      json_build_object(
        'player_id', lp.player_id,
        'name', lp.player_name,
        'positions', lp.positions,
        'overall_rating', lp.rating
      )
    )
    FROM league_players lp
    WHERE lp.team_id = p_team_id
  )
  WHERE id = p_team_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Starter squad generated successfully',
    'player_count', array_length(v_players, 1),
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