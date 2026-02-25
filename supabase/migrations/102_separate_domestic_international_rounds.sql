-- 102: Separate round counters for domestic vs international competitions
-- Domestic uses current_round; UCL/UEL/UECL each have their own counter

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS current_round_ucl INTEGER DEFAULT 0;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS current_round_uel INTEGER DEFAULT 0;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS current_round_uecl INTEGER DEFAULT 0;

COMMENT ON COLUMN leagues.current_round_ucl IS 'Current matchday for UCL (group stage etc.)';
COMMENT ON COLUMN leagues.current_round_uel IS 'Current matchday for UEL';
COMMENT ON COLUMN leagues.current_round_uecl IS 'Current matchday for UECL';

-- Modify simulate_matchday: only process domestic matches
CREATE OR REPLACE FUNCTION simulate_matchday(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_current_round INTEGER;
  v_season INTEGER;
  v_total_rounds INTEGER;
  v_match RECORD;
  v_home_ovr NUMERIC;
  v_away_ovr NUMERIC;
  v_result JSON;
  v_results JSON[] := '{}';
  v_match_count INTEGER := 0;
  v_home_goals INTEGER;
  v_away_goals INTEGER;
BEGIN
  SELECT current_round, season, total_rounds INTO v_current_round, v_season, v_total_rounds
  FROM leagues WHERE id = p_league_id;

  IF v_current_round IS NULL OR v_current_round = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No schedule generated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND season = v_season
      AND round = v_current_round AND match_status = 'scheduled'
      AND COALESCE(competition_type, 'domestic') = 'domestic'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'No scheduled domestic matches for round ' || v_current_round);
  END IF;

  FOR v_match IN
    SELECT m.id, m.home_team_id, m.away_team_id
    FROM matches m
    WHERE m.league_id = p_league_id AND m.season = v_season
      AND m.round = v_current_round AND m.match_status = 'scheduled'
      AND COALESCE(m.competition_type, 'domestic') = 'domestic'
  LOOP
    v_home_ovr := get_team_ovr_for_match(v_match.home_team_id, p_league_id);
    v_away_ovr := get_team_ovr_for_match(v_match.away_team_id, p_league_id);

    v_result := simulate_single_match(v_match.id, v_home_ovr, v_away_ovr);
    v_results := v_results || v_result;
    v_match_count := v_match_count + 1;

    v_home_goals := (v_result->>'home_goals')::int;
    v_away_goals := (v_result->>'away_goals')::int;

    IF v_home_goals > v_away_goals THEN
      UPDATE standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + v_home_goals, goals_against = goals_against + v_away_goals,
        goal_diff = goal_diff + v_home_goals - v_away_goals, updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.home_team_id;

      UPDATE standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + v_away_goals, goals_against = goals_against + v_home_goals,
        goal_diff = goal_diff + v_away_goals - v_home_goals, updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.away_team_id;
    ELSIF v_home_goals < v_away_goals THEN
      UPDATE standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + v_home_goals, goals_against = goals_against + v_away_goals,
        goal_diff = goal_diff + v_home_goals - v_away_goals, updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.home_team_id;

      UPDATE standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + v_away_goals, goals_against = goals_against + v_home_goals,
        goal_diff = goal_diff + v_away_goals - v_home_goals, updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.away_team_id;
    ELSE
      UPDATE standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + v_home_goals, goals_against = goals_against + v_away_goals, updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.home_team_id;

      UPDATE standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + v_away_goals, goals_against = goals_against + v_home_goals, updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.away_team_id;
    END IF;
  END LOOP;

  UPDATE league_players SET injury_games_remaining = GREATEST(0, injury_games_remaining - 1)
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND injury_games_remaining > 0;
  UPDATE league_players SET suspension_games_remaining = GREATEST(0, suspension_games_remaining - 1)
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND suspension_games_remaining > 0;

  UPDATE leagues SET current_round = current_round + 1 WHERE id = p_league_id;
  PERFORM write_audit_log(p_league_id, 'simulate_matchday', NULL,
    json_build_object('round', v_current_round, 'matches_simulated', v_match_count)::jsonb);

  RETURN json_build_object(
    'success', true,
    'round', v_current_round,
    'matches_simulated', v_match_count,
    'results', array_to_json(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New: simulate_matchday_competition for UCL/UEL/UECL
CREATE OR REPLACE FUNCTION simulate_matchday_competition(p_league_id UUID, p_competition_type TEXT)
RETURNS JSON AS $$
DECLARE
  v_round INTEGER;
  v_season INTEGER;
  v_match RECORD;
  v_home_ovr NUMERIC;
  v_away_ovr NUMERIC;
  v_result JSON;
  v_results JSON[] := '{}';
  v_match_count INTEGER := 0;
  v_comp_type TEXT;
  v_group_name TEXT;
  v_home_goals INTEGER;
  v_away_goals INTEGER;
BEGIN
  IF p_competition_type NOT IN ('ucl', 'uel', 'uecl') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid competition type. Use ucl, uel, or uecl.');
  END IF;

  SELECT season INTO v_season FROM leagues WHERE id = p_league_id;
  IF v_season IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'League not found');
  END IF;

  v_round := CASE p_competition_type
    WHEN 'ucl' THEN (SELECT COALESCE(current_round_ucl, 0) FROM leagues WHERE id = p_league_id)
    WHEN 'uel' THEN (SELECT COALESCE(current_round_uel, 0) FROM leagues WHERE id = p_league_id)
    WHEN 'uecl' THEN (SELECT COALESCE(current_round_uecl, 0) FROM leagues WHERE id = p_league_id)
    ELSE 0
  END;

  IF v_round = 0 THEN
    v_round := 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND season = v_season
      AND competition_type = p_competition_type
      AND round = v_round AND match_status = 'scheduled'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'No scheduled ' || UPPER(p_competition_type) || ' matches for matchday ' || v_round);
  END IF;

  FOR v_match IN
    SELECT m.id, m.home_team_id, m.away_team_id, m.group_name
    FROM matches m
    WHERE m.league_id = p_league_id AND m.season = v_season
      AND m.competition_type = p_competition_type
      AND m.round = v_round AND m.match_status = 'scheduled'
  LOOP
    v_comp_type := p_competition_type;
    v_group_name := v_match.group_name;

    v_home_ovr := get_team_ovr_for_match(v_match.home_team_id, p_league_id);
    v_away_ovr := get_team_ovr_for_match(v_match.away_team_id, p_league_id);

    v_result := simulate_single_match(v_match.id, v_home_ovr, v_away_ovr);
    v_results := v_results || v_result;
    v_match_count := v_match_count + 1;

    v_home_goals := (v_result->>'home_goals')::int;
    v_away_goals := (v_result->>'away_goals')::int;

    IF v_group_name IS NOT NULL AND v_group_name != '' THEN
      INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
      VALUES (p_league_id, v_season, v_comp_type, v_group_name, v_match.home_team_id, 0, 0, 0, 0, 0, 0, 0, 0),
             (p_league_id, v_season, v_comp_type, v_group_name, v_match.away_team_id, 0, 0, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;

      IF v_home_goals > v_away_goals THEN
        UPDATE competition_standings SET played = played + 1, wins = wins + 1, points = points + 3,
          goals_for = goals_for + v_home_goals, goals_against = goals_against + v_away_goals,
          goal_diff = goal_diff + v_home_goals - v_away_goals, updated_at = NOW()
        WHERE league_id = p_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.home_team_id;

        UPDATE competition_standings SET played = played + 1, losses = losses + 1,
          goals_for = goals_for + v_away_goals, goals_against = goals_against + v_home_goals,
          goal_diff = goal_diff + v_away_goals - v_home_goals, updated_at = NOW()
        WHERE league_id = p_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.away_team_id;
      ELSIF v_home_goals < v_away_goals THEN
        UPDATE competition_standings SET played = played + 1, losses = losses + 1,
          goals_for = goals_for + v_home_goals, goals_against = goals_against + v_away_goals,
          goal_diff = goal_diff + v_home_goals - v_away_goals, updated_at = NOW()
        WHERE league_id = p_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.home_team_id;

        UPDATE competition_standings SET played = played + 1, wins = wins + 1, points = points + 3,
          goals_for = goals_for + v_away_goals, goals_against = goals_against + v_home_goals,
          goal_diff = goal_diff + v_away_goals - v_home_goals, updated_at = NOW()
        WHERE league_id = p_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.away_team_id;
      ELSE
        UPDATE competition_standings SET played = played + 1, draws = draws + 1, points = points + 1,
          goals_for = goals_for + v_home_goals, goals_against = goals_against + v_away_goals, updated_at = NOW()
        WHERE league_id = p_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.home_team_id;

        UPDATE competition_standings SET played = played + 1, draws = draws + 1, points = points + 1,
          goals_for = goals_for + v_away_goals, goals_against = goals_against + v_home_goals, updated_at = NOW()
        WHERE league_id = p_league_id AND season = v_season AND competition_type = v_comp_type AND group_name = v_group_name AND team_id = v_match.away_team_id;
      END IF;
    END IF;
  END LOOP;

  UPDATE league_players SET injury_games_remaining = GREATEST(0, injury_games_remaining - 1)
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND injury_games_remaining > 0;
  UPDATE league_players SET suspension_games_remaining = GREATEST(0, suspension_games_remaining - 1)
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND suspension_games_remaining > 0;

  UPDATE leagues SET
    current_round_ucl = CASE WHEN p_competition_type = 'ucl' THEN v_round + 1 ELSE COALESCE(current_round_ucl, 0) END,
    current_round_uel = CASE WHEN p_competition_type = 'uel' THEN v_round + 1 ELSE COALESCE(current_round_uel, 0) END,
    current_round_uecl = CASE WHEN p_competition_type = 'uecl' THEN v_round + 1 ELSE COALESCE(current_round_uecl, 0) END
  WHERE id = p_league_id;

  PERFORM write_audit_log(p_league_id, 'simulate_matchday_competition', NULL,
    json_build_object('competition_type', p_competition_type, 'round', v_round, 'matches_simulated', v_match_count)::jsonb);

  RETURN json_build_object(
    'success', true,
    'competition_type', p_competition_type,
    'round', v_round,
    'matches_simulated', v_match_count,
    'results', array_to_json(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
