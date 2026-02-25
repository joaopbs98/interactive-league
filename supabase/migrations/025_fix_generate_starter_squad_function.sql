-- Fix generate_starter_squad function to avoid PostgreSQL argument limit error
-- The issue was that the function was trying to create arrays of complex records
-- which exceeded the 100-argument limit per function call

CREATE OR REPLACE FUNCTION generate_starter_squad(p_team_id UUID, p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_player_count INTEGER := 25; -- Standard squad size
  v_player_id UUID;
  v_assigned_count INTEGER := 0;
  v_available_players CURSOR FOR
    SELECT id FROM league_players 
    WHERE league_id = p_league_id 
    AND team_id IS NULL 
    ORDER BY random() 
    LIMIT v_player_count;
  result JSON;
BEGIN
  -- Get available players for this league and assign them one by one
  OPEN v_available_players;
  FETCH v_available_players INTO v_player_id;
  
  WHILE FOUND LOOP
    -- Assign player to team
    UPDATE league_players 
    SET team_id = p_team_id 
    WHERE id = v_player_id;
    
    v_assigned_count := v_assigned_count + 1;
    FETCH v_available_players INTO v_player_id;
  END LOOP;
  
  CLOSE v_available_players;
  
  result := json_build_object(
    'success', true,
    'message', 'Starter squad generated successfully',
    'player_count', v_assigned_count
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 