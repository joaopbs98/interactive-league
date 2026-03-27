-- 119: Auto-create knockout matches when last group round is simulated; only allow simulate when matches exist

-- Create knockout matches from competition_standings (top 4 advance: 1st vs 4th, 2nd vs 3rd; top 2 for 2-team groups)
CREATE OR REPLACE FUNCTION create_knockout_matches(p_league_id UUID, p_season INTEGER, p_competition_type TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_max_group_round INT;
  v_teams UUID[];
  v_n INT;
  v_semi_round INT;
  v_final_round INT;
  v_count INT := 0;
BEGIN
  IF p_competition_type NOT IN ('ucl', 'uel', 'uecl') THEN
    RETURN 0;
  END IF;

  -- Already have knockout matches?
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND season = p_season AND competition_type = p_competition_type
      AND (group_name IS NULL OR group_name = '')
  ) THEN
    RETURN 0;
  END IF;

  -- Max group round
  SELECT COALESCE(MAX(round), 0) INTO v_max_group_round
  FROM matches
  WHERE league_id = p_league_id AND season = p_season AND competition_type = p_competition_type
    AND group_name IS NOT NULL AND group_name != '';

  IF v_max_group_round = 0 THEN
    RETURN 0;
  END IF;

  -- Top teams from competition_standings (by points, goal_diff, goals_for)
  SELECT ARRAY_AGG(team_id ORDER BY points DESC, goal_diff DESC, goals_for DESC)
  INTO v_teams
  FROM (
    SELECT team_id, points, goal_diff, goals_for
    FROM competition_standings
    WHERE league_id = p_league_id AND season = p_season AND competition_type = p_competition_type
    ORDER BY points DESC, goal_diff DESC, goals_for DESC
    LIMIT 4
  ) sub;

  IF v_teams IS NULL OR array_length(v_teams, 1) < 2 THEN
    RETURN 0;
  END IF;

  v_n := array_length(v_teams, 1);
  v_semi_round := v_max_group_round + 1;
  v_final_round := v_max_group_round + 2;

  IF v_n = 2 THEN
    -- Final only: 1st vs 2nd
    INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
    VALUES (p_league_id, p_season, v_semi_round, v_teams[1], v_teams[2], p_competition_type, NULL, 'scheduled');
    v_count := 1;
  ELSE
    -- Semifinals: 1st vs 4th, 2nd vs 3rd (group_name NULL = knockout)
    INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
    VALUES
      (p_league_id, p_season, v_semi_round, v_teams[1], v_teams[4], p_competition_type, NULL, 'scheduled'),
      (p_league_id, p_season, v_semi_round, v_teams[2], v_teams[3], p_competition_type, NULL, 'scheduled');
    v_count := 2;
    -- Final: placeholder with TBD - we'll need to update after semis. For now create a dummy that gets overwritten.
    -- Actually we can't create the final until semis are played. So we only create semis here.
    -- The final will be created when semis are simulated - by a separate trigger or in simulate_matchday_competition.
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create final match after semifinals are simulated (winners advance)
CREATE OR REPLACE FUNCTION create_final_after_semis(p_league_id UUID, p_season INTEGER, p_competition_type TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_semi_round INT;
  v_final_round INT;
  v_winner1 UUID;
  v_winner2 UUID;
  v_home1 UUID;
  v_away1 UUID;
  v_home2 UUID;
  v_away2 UUID;
  v_score1_h INT;
  v_score1_a INT;
  v_score2_h INT;
  v_score2_a INT;
BEGIN
  -- Find semi round (round with 2 knockout matches, both simulated)
  SELECT round INTO v_semi_round
  FROM (
    SELECT round, COUNT(*) as cnt
    FROM matches
    WHERE league_id = p_league_id AND season = p_season AND competition_type = p_competition_type
      AND (group_name IS NULL OR group_name = '')
      AND match_status = 'simulated'
    GROUP BY round
    HAVING COUNT(*) = 2
    ORDER BY round DESC
    LIMIT 1
  ) sub;

  IF v_semi_round IS NULL THEN
    RETURN 0;
  END IF;

  -- Final already exists?
  v_final_round := v_semi_round + 1;
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND season = p_season AND competition_type = p_competition_type
      AND round = v_final_round
  ) THEN
    RETURN 0;
  END IF;

  -- Get winners from both semis
  SELECT home_team_id, away_team_id, home_score, away_score
  INTO v_home1, v_away1, v_score1_h, v_score1_a
  FROM matches
  WHERE league_id = p_league_id AND season = p_season AND competition_type = p_competition_type
    AND round = v_semi_round AND match_status = 'simulated'
  ORDER BY id
  LIMIT 1;

  SELECT home_team_id, away_team_id, home_score, away_score
  INTO v_home2, v_away2, v_score2_h, v_score2_a
  FROM matches
  WHERE league_id = p_league_id AND season = p_season AND competition_type = p_competition_type
    AND round = v_semi_round AND match_status = 'simulated'
  ORDER BY id
  OFFSET 1 LIMIT 1;

  IF v_home1 IS NULL OR v_home2 IS NULL THEN
    RETURN 0;
  END IF;

  v_winner1 := CASE WHEN v_score1_h > v_score1_a THEN v_home1 WHEN v_score1_h < v_score1_a THEN v_away1 ELSE NULL END;
  v_winner2 := CASE WHEN v_score2_h > v_score2_a THEN v_home2 WHEN v_score2_h < v_score2_a THEN v_away2 ELSE NULL END;

  IF v_winner1 IS NULL OR v_winner2 IS NULL THEN
    RETURN 0;  -- Draw in semi (shouldn't happen in knockout, but guard)
  END IF;

  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES (p_league_id, p_season, v_final_round, v_winner1, v_winner2, p_competition_type, NULL, 'scheduled');

  RETURN 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update simulate_matchday_competition: after simulating, check if we need to create knockouts
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
  v_max_group_round INTEGER;
  v_knockout_created INTEGER := 0;
  v_final_created INTEGER := 0;
BEGIN
  IF p_competition_type NOT IN ('ucl', 'uel', 'uecl', 'supercup') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid competition type. Use ucl, uel, uecl, or supercup.');
  END IF;

  SELECT season INTO v_season FROM leagues WHERE id = p_league_id;
  IF v_season IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'League not found');
  END IF;

  IF p_competition_type = 'supercup' THEN
    v_round := 1;
  ELSE
    v_round := CASE p_competition_type
      WHEN 'ucl' THEN (SELECT COALESCE(current_round_ucl, 0) FROM leagues WHERE id = p_league_id)
      WHEN 'uel' THEN (SELECT COALESCE(current_round_uel, 0) FROM leagues WHERE id = p_league_id)
      WHEN 'uecl' THEN (SELECT COALESCE(current_round_uecl, 0) FROM leagues WHERE id = p_league_id)
      ELSE 0
    END;
    IF v_round = 0 THEN
      v_round := 1;
    END IF;
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

    IF v_group_name IS NOT NULL AND v_group_name != '' AND p_competition_type != 'supercup' THEN
      v_home_goals := (v_result->>'home_goals')::int;
      v_away_goals := (v_result->>'away_goals')::int;

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

  -- Auto-create knockouts: after last group round, create semifinals (or final for 2 teams)
  IF p_competition_type IN ('ucl', 'uel', 'uecl') THEN
    SELECT COALESCE(MAX(round), 0) INTO v_max_group_round
    FROM matches
    WHERE league_id = p_league_id AND season = v_season AND competition_type = p_competition_type
      AND group_name IS NOT NULL AND group_name != '';

    IF v_round >= v_max_group_round AND v_max_group_round > 0 THEN
      v_knockout_created := create_knockout_matches(p_league_id, v_season, p_competition_type);
    END IF;

    -- After simulating semifinals (2 knockout matches), create final
    v_final_created := create_final_after_semis(p_league_id, v_season, p_competition_type);
  END IF;

  IF p_competition_type != 'supercup' THEN
    UPDATE leagues SET
      current_round_ucl = CASE WHEN p_competition_type = 'ucl' THEN v_round + 1 ELSE COALESCE(current_round_ucl, 0) END,
      current_round_uel = CASE WHEN p_competition_type = 'uel' THEN v_round + 1 ELSE COALESCE(current_round_uel, 0) END,
      current_round_uecl = CASE WHEN p_competition_type = 'uecl' THEN v_round + 1 ELSE COALESCE(current_round_uecl, 0) END
    WHERE id = p_league_id;
  END IF;

  PERFORM write_audit_log(p_league_id, 'simulate_matchday_competition', NULL,
    json_build_object('competition_type', p_competition_type, 'round', v_round, 'matches_simulated', v_match_count,
      'knockout_created', v_knockout_created, 'final_created', v_final_created)::jsonb);

  RETURN json_build_object(
    'success', true,
    'competition_type', p_competition_type,
    'round', v_round,
    'matches_simulated', v_match_count,
    'knockout_created', v_knockout_created,
    'final_created', v_final_created,
    'results', array_to_json(v_results)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update insert_match_result: auto-create knockouts when last group round completed via manual insert;
-- auto-create final when semis completed via manual insert
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
    IF v_comp_type = 'domestic' THEN
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
  END IF;

  -- Advance round: domestic or competition-specific
  IF v_comp_type = 'domestic' THEN
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

      -- Auto-create knockouts: after last group round, create semis; after semis, create final
      IF v_group_name IS NOT NULL AND v_group_name != '' THEN
        PERFORM create_knockout_matches(v_league_id, v_season, v_comp_type);
      ELSE
        PERFORM create_final_after_semis(v_league_id, v_season, v_comp_type);
      END IF;
    END IF;
  END IF;

  PERFORM write_audit_log(v_league_id, 'insert_match_result', p_actor_user_id,
    json_build_object('match_id', p_match_id, 'home_score', p_home_score, 'away_score', p_away_score, 'competition_type', v_comp_type)::jsonb);

  RETURN json_build_object('success', true, 'home_score', p_home_score, 'away_score', p_away_score, 'round_advanced', v_remaining = 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
