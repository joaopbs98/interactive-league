-- 074: Youngsters system (IL25 spec - tied to upgrade sheet)
-- Youngsters: no wage bonuses; upgrades from games played + adj avg (sheet)
-- Individual training 3 focuses; checkpoints at 8, 12, max potential

ALTER TABLE league_players ADD COLUMN IF NOT EXISTS is_youngster BOOLEAN DEFAULT false;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS base_rating INTEGER;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS youngster_games_played INTEGER DEFAULT 0;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS youngster_adj_avg NUMERIC;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS ind_training_3 BOOLEAN DEFAULT false;

COMMENT ON COLUMN league_players.is_youngster IS 'Youngster: no wage bonuses; upgraded via sheet';
COMMENT ON COLUMN league_players.base_rating IS 'Rating at season start for youngster upgrade calc';
COMMENT ON COLUMN league_players.youngster_games_played IS 'Games played this season (for upgrade)';
COMMENT ON COLUMN league_players.youngster_adj_avg IS 'Adjusted average match rating (from sheet)';
COMMENT ON COLUMN league_players.ind_training_3 IS 'Individual training with 3 focuses (2.0 vs 1.6 per OVR)';

-- Checkpoints granted (playstyle, Role+, IR, etc.)
CREATE TABLE IF NOT EXISTS youngster_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('8', '12', 'max')),
  season INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, player_id, checkpoint_type)
);

CREATE INDEX IF NOT EXISTS idx_youngster_checkpoints_player ON youngster_checkpoints(league_id, player_id);

-- RPC: Apply youngster rating delta (API computes upgrade from sheet; this applies it)
CREATE OR REPLACE FUNCTION apply_youngster_rating_delta(
  p_league_id UUID,
  p_player_id TEXT,
  p_delta INTEGER,
  p_games_played INTEGER,
  p_adj_avg NUMERIC,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_lp RECORD;
  v_new_rating INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = p_league_id AND commissioner_user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Host only');
  END IF;

  SELECT lp.id, lp.team_id, lp.rating
  INTO v_lp
  FROM league_players lp
  WHERE lp.league_id = p_league_id AND lp.player_id = p_player_id AND lp.team_id IS NOT NULL;

  IF v_lp IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Player not found on a team');
  END IF;

  v_new_rating := LEAST(99, GREATEST(40, COALESCE(v_lp.rating, 60) + COALESCE(p_delta, 0)));

  UPDATE league_players SET
    rating = v_new_rating,
    youngster_games_played = COALESCE(p_games_played, youngster_games_played),
    youngster_adj_avg = COALESCE(p_adj_avg, youngster_adj_avg)
  WHERE id = v_lp.id;

  RETURN json_build_object('success', true, 'delta', p_delta, 'new_rating', v_new_rating);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
