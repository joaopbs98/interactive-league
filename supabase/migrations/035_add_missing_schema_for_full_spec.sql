-- 035: Add all missing schema required by the IL25 full spec (final_doc.md)
-- Covers: league status machine, standings, audit logs, free agent bids,
-- contract improvements, match improvements, player stats, trades.league_id

------------------------------------------------------------
-- 1. League status enum + columns
------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE league_status AS ENUM (
    'PRESEASON_SETUP',
    'IN_SEASON',
    'OFFSEASON',
    'SEASON_END_PROCESSING',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS status league_status DEFAULT 'PRESEASON_SETUP';
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 0;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS total_rounds INTEGER DEFAULT 0;

-- Generate invite codes for existing leagues that don't have one
UPDATE leagues SET invite_code = substr(md5(random()::text), 1, 8)
WHERE invite_code IS NULL;

-- Index for invite code lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues(invite_code);

------------------------------------------------------------
-- 2. Standings table
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_diff INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, season, team_id)
);

CREATE INDEX IF NOT EXISTS idx_standings_league_season ON standings(league_id, season);
CREATE INDEX IF NOT EXISTS idx_standings_points ON standings(points DESC);

ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view standings in their leagues" ON standings
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);

------------------------------------------------------------
-- 3. Audit logs table
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_league ON audit_logs(league_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs in their leagues" ON audit_logs
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);

------------------------------------------------------------
-- 4. Free agent bids table
------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE bid_status AS ENUM ('pending', 'won', 'lost', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS free_agent_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  bonus INTEGER NOT NULL DEFAULT 0,
  salary INTEGER NOT NULL,
  years INTEGER NOT NULL DEFAULT 3,
  season INTEGER NOT NULL,
  status bid_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fa_bids_league ON free_agent_bids(league_id, season);
CREATE INDEX IF NOT EXISTS idx_fa_bids_player ON free_agent_bids(player_id);

ALTER TABLE free_agent_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bids in their leagues" ON free_agent_bids
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);

CREATE POLICY "Users can create bids for their teams" ON free_agent_bids
FOR INSERT WITH CHECK (
  team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
);

------------------------------------------------------------
-- 5. Contract improvements
------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM ('active', 'expired', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS status contract_status DEFAULT 'active';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS guaranteed BOOLEAN DEFAULT false;

------------------------------------------------------------
-- 6. Matches table improvements
------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('scheduled', 'simulated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS round INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_status match_status DEFAULT 'scheduled';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS played_at TIMESTAMPTZ;

-- Copy match_day to round if round is null
UPDATE matches SET round = match_day WHERE round IS NULL AND match_day IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_league_season_round ON matches(league_id, season, round);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(match_status);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view matches in their leagues" ON matches;
CREATE POLICY "Users can view matches in their leagues" ON matches
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);

------------------------------------------------------------
-- 7. Pack purchases audit improvement
------------------------------------------------------------
ALTER TABLE pack_purchases ADD COLUMN IF NOT EXISTS rng_seed TEXT;

------------------------------------------------------------
-- 8. Player stats columns
------------------------------------------------------------
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS goals INTEGER DEFAULT 0;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS assists INTEGER DEFAULT 0;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS injury_games_remaining INTEGER DEFAULT 0;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS suspension_games_remaining INTEGER DEFAULT 0;

------------------------------------------------------------
-- 9. Trades: add league_id + season
------------------------------------------------------------
ALTER TABLE trades ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS season INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS proposed_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE trades ADD COLUMN IF NOT EXISTS accepted_date TIMESTAMPTZ;

------------------------------------------------------------
-- 10. Finance ledger improvements
------------------------------------------------------------
ALTER TABLE finances ADD COLUMN IF NOT EXISTS ref_type TEXT;
ALTER TABLE finances ADD COLUMN IF NOT EXISTS ref_id UUID;
ALTER TABLE finances ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE finances ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view finances for their teams" ON finances;
CREATE POLICY "Users can view finances for their teams" ON finances
FOR SELECT USING (
  team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
);

------------------------------------------------------------
-- 11. Draft system improvements
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS draft_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_pick_id UUID NOT NULL REFERENCES draft_picks(id) ON DELETE CASCADE,
  player_id TEXT,
  item_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS original_team_id UUID REFERENCES teams(id);
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS current_owner_team_id UUID REFERENCES teams(id);
ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT false;

------------------------------------------------------------
-- 12. Helper: write_audit_log function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION write_audit_log(
  p_league_id UUID,
  p_action TEXT,
  p_actor_id UUID,
  p_payload JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (league_id, action, actor_id, payload)
  VALUES (p_league_id, p_action, p_actor_id, p_payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------
-- 13. Helper: write_finance_entry function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION write_finance_entry(
  p_team_id UUID,
  p_league_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_description TEXT,
  p_season INTEGER,
  p_ref_type TEXT DEFAULT NULL,
  p_ref_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO finances (team_id, league_id, amount, reason, description, season, date, ref_type, ref_id)
  VALUES (p_team_id, p_league_id, p_amount, p_reason, p_description, p_season, NOW()::TEXT, p_ref_type, p_ref_id)
  RETURNING id INTO v_id;

  UPDATE teams SET budget = COALESCE(budget, 0) + p_amount WHERE id = p_team_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------
-- 14. Helper: check_league_phase function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_league_phase(
  p_league_id UUID,
  p_required_status league_status
) RETURNS BOOLEAN AS $$
DECLARE
  v_status league_status;
BEGIN
  SELECT status INTO v_status FROM leagues WHERE id = p_league_id;
  RETURN v_status = p_required_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

------------------------------------------------------------
-- 15. Helper: get_team_roster_count function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_team_roster_count(p_team_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM league_players WHERE team_id = p_team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
