-- Fix League-Specific Data Issues
-- This migration addresses the problems with shared data across leagues

-- 1. Add league_id to injuries table to make injuries league-specific
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;

-- Update existing injuries to have league_id based on team's league
UPDATE injuries 
SET league_id = teams.league_id 
FROM teams 
WHERE injuries.team_id = teams.id 
AND injuries.league_id IS NULL;

-- Make league_id NOT NULL after updating existing data
ALTER TABLE injuries ALTER COLUMN league_id SET NOT NULL;

-- Create index for league-specific queries
CREATE INDEX IF NOT EXISTS idx_injuries_league_id ON injuries(league_id);

-- 2. Create league_players table to make players league-specific
CREATE TABLE IF NOT EXISTS league_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  positions TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating <= 60),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, player_id)
);

-- Create indexes for league_players
CREATE INDEX IF NOT EXISTS idx_league_players_league_id ON league_players(league_id);
CREATE INDEX IF NOT EXISTS idx_league_players_team_id ON league_players(team_id);
CREATE INDEX IF NOT EXISTS idx_league_players_rating ON league_players(rating);

-- Enable RLS on league_players
ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;

-- RLS policies for league_players
DROP POLICY IF EXISTS "Users can view players in their leagues" ON league_players;
DROP POLICY IF EXISTS "Users can insert players in their leagues" ON league_players;
DROP POLICY IF EXISTS "Users can update players in their leagues" ON league_players;
DROP POLICY IF EXISTS "Users can delete players in their leagues" ON league_players;

CREATE POLICY "Users can view players in their leagues" ON league_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = league_players.team_id 
      AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = league_players.league_id 
      AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert players in their leagues" ON league_players
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = league_players.league_id 
      AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update players in their leagues" ON league_players
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = league_players.league_id 
      AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete players in their leagues" ON league_players
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = league_players.league_id 
      AND teams.user_id = auth.uid()
    )
  );

-- 3. Add active_season to leagues table
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS active_season INTEGER DEFAULT 1;

-- 4. Update RLS policies for injuries to be league-specific
DROP POLICY IF EXISTS "Users can view injuries for their teams" ON injuries;
DROP POLICY IF EXISTS "Users can insert injuries for their teams" ON injuries;
DROP POLICY IF EXISTS "Users can update injuries for their teams" ON injuries;
DROP POLICY IF EXISTS "Users can delete injuries for their teams" ON injuries;
DROP POLICY IF EXISTS "Users can view injuries in their leagues" ON injuries;
DROP POLICY IF EXISTS "Users can insert injuries in their leagues" ON injuries;
DROP POLICY IF EXISTS "Users can update injuries in their leagues" ON injuries;
DROP POLICY IF EXISTS "Users can delete injuries in their leagues" ON injuries;

-- New league-specific policies for injuries
CREATE POLICY "Users can view injuries in their leagues" ON injuries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = injuries.league_id 
      AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert injuries in their leagues" ON injuries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = injuries.league_id 
      AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update injuries in their leagues" ON injuries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = injuries.league_id 
      AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete injuries in their leagues" ON injuries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.league_id = injuries.league_id 
      AND teams.user_id = auth.uid()
    )
  );

-- 5. Function to generate league-specific player pool with proper rating distribution
CREATE OR REPLACE FUNCTION generate_league_players(p_league_id UUID, p_player_count INTEGER DEFAULT 1000)
RETURNS void AS $$
DECLARE
  i INTEGER;
  player_rating INTEGER;
  positions TEXT[] := ARRAY['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'];
  position TEXT;
  player_name TEXT;
BEGIN
  -- Clear existing players for this league
  DELETE FROM league_players WHERE league_id = p_league_id;
  
  -- Generate players with proper rating distribution (max 60, weighted towards lower ratings)
  FOR i IN 1..p_player_count LOOP
    -- Generate rating with proper distribution
    player_rating := CASE 
      WHEN random() < 0.4 THEN floor(random() * 20) + 40  -- 40-59 (40% chance)
      WHEN random() < 0.7 THEN floor(random() * 10) + 50  -- 50-59 (30% chance)
      WHEN random() < 0.9 THEN floor(random() * 5) + 55   -- 55-59 (20% chance)
      ELSE floor(random() * 5) + 55                       -- 55-59 (10% chance)
    END;
    
    -- Ensure max rating is 60
    player_rating := LEAST(player_rating, 60);
    
    -- Select random position
    position := positions[floor(random() * array_length(positions, 1)) + 1];
    
    -- Generate player name
    player_name := 'Player_' || i::TEXT;
    
    -- Insert player
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating)
    VALUES (p_league_id, 'player_' || i::TEXT, player_name, position, player_rating);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to generate starter squad with proper rating distribution
CREATE OR REPLACE FUNCTION generate_starter_squad(p_team_id UUID, p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_player_count INTEGER := 25; -- Standard squad size
  v_players league_players[];
  v_player league_players;
  v_available_players CURSOR FOR
    SELECT * FROM league_players 
    WHERE league_id = p_league_id 
    AND team_id IS NULL 
    ORDER BY random() 
    LIMIT v_player_count;
  result JSON;
BEGIN
  -- Get available players for this league
  OPEN v_available_players;
  FETCH v_available_players INTO v_player;
  
  WHILE FOUND LOOP
    v_players := array_append(v_players, v_player);
    FETCH v_available_players INTO v_player;
  END LOOP;
  
  CLOSE v_available_players;
  
  -- Assign players to team
  FOR i IN 1..array_length(v_players, 1) LOOP
    UPDATE league_players 
    SET team_id = p_team_id 
    WHERE id = v_players[i].id;
  END LOOP;
  
  result := json_build_object(
    'success', true,
    'message', 'Starter squad generated successfully',
    'player_count', array_length(v_players, 1)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to leave league (remove user from team and delete league if empty)
CREATE OR REPLACE FUNCTION leave_league(p_team_id UUID)
RETURNS JSON AS $$
DECLARE
  v_league_id UUID;
  v_remaining_teams INTEGER;
  result JSON;
BEGIN
  -- Get the league_id for this team
  SELECT league_id INTO v_league_id FROM teams WHERE id = p_team_id;
  
  IF v_league_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team not found or not in a league');
  END IF;
  
  -- Remove user from team
  UPDATE teams SET user_id = NULL WHERE id = p_team_id;
  
  -- Count remaining teams with users in the league
  SELECT COUNT(*) INTO v_remaining_teams 
  FROM teams 
  WHERE league_id = v_league_id AND user_id IS NOT NULL;
  
  -- If no teams remain, delete the league and all associated data
  IF v_remaining_teams = 0 THEN
    -- Delete league_players
    DELETE FROM league_players WHERE league_id = v_league_id;
    
    -- Delete injuries
    DELETE FROM injuries WHERE league_id = v_league_id;
    
    -- Delete teams (cascade will handle other related data)
    DELETE FROM teams WHERE league_id = v_league_id;
    
    -- Delete league
    DELETE FROM leagues WHERE id = v_league_id;
    
    result := json_build_object(
      'success', true, 
      'message', 'Left league and league was deleted as no teams remained',
      'league_deleted', true
    );
  ELSE
    result := json_build_object(
      'success', true, 
      'message', 'Successfully left league',
      'league_deleted', false,
      'remaining_teams', v_remaining_teams
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to update pack weights based on season
CREATE OR REPLACE FUNCTION update_pack_weights_for_season(p_league_id UUID, p_season INTEGER)
RETURNS void AS $$
DECLARE
  v_base_multiplier FLOAT;
BEGIN
  -- Calculate base multiplier based on season (better players in later seasons)
  v_base_multiplier := 1.0 + (p_season - 1) * 0.1; -- 10% improvement per season
  
  -- Update pack rating odds for this league's season
  UPDATE pack_rating_odds 
  SET probability = probability * v_base_multiplier
  WHERE pack_id IN (
    SELECT id FROM packs WHERE season = p_season
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 