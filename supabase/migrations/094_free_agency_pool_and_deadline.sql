-- 094: Free agency pool (host-selected), bid deadline, sniping protection
-- Season pool: host selects players from global player table into pool for that season
-- Bid deadline: league-level fa_deadline
-- Sniping: extended in API when bid placed in last minute

-- Free agent pool: host-selected players eligible for FA bidding this season
CREATE TABLE IF NOT EXISTS free_agent_pool (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  player_id TEXT NOT NULL REFERENCES player(player_id) ON DELETE CASCADE,
  added_by_host UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, season, player_id)
);

CREATE INDEX IF NOT EXISTS idx_fa_pool_league_season ON free_agent_pool(league_id, season);

ALTER TABLE free_agent_pool ENABLE ROW LEVEL SECURITY;

-- Host can manage pool for their leagues
CREATE POLICY "Host can manage FA pool" ON free_agent_pool
FOR ALL USING (
  league_id IN (SELECT id FROM leagues WHERE commissioner_user_id = auth.uid())
);

-- Users can view pool for their leagues
CREATE POLICY "Users can view FA pool in their leagues" ON free_agent_pool
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);

-- Add FA deadline to leagues (optional; when set, bids expire at this time)
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS fa_deadline TIMESTAMPTZ;

COMMENT ON COLUMN leagues.fa_deadline IS 'Free agency bid deadline. Bids placed after this time are rejected. Sniping: if bid in last minute, deadline extends by 1 min.';
