-- Implement table partitioning for league_players by league_id
-- This provides better performance and data isolation for multiple leagues

-- First, let's create a new partitioned table structure
-- We'll need to recreate the table with partitioning

-- Step 1: Create the new partitioned table
-- IMPORTANT: Primary key must include the partitioning column (league_id)
CREATE TABLE league_players_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    full_name TEXT,
    image TEXT,
    description TEXT,
    positions TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating <= 60),
    team_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (league_id, id)  -- Include league_id in primary key for partitioning
) PARTITION BY HASH (league_id);

-- Step 2: Create partitions (we'll create 8 partitions for good distribution)
-- This will automatically distribute leagues across partitions based on hash
CREATE TABLE league_players_p0 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 0);

CREATE TABLE league_players_p1 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 1);

CREATE TABLE league_players_p2 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 2);

CREATE TABLE league_players_p3 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 3);

CREATE TABLE league_players_p4 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 4);

CREATE TABLE league_players_p5 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 5);

CREATE TABLE league_players_p6 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 6);

CREATE TABLE league_players_p7 PARTITION OF league_players_partitioned
    FOR VALUES WITH (modulus 8, remainder 7);

-- Step 3: Create indexes on the partitioned table
-- These will be automatically created on all partitions
CREATE INDEX idx_league_players_partitioned_league_id ON league_players_partitioned (league_id);
CREATE INDEX idx_league_players_partitioned_team_id ON league_players_partitioned (team_id);
CREATE INDEX idx_league_players_partitioned_rating ON league_players_partitioned (rating);
CREATE INDEX idx_league_players_partitioned_player_id ON league_players_partitioned (player_id);

-- Step 4: Add foreign key constraints
ALTER TABLE league_players_partitioned 
    ADD CONSTRAINT fk_league_players_partitioned_league_id 
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE league_players_partitioned 
    ADD CONSTRAINT fk_league_players_partitioned_team_id 
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- Step 5: Migrate existing data (if any exists)
-- This will copy data from the old table to the new partitioned table
INSERT INTO league_players_partitioned (
    id, league_id, player_id, player_name, full_name, image, description, 
    positions, rating, team_id, created_at, updated_at
)
SELECT 
    id, league_id, player_id, player_name, full_name, image, description,
    positions, rating, team_id, created_at, updated_at
FROM league_players;

-- Step 6: Drop the old table and rename the new one
DROP TABLE league_players;
ALTER TABLE league_players_partitioned RENAME TO league_players;

-- Step 7: Update the generate_league_players function to work with partitioned table
-- and respect the business rule: player pool = all players, starter squad = max 60 rating

CREATE OR REPLACE FUNCTION generate_league_players(p_league_id UUID, p_player_count INTEGER DEFAULT 1000)
RETURNS JSON AS $$
DECLARE
  v_actual_count INTEGER;
  v_available_players INTEGER;
BEGIN
  -- Clear existing players for this league
  DELETE FROM league_players WHERE league_id = p_league_id;
  
  -- Get total count of available players in the player table (ALL players, any rating)
  SELECT COUNT(*) INTO v_available_players FROM player;
  
  -- Copy ALL real players from player table to league_players table with essential data
  -- This creates the player pool with ALL players (any rating)
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
    'message', 'League player pool generated successfully from real player database (ALL players, any rating)',
    'player_count', v_actual_count,
    'available_players', v_available_players,
    'requested_count', p_player_count,
    'note', 'Player pool contains ALL players. Starter squad will filter to max rating 60.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Update the generate_starter_squad function to filter by rating <= 60
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
    AND rating <= 60  -- BUSINESS RULE: Starter squad max rating 60
    ORDER BY random();
  result JSON;
BEGIN
  -- Get available players for this league and assign them based on position requirements
  -- ONLY players with rating <= 60 for starter squad
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
      -- Fill remaining slots with any available players (still <= 60 rating)
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
    'message', 'Starter squad generated successfully (max rating 60)',
    'player_count', v_assigned_count,
    'distribution', json_build_object(
      'goalkeepers', v_gk_count,
      'defenders', v_def_count,
      'midfielders', v_mid_count,
      'attackers', v_att_count
    ),
    'rating_limit', 'Starter squad limited to rating <= 60 per business rules'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Add RLS policies for the partitioned table
ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see players from their leagues
CREATE POLICY "Users can view players from their leagues" ON league_players
    FOR SELECT USING (
        league_id IN (
            SELECT l.id FROM leagues l
            JOIN teams t ON t.league_id = l.id
            WHERE t.user_id = auth.uid()
        )
    );

-- Policy to allow league hosts to manage players
CREATE POLICY "League hosts can manage players" ON league_players
    FOR ALL USING (
        league_id IN (
            SELECT l.id FROM leagues l
            WHERE l.commissioner_user_id = auth.uid()
        )
    ); 