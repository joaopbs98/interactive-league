-- 052: Use starting XI OVR for match simulation (IL25 spec)
-- Compute team strength from starting 11 instead of all league_players

CREATE OR REPLACE FUNCTION get_team_ovr_for_match(p_team_id UUID, p_league_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_squad JSONB;
  v_starting JSONB;
  v_player_ids TEXT[] := '{}';
  v_ovr NUMERIC;
BEGIN
  -- Get squad or starting_lineup from teams
  SELECT squad, starting_lineup INTO v_squad, v_starting
  FROM teams WHERE id = p_team_id;

  -- Extract player IDs: prefer starting_lineup (first 11), else first 11 from squad
  IF v_starting IS NOT NULL AND jsonb_array_length(v_starting) >= 11 THEN
    SELECT array_agg(elem->>'player_id') INTO v_player_ids
    FROM jsonb_array_elements(v_starting) WITH ORDINALITY AS t(elem, ord)
    WHERE ord <= 11 AND elem->>'player_id' IS NOT NULL;
  ELSIF v_squad IS NOT NULL AND jsonb_array_length(v_squad) >= 11 THEN
    SELECT array_agg(elem->>'player_id') INTO v_player_ids
    FROM jsonb_array_elements(v_squad) WITH ORDINALITY AS t(elem, ord)
    WHERE ord <= 11 AND elem->>'player_id' IS NOT NULL;
  END IF;

  -- If we have 11 player IDs, compute OVR from league_players for those
  IF v_player_ids IS NOT NULL AND array_length(v_player_ids, 1) >= 11 THEN
    SELECT COALESCE(AVG(lp.rating), 60) INTO v_ovr
    FROM league_players lp
    WHERE lp.league_id = p_league_id AND lp.team_id = p_team_id
      AND lp.player_id = ANY(v_player_ids);
    RETURN v_ovr;
  END IF;

  -- Fallback: AVG of all league_players on team
  SELECT COALESCE(AVG(rating), 60) INTO v_ovr
  FROM league_players WHERE team_id = p_team_id;
  RETURN v_ovr;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Update simulate_matchday to use get_team_ovr_for_match
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
  ) THEN
    RETURN json_build_object('success', false, 'error', 'No scheduled matches for round ' || v_current_round);
  END IF;

  FOR v_match IN
    SELECT m.id, m.home_team_id, m.away_team_id
    FROM matches m
    WHERE m.league_id = p_league_id AND m.season = v_season
      AND m.round = v_current_round AND m.match_status = 'scheduled'
  LOOP
    -- Use starting XI OVR (fallback to all players)
    v_home_ovr := get_team_ovr_for_match(v_match.home_team_id, p_league_id);
    v_away_ovr := get_team_ovr_for_match(v_match.away_team_id, p_league_id);

    v_result := simulate_single_match(v_match.id, v_home_ovr, v_away_ovr);
    v_results := v_results || v_result;
    v_match_count := v_match_count + 1;

    IF (v_result->>'home_goals')::int > (v_result->>'away_goals')::int THEN
      UPDATE standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + (v_result->>'home_goals')::int,
        goals_against = goals_against + (v_result->>'away_goals')::int,
        goal_diff = goal_diff + (v_result->>'home_goals')::int - (v_result->>'away_goals')::int,
        updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.home_team_id;
      UPDATE standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + (v_result->>'away_goals')::int,
        goals_against = goals_against + (v_result->>'home_goals')::int,
        goal_diff = goal_diff + (v_result->>'away_goals')::int - (v_result->>'home_goals')::int,
        updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.away_team_id;
    ELSIF (v_result->>'home_goals')::int < (v_result->>'away_goals')::int THEN
      UPDATE standings SET played = played + 1, losses = losses + 1,
        goals_for = goals_for + (v_result->>'home_goals')::int,
        goals_against = goals_against + (v_result->>'away_goals')::int,
        goal_diff = goal_diff + (v_result->>'home_goals')::int - (v_result->>'away_goals')::int,
        updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.home_team_id;
      UPDATE standings SET played = played + 1, wins = wins + 1, points = points + 3,
        goals_for = goals_for + (v_result->>'away_goals')::int,
        goals_against = goals_against + (v_result->>'home_goals')::int,
        goal_diff = goal_diff + (v_result->>'away_goals')::int - (v_result->>'home_goals')::int,
        updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.away_team_id;
    ELSE
      UPDATE standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + (v_result->>'home_goals')::int,
        goals_against = goals_against + (v_result->>'away_goals')::int,
        updated_at = NOW()
      WHERE league_id = p_league_id AND season = v_season AND team_id = v_match.home_team_id;
      UPDATE standings SET played = played + 1, draws = draws + 1, points = points + 1,
        goals_for = goals_for + (v_result->>'away_goals')::int,
        goals_against = goals_against + (v_result->>'home_goals')::int,
        updated_at = NOW()
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
