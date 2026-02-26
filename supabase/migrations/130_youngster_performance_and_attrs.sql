-- 130: Youngster performance table + league_players extensions for upgrade page
-- youngster_performance: host-entered games/avg per competition
-- league_players: is_veteran, youngster_ind_training_attrs, youngster_non_weighted_attrs

-- New table: youngster_performance
CREATE TABLE IF NOT EXISTS youngster_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  league_player_id UUID NOT NULL,
  CONSTRAINT fk_youngster_performance_league_player
    FOREIGN KEY (league_id, league_player_id) REFERENCES league_players(league_id, id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  domestic_games INTEGER,
  domestic_avg NUMERIC,
  usc_games INTEGER,
  usc_avg NUMERIC,
  ucl_gs_games INTEGER,
  ucl_gs_avg NUMERIC,
  ucl_ko_games INTEGER,
  ucl_ko_avg NUMERIC,
  uel_gs_games INTEGER,
  uel_gs_avg NUMERIC,
  uel_ko_games INTEGER,
  uel_ko_avg NUMERIC,
  uecl_gs_games INTEGER,
  uecl_gs_avg NUMERIC,
  uecl_ko_games INTEGER,
  uecl_ko_avg NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, league_player_id, season)
);

CREATE INDEX IF NOT EXISTS idx_youngster_performance_league_season ON youngster_performance(league_id, season);
CREATE INDEX IF NOT EXISTS idx_youngster_performance_league_player ON youngster_performance(league_player_id);

-- Extend league_players
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS is_veteran BOOLEAN DEFAULT false;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS youngster_ind_training_attrs JSONB;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS youngster_non_weighted_attrs JSONB;

COMMENT ON COLUMN league_players.is_veteran IS 'Veteran: downgrade-only logic (Phase 9)';
COMMENT ON COLUMN league_players.youngster_ind_training_attrs IS 'Array of 3 attribute keys for ind. training (2.0 vs 1.6 per OVR)';
COMMENT ON COLUMN league_players.youngster_non_weighted_attrs IS 'Array of 6 non-weighted attribute keys for upgrade';
