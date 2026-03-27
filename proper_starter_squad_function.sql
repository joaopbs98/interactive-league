-- Create a proper generate_starter_squad function that follows the specifications
-- Requirements:
-- 1. Get 18 players rated up to 60 overall_rating
-- 2. Minimum 2 GK, 4 Defenders, 4 Midfielders, 4 Attackers
-- 3. Positions: Defenders (CB, LB, RB), Midfielders (CDM, CM, CAM, LM, RM), Attackers (LW, RW, ST, CF)
-- 4. Count only the first position when determining role
-- 5. Put all players in reserves initially

CREATE OR REPLACE FUNCTION generate_starter_squad(p_team_id UUID, p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_player_count INTEGER := 18; -- Total squad size
  v_gk_count INTEGER := 0;
  v_def_count INTEGER := 0;
  v_mid_count INTEGER := 0;
  v_att_count INTEGER := 0;
  v_assigned_count INTEGER := 0;
  v_player_id UUID;
  v_player_name TEXT;
  v_player_positions TEXT;
  v_player_rating INTEGER;
  v_first_position TEXT;
  v_available_players CURSOR FOR
    SELECT id, player_name, positions, rating FROM league_players 
    WHERE league_id = p_league_id 
    AND team_id IS NULL 
    AND rating <= 60
    ORDER BY random();
  result JSON;
BEGIN
  -- Get available players for this league and assign them based on position requirements
  OPEN v_available_players;
  FETCH v_available_players INTO v_player_id, v_player_name, v_player_positions, v_player_rating;
  
  WHILE FOUND AND v_assigned_count < v_player_count LOOP
    -- Extract first position (before comma)
    v_first_position := split_part(v_player_positions, ',', 1);
    v_first_position := trim(v_first_position);
    
    -- Check if we need this position type
    IF v_first_position = 'GK' AND v_gk_count < 2 THEN
      -- Assign goalkeeper
      UPDATE league_players 
      SET team_id = p_team_id 
      WHERE id = v_player_id;
      v_gk_count := v_gk_count + 1;
      v_assigned_count := v_assigned_count + 1;
      
    ELSIF v_first_position IN ('CB', 'LB', 'RB') AND v_def_count < 4 THEN
      -- Assign defender
      UPDATE league_players 
      SET team_id = p_team_id 
      WHERE id = v_player_id;
      v_def_count := v_def_count + 1;
      v_assigned_count := v_assigned_count + 1;
      
    ELSIF v_first_position IN ('CDM', 'CM', 'CAM', 'LM', 'RM') AND v_mid_count < 4 THEN
      -- Assign midfielder
      UPDATE league_players 
      SET team_id = p_team_id 
      WHERE id = v_player_id;
      v_mid_count := v_mid_count + 1;
      v_assigned_count := v_assigned_count + 1;
      
    ELSIF v_first_position IN ('LW', 'RW', 'ST', 'CF') AND v_att_count < 4 THEN
      -- Assign attacker
      UPDATE league_players 
      SET team_id = p_team_id 
      WHERE id = v_player_id;
      v_att_count := v_att_count + 1;
      v_assigned_count := v_assigned_count + 1;
      
    ELSIF v_assigned_count >= 14 THEN
      -- Fill remaining slots with any available players
      UPDATE league_players 
      SET team_id = p_team_id 
      WHERE id = v_player_id;
      v_assigned_count := v_assigned_count + 1;
    END IF;
    
    FETCH v_available_players INTO v_player_id, v_player_name, v_player_positions, v_player_rating;
  END LOOP;
  
  CLOSE v_available_players;
  
  -- Update team to put all players in reserves initially
  UPDATE teams 
  SET reserves = (
    SELECT array_agg(player_id) 
    FROM league_players 
    WHERE team_id = p_team_id
  ),
  starting_lineup = ARRAY[]::TEXT[],
  bench = ARRAY[]::TEXT[]
  WHERE id = p_team_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Starter squad generated successfully',
    'player_count', v_assigned_count,
    'distribution', json_build_object(
      'goalkeepers', v_gk_count,
      'defenders', v_def_count,
      'midfielders', v_mid_count,
      'attackers', v_att_count
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 