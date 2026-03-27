-- Expand league_players table with essential player data
-- Add full_name, image, and description fields

-- Add new columns to league_players table
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS description TEXT;

-- Update the generate_league_players function to copy essential data
CREATE OR REPLACE FUNCTION generate_league_players(p_league_id UUID, p_player_count INTEGER DEFAULT 1000)
RETURNS JSON AS $$
DECLARE
  v_actual_count INTEGER;
  v_available_players INTEGER;
BEGIN
  -- Clear existing players for this league
  DELETE FROM league_players WHERE league_id = p_league_id;
  
  -- Get total count of available players in the player table
  SELECT COUNT(*) INTO v_available_players FROM player;
  
  -- Copy real players from player table to league_players table with essential data
  INSERT INTO league_players (league_id, player_id, player_name, full_name, image, description, positions, rating)
  SELECT 
    p_league_id,
    player_id,
    name,
    full_name,
    image,
    description,
    positions,
    overall_rating
  FROM player
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