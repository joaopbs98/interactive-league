-- 048: Transfer list marketplace - list players for sale with asking price

CREATE TABLE IF NOT EXISTS transfer_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES player(player_id),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  asking_price INTEGER NOT NULL,
  listed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_listings_league ON transfer_listings(league_id);
CREATE INDEX IF NOT EXISTS idx_transfer_listings_team ON transfer_listings(team_id);

ALTER TABLE transfer_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfer listings in their leagues" ON transfer_listings
  FOR SELECT USING (
    league_id IN (SELECT league_id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Team owners can insert their own listings" ON transfer_listings
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Team owners can delete their own listings" ON transfer_listings
  FOR DELETE USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );
