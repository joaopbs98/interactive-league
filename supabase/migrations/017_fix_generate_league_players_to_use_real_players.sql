-- Migration 017: Fix generate_league_players to use real players from global pool
-- This migration updates the generate_league_players function to use real players
-- from the global 'player' table instead of creating artificial players

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_league_players(UUID, INTEGER);

-- Create the updated function that uses real players from the global pool
CREATE OR REPLACE FUNCTION generate_league_players(p_league_id UUID, p_player_count INTEGER DEFAULT 1000)
RETURNS void AS $$
DECLARE
  v_players_to_add INTEGER;
  v_available_players INTEGER;
BEGIN
  -- Clear existing players for this league
  DELETE FROM league_players WHERE league_id = p_league_id;
  
  -- Count how many real players are available in the global pool
  SELECT COUNT(*) INTO v_available_players 
  FROM player 
  WHERE overall_rating <= 60;
  
  -- Determine how many players to add (either requested count or available count, whichever is smaller)
  v_players_to_add := LEAST(p_player_count, v_available_players);
  
  -- Insert real players from the global pool into league_players
  INSERT INTO league_players (league_id, player_id, player_name, positions, rating)
  SELECT 
    p_league_id,
    p.player_id,
    COALESCE(p.name, p.full_name, 'Unknown Player'),
    p.positions,
    p.overall_rating
  FROM player p
  WHERE p.overall_rating <= 60
  AND p.player_id NOT IN (
    -- Exclude players already in other leagues
    SELECT DISTINCT lp.player_id 
    FROM league_players lp 
    WHERE lp.league_id != p_league_id
  )
  ORDER BY random()
  LIMIT v_players_to_add;
  
  -- Log the result
  RAISE NOTICE 'Added % real players to league % (requested: %, available: %)', 
    v_players_to_add, p_league_id, p_player_count, v_available_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 