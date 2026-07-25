ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS mock_identity_key TEXT,
  ADD COLUMN IF NOT EXISTS mock_personality TEXT,
  ADD COLUMN IF NOT EXISTS mock_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS mock_secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS mock_badge_key TEXT,
  ADD COLUMN IF NOT EXISTS mock_activity_cycle INTEGER NOT NULL DEFAULT 0;

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_mock_personality_check;
ALTER TABLE teams
  ADD CONSTRAINT teams_mock_personality_check CHECK (
    mock_personality IS NULL OR mock_personality IN (
      'builder',
      'seller',
      'prospect_hunter',
      'star_chaser',
      'conservative',
      'aggressive'
    )
  ),
  ADD CONSTRAINT teams_mock_activity_cycle_check CHECK (mock_activity_cycle >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS teams_league_mock_identity_unique
  ON teams (league_id, mock_identity_key)
  WHERE mock_identity_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS mock_club_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  activity_cycle INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT,
  action TEXT NOT NULL,
  seed TEXT NOT NULL,
  score NUMERIC,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  proposal JSONB NOT NULL DEFAULT '{}'::JSONB,
  outcome TEXT NOT NULL DEFAULT 'proposed',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mock_club_decisions_league_created_idx
  ON mock_club_decisions (league_id, created_at DESC);

ALTER TABLE mock_club_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "League hosts can view mock decisions" ON mock_club_decisions;
CREATE POLICY "League hosts can view mock decisions"
  ON mock_club_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM leagues l
      WHERE l.id = mock_club_decisions.league_id
        AND (
          l.commissioner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM league_host_teams lht
            JOIN teams host_team ON host_team.id = lht.team_id
            WHERE lht.league_id = l.id
              AND host_team.user_id = auth.uid()
          )
        )
    )
  );
