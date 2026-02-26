-- 117: Fix ambiguous v_pos column reference in auto_populate_international_schedule

CREATE OR REPLACE FUNCTION auto_populate_international_schedule(p_league_id UUID, p_season INTEGER)
RETURNS JSON AS $$
DECLARE
  v_qual_season INTEGER;
  v_teams UUID[];
  v_ucl_teams UUID[];
  v_uel_teams UUID[];
  v_uecl_teams UUID[];
  v_count INTEGER := 0;
  v_exists INTEGER;
  v_ucl_winner UUID;
  v_uel_winner UUID;
  v_n INTEGER;
  v_n_ucl INTEGER;
  v_n_uecl INTEGER;
  v_n_uel INTEGER;
BEGIN
  v_qual_season := p_season;

  SELECT array_agg(team_id ORDER BY pos)
  INTO v_teams
  FROM (
    SELECT team_id, ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) as pos
    FROM standings
    WHERE league_id = p_league_id AND season = v_qual_season
    LIMIT 20
  ) sub;

  IF v_teams IS NULL OR array_length(v_teams, 1) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Need at least 6 teams in standings. Ensure domestic rounds are finished.');
  END IF;

  v_n := array_length(v_teams, 1);

  v_n_ucl := GREATEST(2, LEAST(6, ROUND(v_n * 6.0 / 14)::INT));
  v_n_uecl := GREATEST(0, ROUND(v_n * 4.0 / 14)::INT);
  v_n_uel := GREATEST(0, v_n - v_n_ucl - v_n_uecl);

  IF v_n_ucl + v_n_uecl + v_n_uel > v_n THEN
    v_n_uel := v_n - v_n_ucl - v_n_uecl;
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM matches
  WHERE league_id = p_league_id AND season = p_season
    AND competition_type IN ('ucl', 'uel', 'uecl', 'supercup');
  IF v_exists > 0 THEN
    RETURN json_build_object('success', false, 'error', 'International matches already exist. Delete them first to regenerate.');
  END IF;

  -- UCL: positions 1 to v_n_ucl (use gs alias to avoid conflict with PL/pgSQL variables)
  v_ucl_teams := ARRAY(SELECT v_teams[gs] FROM generate_series(1, v_n_ucl) gs);
  v_count := v_count + insert_round_robin_matches(p_league_id, p_season, 'ucl', v_ucl_teams, 'A');

  IF v_n_uecl >= 2 THEN
    v_uecl_teams := ARRAY(SELECT v_teams[gs] FROM generate_series(v_n_ucl + 1, v_n_ucl + v_n_uecl) gs);
    v_count := v_count + insert_round_robin_matches(p_league_id, p_season, 'uecl', v_uecl_teams, 'A');
  END IF;

  IF v_n_uel >= 2 THEN
    v_uel_teams := ARRAY(SELECT v_teams[gs] FROM generate_series(v_n_ucl + v_n_uecl + 1, v_n_ucl + v_n_uecl + v_n_uel) gs);
    v_count := v_count + insert_round_robin_matches(p_league_id, p_season, 'uel', v_uel_teams, 'A');
  END IF;

  IF p_season >= 2 THEN
    SELECT team_id INTO v_ucl_winner FROM team_competition_results
    WHERE league_id = p_league_id AND season = p_season - 1 AND stage = 'UCL Winners' LIMIT 1;
    SELECT team_id INTO v_uel_winner FROM team_competition_results
    WHERE league_id = p_league_id AND season = p_season - 1 AND stage = 'UEL Winners' LIMIT 1;
    IF v_ucl_winner IS NOT NULL AND v_uel_winner IS NOT NULL THEN
      INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
      VALUES (p_league_id, p_season, 1, v_ucl_winner, v_uel_winner, 'supercup', NULL, 'scheduled');
      v_count := v_count + 1;
    END IF;
  END IF;

  INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
  SELECT p_league_id, p_season, 'ucl', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_ucl_teams) AS t
  ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;

  IF v_n_uecl >= 2 THEN
    INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
    SELECT p_league_id, p_season, 'uecl', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_uecl_teams) AS t
    ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;
  END IF;

  IF v_n_uel >= 2 THEN
    INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
    SELECT p_league_id, p_season, 'uel', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_uel_teams) AS t
    ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;
  END IF;

  RETURN json_build_object('success', true, 'matches_created', v_count, 'season', p_season,
    'alloc', json_build_object('ucl', v_n_ucl, 'uecl', v_n_uecl, 'uel', v_n_uel));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
