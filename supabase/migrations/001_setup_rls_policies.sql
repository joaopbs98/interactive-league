-- Enable RLS on tables
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leagues table
-- Users can view leagues they are part of (through teams)
CREATE POLICY "Users can view leagues they participate in" ON leagues
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.league_id = leagues.id 
    AND teams.user_id = auth.uid()
  )
);

-- League commissioners can update their leagues
CREATE POLICY "Commissioners can update their leagues" ON leagues
FOR UPDATE USING (commissioner_user_id = auth.uid());

-- League commissioners can delete their leagues
CREATE POLICY "Commissioners can delete their leagues" ON leagues
FOR DELETE USING (commissioner_user_id = auth.uid());

-- RLS Policies for teams table
-- Users can view their own teams
CREATE POLICY "Users can view their own teams" ON teams
FOR SELECT USING (user_id = auth.uid());

-- Users can view teams in leagues they participate in
CREATE POLICY "Users can view teams in their leagues" ON teams
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM teams user_teams
    WHERE user_teams.league_id = teams.league_id 
    AND user_teams.user_id = auth.uid()
  )
);

-- Users can insert their own teams
CREATE POLICY "Users can insert their own teams" ON teams
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own teams
CREATE POLICY "Users can update their own teams" ON teams
FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own teams
CREATE POLICY "Users can delete their own teams" ON teams
FOR DELETE USING (user_id = auth.uid());

-- Additional policies for other tables that might exist
-- If you have other tables like trades, contracts, etc., add similar policies

-- Example for trades table (if it exists)
-- CREATE POLICY "Users can view trades involving their teams" ON trades
-- FOR SELECT USING (
--   EXISTS (
--     SELECT 1 FROM teams 
--     WHERE teams.id = trades.from_team_id OR teams.id = trades.to_team_id
--     AND teams.user_id = auth.uid()
--   )
-- );

-- Example for contracts table (if it exists)
-- CREATE POLICY "Users can view contracts for their teams" ON contracts
-- FOR SELECT USING (
--   EXISTS (
--     SELECT 1 FROM teams 
--     WHERE teams.id = contracts.team_id
--     AND teams.user_id = auth.uid()
--   )
-- ); 