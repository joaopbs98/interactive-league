-- 099: Competition standings for international group stages (UCL, UEL, UECL)
-- Stored for history; group stage only (knockout has no standings)

-- Add group_name to matches for group stage (A, B, etc.)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_name TEXT;
COMMENT ON COLUMN matches.group_name IS 'Group stage: A, B, etc. Null for knockout/domestic.';

-- Competition standings: same structure as standings, scoped by competition_type + group
CREATE TABLE IF NOT EXISTS competition_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  competition_type TEXT NOT NULL CHECK (competition_type IN ('ucl', 'uel', 'uecl')),
  group_name TEXT NOT NULL,
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
  UNIQUE(league_id, season, competition_type, group_name, team_id)
);

CREATE INDEX IF NOT EXISTS idx_comp_standings_league_season ON competition_standings(league_id, season);
CREATE INDEX IF NOT EXISTS idx_comp_standings_comp_group ON competition_standings(league_id, season, competition_type, group_name);

ALTER TABLE competition_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view competition standings in their leagues" ON competition_standings
FOR SELECT USING (
  league_id IN (SELECT get_user_league_ids(auth.uid()))
);

-- Ensure competition_type exists on matches (098)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS competition_type TEXT DEFAULT 'domestic';

-- Update insert_match_result: when competition_type is ucl/uel/uecl, update competition_standings
CREATE OR REPLACE FUNCTION insert_match_result(
  p_match_id UUID,
  p_home_score INTEGER,
  p_away_score INTEGER,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_match RECORD;
  v_league_id UUID;
  v_season INTEGER;
  v_round INTEGER;
  v_remaining INTEGER;
  v_comp_type TEXT;
  v_group_name TEXT;
BEGIN
  SELECT m.id, m.league_id, m.season, m.round, m.match_status, m.home_team_id, m.away_team_id,
         COALESCE(m.competition_type, 'domestic'), m.group_name
  INTO v_match
  FROM matches m
  WHERE m.id = p_match_id;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  v_league_id := v_match.league_id;
  v_season := v_match.season;
  v_round := v_match.round;
  v_comp_type := COALESCE(v_match.competition_type, 'domestic');
  v_group_name := v_match.group_name;

  IF v_match.match_status = 'simulated' THEN
    RETURN json_build_object('success', false, 'error', 'Match already has a result');
  END IF;

  IF p_home_score IS NULL OR p_away_score IS NULL OR p_home_score < 0 OR p_away_score < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid scores');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_league_id AND commissioner_user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Host only');
  END IF;

  UPDATE matches
  SET home_score = p_home_score, away_score = p_away_score, match_status = 'simulated', played_at = NOW()
  WHERE id = p_match_id;

  -- International group stage: update competition_standings
  IF v_comp_type IN ('ucl', 'uel', 'uecl') AND v_group_name IS NOT NULL AND v_group_name != '' THEN
    INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
    VALUES (v_league_id, v_season, v_comp_type, v_group_name, v_match.home_team_id, 0, 0, 0, 0, 0, 0, 0, 0),
           (v_league_id, v_season, v_comp_type, v_group_name, v_match.away_team_id, 0, 0, 0, 0, 0, 0, 0, 0)
    ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;

    IF p_home_score > p_away_score THEN
      UPDATE competition_standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + p_home_score, goals_against = goals_against + p_away_score,
        goal_diff = goal_diff + p_home_score - p_away_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.home_team_id;

      UPDATE competition_standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + p_away_score, goals_against = goals_against + p_home_score,
        goal_diff = goal_diff + p_away_score - p_home_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.away_team_id;
    ELSIF p_home_score < p_away_score THEN
      UPDATE competition_standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + p_home_score, goals_against = goals_against + p_away_score,
        goal_diff = goal_diff + p_home_score - p_away_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.home_team_id;

      UPDATE competition_standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + p_away_score, goals_against = goals_against + p_home_score,
        goal_diff = goal_diff + p_away_score - p_home_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.away_team_id;
    ELSE
      UPDATE competition_standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + p_home_score, goals_against = goals_against + p_away_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.home_team_id;

      UPDATE competition_standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + p_away_score, goals_against = goals_against + p_home_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.away_team_id;
    END IF;
  ELSE
    -- Domestic: update standings
    IF p_home_score > p_away_score THEN
      UPDATE standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + p_home_score, goals_against = goals_against + p_away_score,
        goal_diff = goal_diff + p_home_score - p_away_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND team_id = v_match.home_team_id;

      UPDATE standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + p_away_score, goals_against = goals_against + p_home_score,
        goal_diff = goal_diff + p_away_score - p_home_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND team_id = v_match.away_team_id;
    ELSIF p_home_score < p_away_score THEN
      UPDATE standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + p_home_score, goals_against = goals_against + p_away_score,
        goal_diff = goal_diff + p_home_score - p_away_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND team_id = v_match.home_team_id;

      UPDATE standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + p_away_score, goals_against = goals_against + p_home_score,
        goal_diff = goal_diff + p_away_score - p_home_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND team_id = v_match.away_team_id;
    ELSE
      UPDATE standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + p_home_score, goals_against = goals_against + p_away_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND team_id = v_match.home_team_id;

      UPDATE standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + p_away_score, goals_against = goals_against + p_home_score, updated_at = NOW()
      WHERE league_id = v_league_id AND season = v_season AND team_id = v_match.away_team_id;
    END IF;
  END IF;

  -- Advance round only for domestic (international has different round logic)
  IF v_comp_type = 'domestic' THEN
    SELECT COUNT(*) INTO v_remaining
    FROM matches
    WHERE league_id = v_league_id AND season = v_season AND round = v_round AND match_status = 'scheduled'
      AND (competition_type IS NULL OR competition_type = 'domestic');
  ELSE
    v_remaining := 1;
  END IF;

  IF v_remaining = 0 THEN
    UPDATE leagues SET current_round = current_round + 1 WHERE id = v_league_id;
  END IF;

  PERFORM write_audit_log(v_league_id, 'insert_match_result', p_actor_user_id,
    json_build_object('match_id', p_match_id, 'home_score', p_home_score, 'away_score', p_away_score, 'competition_type', v_comp_type)::jsonb);

  RETURN json_build_object('success', true, 'home_score', p_home_score, 'away_score', p_away_score, 'round_advanced', v_remaining = 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
