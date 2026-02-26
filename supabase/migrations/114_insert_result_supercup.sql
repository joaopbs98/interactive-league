-- 114: insert_match_result - skip standings updates for supercup (no competition_standings, no domestic)

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

  -- International group stage: update competition_standings (not for supercup)
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
  ELSIF v_comp_type != 'supercup' THEN
    -- Domestic: update standings (skip for supercup)
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

  -- Advance round: domestic or competition-specific (not for supercup)
  v_remaining := 1;
  IF v_comp_type = 'domestic' OR v_comp_type IS NULL THEN
    SELECT COUNT(*) INTO v_remaining
    FROM matches
    WHERE league_id = v_league_id AND season = v_season AND round = v_round AND match_status = 'scheduled'
      AND (competition_type IS NULL OR competition_type = 'domestic');
    IF v_remaining = 0 THEN
      UPDATE leagues SET current_round = current_round + 1 WHERE id = v_league_id;
    END IF;
  ELSIF v_comp_type IN ('ucl', 'uel', 'uecl') THEN
    SELECT COUNT(*) INTO v_remaining
    FROM matches
    WHERE league_id = v_league_id AND season = v_season AND round = v_round AND match_status = 'scheduled'
      AND competition_type = v_comp_type;
    IF v_remaining = 0 THEN
      UPDATE leagues SET
        current_round_ucl = CASE WHEN v_comp_type = 'ucl' THEN GREATEST(COALESCE(current_round_ucl, 0), v_round) + 1 ELSE COALESCE(current_round_ucl, 0) END,
        current_round_uel = CASE WHEN v_comp_type = 'uel' THEN GREATEST(COALESCE(current_round_uel, 0), v_round) + 1 ELSE COALESCE(current_round_uel, 0) END,
        current_round_uecl = CASE WHEN v_comp_type = 'uecl' THEN GREATEST(COALESCE(current_round_uecl, 0), v_round) + 1 ELSE COALESCE(current_round_uecl, 0) END
      WHERE id = v_league_id;
    END IF;
  END IF;

  PERFORM write_audit_log(v_league_id, 'insert_match_result', p_actor_user_id,
    json_build_object('match_id', p_match_id, 'home_score', p_home_score, 'away_score', p_away_score, 'competition_type', v_comp_type)::jsonb);

  RETURN json_build_object('success', true, 'home_score', p_home_score, 'away_score', p_away_score, 'round_advanced', v_remaining = 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
