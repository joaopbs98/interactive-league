-- Adaptive tracking and Sofascore-style analytical match records.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS simulation_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS simulation_calibration_version TEXT,
  ADD COLUMN IF NOT EXISTS analytics_source TEXT
    CHECK (analytics_source IS NULL OR analytics_source IN ('simulated', 'manual_constrained', 'legacy'));

ALTER TABLE team_match_stats
  ADD COLUMN IF NOT EXISTS field_tilt NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xgot NUMERIC(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS big_chances INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS big_chances_missed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progressive_passes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS key_passes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crosses INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_crosses INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progressive_carries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dribbles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_dribbles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pressures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tackles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interceptions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recoveries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clearances INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duels INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duels_won INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aerial_duels INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aerial_duels_won INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yellow_cards INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_cards INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_prevented NUMERIC(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spatial_summary JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE player_match_stats
  ADD COLUMN IF NOT EXISTS slot_position TEXT,
  ADD COLUMN IF NOT EXISTS xg NUMERIC(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xgot NUMERIC(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xa NUMERIC(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS big_chances INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS big_chances_missed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progressive_passes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crosses INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_crosses INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touches INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progressive_carries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dribbles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_dribbles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispossessed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pressures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recoveries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clearances INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duels INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duels_won INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aerial_duels INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aerial_duels_won INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errors_leading_to_shot INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errors_leading_to_goal INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_prevented NUMERIC(7,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_speed_distance_km NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sprint_distance_km NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_speed_kmh NUMERIC(5,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sprint_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_position JSONB,
  ADD COLUMN IF NOT EXISTS heatmap JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS shot_map JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS pass_map JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS rating_components JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT 'fc25-il-1',
  ADD COLUMN IF NOT EXISTS analytics_source TEXT NOT NULL DEFAULT 'legacy';

CREATE TABLE IF NOT EXISTS match_tracking_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  engine_version TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  starts_at_second INTEGER NOT NULL,
  ends_at_second INTEGER NOT NULL,
  frame_count INTEGER NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, engine_version, chunk_index)
);

CREATE TABLE IF NOT EXISTS player_season_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  competition_type TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  appearances INTEGER NOT NULL DEFAULT 0,
  qualifying_appearances INTEGER NOT NULL DEFAULT 0,
  starts INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  rating_minutes NUMERIC(12,3) NOT NULL DEFAULT 0,
  average_rating NUMERIC(4,2) NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  xg NUMERIC(9,3) NOT NULL DEFAULT 0,
  xa NUMERIC(9,3) NOT NULL DEFAULT 0,
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards INTEGER NOT NULL DEFAULT 0,
  advanced_totals JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, season, competition_type, team_id, player_id, engine_version)
);

CREATE TABLE IF NOT EXISTS youngster_growth_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  -- league_players is partitioned by league_id; keep the scoped row id without
  -- a single-column FK because id is not globally unique on the parent table.
  league_player_id UUID NOT NULL,
  engine_version TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  suggested_delta INTEGER NOT NULL,
  final_delta INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'adjusted', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, season, league_player_id, engine_version)
);

CREATE INDEX IF NOT EXISTS match_tracking_chunks_match_idx ON match_tracking_chunks(match_id, chunk_index);
CREATE INDEX IF NOT EXISTS player_season_analytics_leader_idx
  ON player_season_analytics(league_id, season, competition_type, average_rating DESC);
CREATE INDEX IF NOT EXISTS youngster_growth_reviews_queue_idx
  ON youngster_growth_reviews(league_id, season, status);

ALTER TABLE match_tracking_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE youngster_growth_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "League members view match tracking" ON match_tracking_chunks;
CREATE POLICY "League members view match tracking" ON match_tracking_chunks FOR SELECT
  USING (league_id IN (SELECT public.get_user_league_ids(auth.uid())));

DROP POLICY IF EXISTS "League members view player season analytics" ON player_season_analytics;
CREATE POLICY "League members view player season analytics" ON player_season_analytics FOR SELECT
  USING (league_id IN (SELECT public.get_user_league_ids(auth.uid())));

DROP POLICY IF EXISTS "League members view youngster growth reviews" ON youngster_growth_reviews;
CREATE POLICY "League members view youngster growth reviews" ON youngster_growth_reviews FOR SELECT
  USING (league_id IN (SELECT public.get_user_league_ids(auth.uid())));
