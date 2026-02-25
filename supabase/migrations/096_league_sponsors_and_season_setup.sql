-- 096: League sponsors (host picks 3 per season) for season setup
-- Teams choose from these 3 when picking sponsor in OFFSEASON

CREATE TABLE IF NOT EXISTS league_sponsors (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, season, sponsor_id)
);

CREATE INDEX IF NOT EXISTS idx_league_sponsors_league_season ON league_sponsors(league_id, season);

ALTER TABLE league_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can manage league sponsors" ON league_sponsors
FOR ALL USING (
  league_id IN (SELECT id FROM leagues WHERE commissioner_user_id = auth.uid())
);

CREATE POLICY "Users can view league sponsors in their leagues" ON league_sponsors
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);
