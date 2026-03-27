-- Implement table partitioning for league_players by league_id
-- This provides better performance and data isolation for multiple leagues
-- BUSINESS RULES: Player pool = ALL players, Starter squad = max rating 60

-- Step 1: First, let's check if we need to migrate from an existing table
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    -- Check if the old league_players table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'league_players' 
        AND table_schema = 'public'
    ) INTO table_exists;
    
    -- If old table exists, we need to handle migration properly
    IF table_exists THEN
        -- Create a backup of the old table first
        CREATE TABLE IF NOT EXISTS league_players_backup AS 
        SELECT * FROM league_players;
        
        RAISE NOTICE 'Backup created: league_players_backup';
    END IF;
END $$;

-- Step 2: Drop ALL existing partitions and partitioned table (if they exist)
DROP TABLE IF EXISTS league_players_p0 CASCADE;
DROP TABLE IF EXISTS league_players_p1 CASCADE;
DROP TABLE IF EXISTS league_players_p2 CASCADE;
DROP TABLE IF EXISTS league_players_p3 CASCADE;
DROP TABLE IF EXISTS league_players_p4 CASCADE;
DROP TABLE IF EXISTS league_players_p5 CASCADE;
DROP TABLE IF EXISTS league_players_p6 CASCADE;
DROP TABLE IF EXISTS league_players_p7 CASCADE;
DROP TABLE IF EXISTS league_players_partitioned CASCADE;

-- Step 3: Create the new partitioned table properly
-- REMOVED CHECK CONSTRAINT: Player pool should allow ALL ratings
CREATE TABLE league_players_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    full_name TEXT,
    image TEXT,
    description TEXT,
    positions TEXT NOT NULL,
    overall_rating INTEGER NOT NULL,  -- CORRIGIDO: overall_rating em vez de rating
    team_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (league_id, id)  -- Include league_id in primary key for partitioning
) PARTITION BY HASH (league_id);

-- Step 4: Create ALL partitions (8 partitions for good distribution)
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

-- Step 5: Create indexes on the partitioned table (only if they don't exist)
DO $$
BEGIN
    -- Check and create league_id index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_league_players_partitioned_league_id') THEN
        CREATE INDEX idx_league_players_partitioned_league_id ON league_players_partitioned (league_id);
    END IF;
    
    -- Check and create team_id index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_league_players_partitioned_team_id') THEN
        CREATE INDEX idx_league_players_partitioned_team_id ON league_players_partitioned (team_id);
    END IF;
    
    -- Check and create overall_rating index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_league_players_partitioned_overall_rating') THEN
        CREATE INDEX idx_league_players_partitioned_overall_rating ON league_players_partitioned (overall_rating);
    END IF;
    
    -- Check and create player_id index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_league_players_partitioned_player_id') THEN
        CREATE INDEX idx_league_players_partitioned_player_id ON league_players_partitioned (player_id);
    END IF;
END $$;

-- Step 6: Add foreign key constraints (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_league_players_partitioned_league_id') THEN
        ALTER TABLE league_players_partitioned 
            ADD CONSTRAINT fk_league_players_partitioned_league_id 
            FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_league_players_partitioned_team_id') THEN
        ALTER TABLE league_players_partitioned 
            ADD CONSTRAINT fk_league_players_partitioned_team_id 
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 7: Migrate existing data from backup (if it exists)
DO $$
DECLARE
    backup_exists BOOLEAN;
    has_overall_rating BOOLEAN;
BEGIN
    -- Check if backup table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'league_players_backup' 
        AND table_schema = 'public'
    ) INTO backup_exists;
    
    -- If backup exists, check if it has overall_rating column
    IF backup_exists THEN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'league_players_backup' 
            AND column_name = 'overall_rating'
            AND table_schema = 'public'
        ) INTO has_overall_rating;
        
        -- Migrate data based on column structure
        IF has_overall_rating THEN
            -- Backup has overall_rating column
            INSERT INTO league_players_partitioned (
                id, league_id, player_id, player_name, full_name, image, description, 
                positions, overall_rating, team_id, created_at, updated_at
            )
            SELECT 
                id, league_id, player_id, player_name, full_name, image, description,
                positions, overall_rating, team_id, created_at, updated_at
            FROM league_players_backup;
        ELSE
            -- Backup has rating column (old structure)
            INSERT INTO league_players_partitioned (
                id, league_id, player_id, player_name, full_name, image, description, 
                positions, overall_rating, team_id, created_at, updated_at
            )
            SELECT 
                id, league_id, player_id, player_name, full_name, image, description,
                positions, rating, team_id, created_at, updated_at
            FROM league_players_backup;
        END IF;
        
        RAISE NOTICE 'Data migrated from backup table';
        
        -- Drop the backup table
        DROP TABLE league_players_backup;
    END IF;
END $$;

-- Step 8: Drop the old table if it exists and rename the new one
DROP TABLE IF EXISTS league_players;
ALTER TABLE league_players_partitioned RENAME TO league_players;

-- Step 9: Update the generate_league_players function
-- BUSINESS RULE: Player pool = ALL players (any rating)
DROP FUNCTION IF EXISTS generate_league_players(uuid, integer);

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
  INSERT INTO league_players (league_id, player_id, player_name, full_name, image, description, positions, overall_rating)
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

-- Step 10: Update the generate_starter_squad function
-- BUSINESS RULE: Starter squad = max rating 60
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
    SELECT id, player_name, positions, overall_rating FROM league_players 
    WHERE league_id = p_league_id 
    AND team_id IS NULL 
    AND overall_rating <= 60  -- BUSINESS RULE: Starter squad max rating 60
    ORDER BY random();
  result JSON;
BEGIN
  -- Get available players for this league and assign them based on position requirements
  -- ONLY players with overall_rating <= 60 for starter squad
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
    SELECT jsonb_agg(player_id) 
    FROM league_players 
    WHERE team_id = p_team_id
  ),
  starting_lineup = '[]'::jsonb,
  bench = '[]'::jsonb
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

-- Step 11: Add RLS policies for the partitioned table
ALTER TABLE league_players ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see players from their leagues
DROP POLICY IF EXISTS "Users can view players from their leagues" ON league_players;
CREATE POLICY "Users can view players from their leagues" ON league_players
    FOR SELECT USING (
        league_id IN (
            SELECT l.id FROM leagues l
            JOIN teams t ON t.league_id = l.id
            WHERE t.user_id = auth.uid()
        )
    );

-- Policy to allow league hosts to manage players
DROP POLICY IF EXISTS "League hosts can manage players" ON league_players;
CREATE POLICY "League hosts can manage players" ON league_players
    FOR ALL USING (
        league_id IN (
            SELECT l.id FROM leagues l
            WHERE l.commissioner_user_id = auth.uid()
        )
    ); 