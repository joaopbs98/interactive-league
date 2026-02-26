-- Add expendables section to teams table (if not exists)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS expendables TEXT[] DEFAULT '{}';

-- Create pack_purchases table if it doesn't exist
CREATE TABLE IF NOT EXISTS pack_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  pack_id INTEGER NOT NULL REFERENCES packs(id),
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_cost INTEGER NOT NULL,
  players_obtained JSONB NOT NULL -- Store the players that were obtained
);

-- Create index for pack purchases (if not exists)
CREATE INDEX IF NOT EXISTS idx_pack_purchases_team_id ON pack_purchases(team_id);
CREATE INDEX IF NOT EXISTS idx_pack_purchases_purchased_at ON pack_purchases(purchased_at);

-- Enable RLS on pack_purchases (if not already enabled)
ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view their own pack purchases" ON pack_purchases;
DROP POLICY IF EXISTS "Users can insert their own pack purchases" ON pack_purchases;

-- RLS policies for pack_purchases
CREATE POLICY "Users can view their own pack purchases" ON pack_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = pack_purchases.team_id 
      AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own pack purchases" ON pack_purchases
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = pack_purchases.team_id 
      AND teams.user_id = auth.uid()
    )
  );

-- Function to calculate team's total wage expenditure
CREATE OR REPLACE FUNCTION calculate_team_wages(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_wages INTEGER;
BEGIN
  SELECT COALESCE(SUM(c.wage), 0) INTO total_wages
  FROM contracts c
  WHERE c.team_id = p_team_id;
  
  RETURN total_wages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team's available balance (budget - total wages)
CREATE OR REPLACE FUNCTION get_team_available_balance(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  team_budget INTEGER;
  total_wages INTEGER;
BEGIN
  SELECT COALESCE(budget, 0) INTO team_budget
  FROM teams
  WHERE id = p_team_id;
  
  SELECT calculate_team_wages(p_team_id) INTO total_wages;
  
  RETURN GREATEST(0, team_budget - total_wages);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to move player to expendables
CREATE OR REPLACE FUNCTION move_player_to_expendables(p_team_id UUID, p_player_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_expendables TEXT[];
BEGIN
  -- Get current expendables
  SELECT COALESCE(expendables, '{}') INTO current_expendables
  FROM teams
  WHERE id = p_team_id;
  
  -- Add player to expendables if not already there
  IF NOT (p_player_id = ANY(current_expendables)) THEN
    UPDATE teams
    SET expendables = array_append(current_expendables, p_player_id)
    WHERE id = p_team_id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release player (remove from team and add wage back to budget)
CREATE OR REPLACE FUNCTION release_player(p_team_id UUID, p_player_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  player_wage INTEGER;
  current_budget INTEGER;
BEGIN
  -- Get player's wage
  SELECT COALESCE(wage, 0) INTO player_wage
  FROM contracts
  WHERE team_id = p_team_id AND player_id = p_player_id;
  
  -- Get current budget
  SELECT COALESCE(budget, 0) INTO current_budget
  FROM teams
  WHERE id = p_team_id;
  
  -- Update team budget (add wage back)
  UPDATE teams
  SET budget = current_budget + player_wage
  WHERE id = p_team_id;
  
  -- Remove player from team_squad
  DELETE FROM team_squad
  WHERE team_id = p_team_id AND player_id = p_player_id;
  
  -- Remove player from contracts
  DELETE FROM contracts
  WHERE team_id = p_team_id AND player_id = p_player_id;
  
  -- Remove from expendables if present
  UPDATE teams
  SET expendables = array_remove(expendables, p_player_id)
  WHERE id = p_team_id;
  
  -- Remove from starting_lineup, bench, reserves if present
  UPDATE teams
  SET 
    starting_lineup = CASE 
      WHEN starting_lineup ? p_player_id THEN starting_lineup - p_player_id
      ELSE starting_lineup
    END,
    bench = CASE 
      WHEN bench @> ARRAY[p_player_id] THEN array_remove(bench, p_player_id)
      ELSE bench
    END,
    reserves = CASE 
      WHEN reserves @> ARRAY[p_player_id] THEN array_remove(reserves, p_player_id)
      ELSE reserves
    END
  WHERE id = p_team_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to move player from expendables to squad
CREATE OR REPLACE FUNCTION move_from_expendables_to_squad(p_team_id UUID, p_player_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_expendables TEXT[];
  squad_size INTEGER;
BEGIN
  -- Get current expendables
  SELECT COALESCE(expendables, '{}') INTO current_expendables
  FROM teams
  WHERE id = p_team_id;
  
  -- Check if player is in expendables
  IF NOT (p_player_id = ANY(current_expendables)) THEN
    RETURN FALSE;
  END IF;
  
  -- Count current squad size
  SELECT COUNT(*) INTO squad_size
  FROM team_squad
  WHERE team_id = p_team_id;
  
  -- If squad has less than 25 players, move to squad
  IF squad_size < 25 THEN
    -- Remove from expendables
    UPDATE teams
    SET expendables = array_remove(current_expendables, p_player_id)
    WHERE id = p_team_id;
    
    -- Add to team_squad if not already there
    INSERT INTO team_squad (team_id, player_id)
    VALUES (p_team_id, p_player_id)
    ON CONFLICT (team_id, player_id) DO NOTHING;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add player to team with automatic expendables handling
CREATE OR REPLACE FUNCTION add_player_to_team_with_expendables(p_team_id UUID, p_player_id TEXT, p_wage INTEGER, p_season INTEGER)
RETURNS TEXT AS $$
DECLARE
  squad_size INTEGER;
  current_expendables TEXT[];
BEGIN
  -- Count current squad size
  SELECT COUNT(*) INTO squad_size
  FROM team_squad
  WHERE team_id = p_team_id;
  
  -- If squad is full (25 players), move to expendables
  IF squad_size >= 25 THEN
    -- Get current expendables
    SELECT COALESCE(expendables, '{}') INTO current_expendables
    FROM teams
    WHERE id = p_team_id;
    
    -- Add to expendables
    UPDATE teams
    SET expendables = array_append(current_expendables, p_player_id)
    WHERE id = p_team_id;
    
    -- Still create contract for wage calculation
    INSERT INTO contracts (team_id, player_id, wage, start_season, years)
    VALUES (p_team_id, p_player_id, p_wage, p_season, 3)
    ON CONFLICT (team_id, player_id) DO NOTHING;
    
    RETURN 'expendables';
  ELSE
    -- Add to squad normally
    INSERT INTO team_squad (team_id, player_id)
    VALUES (p_team_id, p_player_id)
    ON CONFLICT (team_id, player_id) DO NOTHING;
    
    -- Create contract
    INSERT INTO contracts (team_id, player_id, wage, start_season, years)
    VALUES (p_team_id, p_player_id, p_wage, p_season, 3)
    ON CONFLICT (team_id, player_id) DO NOTHING;
    
    RETURN 'squad';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 