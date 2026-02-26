-- Migration 016: Fix starter squad generation to use global players table
-- This migration updates the generate_starter_squad function to use the global 'player' table
-- instead of the league-specific 'league_players' table

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_starter_squad(UUID, UUID);

-- Create the updated function that uses the global player table
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
      SELECT DISTINCT p.player_id 
      FROM player p
      INNER JOIN league_players lp ON p.player_id = lp.player_id
      WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
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