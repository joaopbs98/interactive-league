-- Fix generate_league_players function to use real players from the players table
-- This replaces the current function that creates fake players

DROP FUNCTION IF EXISTS generate_league_players(UUID, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION generate_league_players(p_league_id UUID, p_player_count INTEGER DEFAULT 1000)
RETURNS JSON AS $$
DECLARE
  v_actual_count INTEGER;
  v_available_players INTEGER;
BEGIN
  -- Clear existing players for this league
  DELETE FROM league_players WHERE league_id = p_league_id;
  
  -- Get total count of available players in the players table
  SELECT COUNT(*) INTO v_available_players FROM players;
  
  -- Copy real players from players table to league_players table
  INSERT INTO league_players (league_id, player_id, player_name, positions, rating)
  SELECT 
    p_league_id,
    player_id,
    name,
    positions,
    overall_rating
  FROM players
  ORDER BY random()
  LIMIT LEAST(p_player_count, v_available_players);
  
  -- Get the actual number of players inserted
  GET DIAGNOSTICS v_actual_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'message', 'League players generated successfully from real player database',
    'player_count', v_actual_count,
    'available_players', v_available_players,
    'requested_count', p_player_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 