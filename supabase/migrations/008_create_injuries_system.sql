-- Create Injuries and Suspensions Management System
-- This system handles both injuries and suspensions in a unified table

-- Create the injuries table
CREATE TABLE IF NOT EXISTS injuries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('injury', 'suspension')),
  description TEXT,
  games_remaining INTEGER NOT NULL DEFAULT 1,
  return_date DATE,
  match_id UUID, -- Optional: reference to the match where injury/suspension occurred
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_injuries_player_id ON injuries(player_id);
CREATE INDEX IF NOT EXISTS idx_injuries_team_id ON injuries(team_id);
CREATE INDEX IF NOT EXISTS idx_injuries_active ON injuries(games_remaining) WHERE games_remaining > 0;

-- Create RLS policies for injuries table
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;

-- Users can view injuries for teams they own
CREATE POLICY "Users can view injuries for their teams" ON injuries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = injuries.team_id 
      AND teams.user_id = auth.uid()
    )
  );

-- Users can insert injuries for their teams
CREATE POLICY "Users can insert injuries for their teams" ON injuries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = injuries.team_id 
      AND teams.user_id = auth.uid()
    )
  );

-- Users can update injuries for their teams
CREATE POLICY "Users can update injuries for their teams" ON injuries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = injuries.team_id 
      AND teams.user_id = auth.uid()
    )
  );

-- Users can delete injuries for their teams
CREATE POLICY "Users can delete injuries for their teams" ON injuries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = injuries.team_id 
      AND teams.user_id = auth.uid()
    )
  );

-- Function to decrement games_remaining for all active injuries/suspensions
CREATE OR REPLACE FUNCTION decrement_injuries_games()
RETURNS void AS $$
BEGIN
  -- Decrement games_remaining for all active injuries/suspensions
  UPDATE injuries 
  SET 
    games_remaining = GREATEST(0, games_remaining - 1),
    updated_at = NOW()
  WHERE games_remaining > 0;
  
  -- Remove entries where games_remaining is now 0
  DELETE FROM injuries WHERE games_remaining = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active injuries/suspensions for a team
CREATE OR REPLACE FUNCTION get_team_injuries(p_team_id UUID)
RETURNS TABLE (
  id UUID,
  player_id TEXT,
  player_name TEXT,
  type TEXT,
  description TEXT,
  games_remaining INTEGER,
  return_date DATE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.player_id,
    p.name as player_name,
    i.type,
    i.description,
    i.games_remaining,
    i.return_date,
    i.created_at
  FROM injuries i
  JOIN player p ON i.player_id = p.player_id
  WHERE i.team_id = p_team_id AND i.games_remaining > 0
  ORDER BY i.games_remaining ASC, i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a player is available (not injured/suspended)
CREATE OR REPLACE FUNCTION is_player_available(p_player_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM injuries 
    WHERE player_id = p_player_id AND games_remaining > 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 