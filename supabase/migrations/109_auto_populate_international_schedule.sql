-- 109: Auto-populate international competition group stage from domestic standings
-- UCL: top 4, UEL: 5-6, UECL: 7-8. Host can manually adjust via Schedule page.
-- Qualification is from previous season's standings; matches are for the given season.

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
BEGIN
  IF p_season <= 1 THEN
    RETURN json_build_object('success', false, 'error', 'No previous season standings for qualification. Run after season 2+.');
  END IF;

  v_qual_season := p_season - 1;

  -- Get top 8 teams from previous season standings
  SELECT array_agg(team_id ORDER BY pos)
  INTO v_teams
  FROM (
    SELECT team_id, ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) as pos
    FROM standings
    WHERE league_id = p_league_id AND season = v_qual_season
    LIMIT 8
  ) sub;

  IF v_teams IS NULL OR array_length(v_teams, 1) < 4 THEN
    RETURN json_build_object('success', false, 'error', 'Need at least 4 teams in previous season standings');
  END IF;

  -- Check if matches already exist for this season's competitions
  SELECT COUNT(*) INTO v_exists
  FROM matches
  WHERE league_id = p_league_id AND season = p_season
    AND competition_type IN ('ucl', 'uel', 'uecl');
  IF v_exists > 0 THEN
    RETURN json_build_object('success', false, 'error', 'International matches already exist for this season. Delete them first to regenerate.');
  END IF;

  -- UCL: positions 1-4 -> Group A, round-robin (6 matches)
  v_ucl_teams := ARRAY[v_teams[1], v_teams[2], v_teams[3], v_teams[4]];
  -- Round-robin for 4 teams: (1,2),(3,4) r1; (1,3),(2,4) r2; (1,4),(2,3) r3
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 1, v_ucl_teams[1], v_ucl_teams[2], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 1, v_ucl_teams[3], v_ucl_teams[4], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 2, v_ucl_teams[1], v_ucl_teams[3], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 2, v_ucl_teams[2], v_ucl_teams[4], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 3, v_ucl_teams[1], v_ucl_teams[4], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 3, v_ucl_teams[2], v_ucl_teams[3], 'ucl', 'A', 'scheduled');
  v_count := v_count + 6;

  -- UEL: positions 5-6 -> Group A (2 teams, 2 matches home/away)
  IF array_length(v_teams, 1) >= 6 THEN
    v_uel_teams := ARRAY[v_teams[5], v_teams[6]];
    INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
    VALUES
      (p_league_id, p_season, 1, v_uel_teams[1], v_uel_teams[2], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 2, v_uel_teams[2], v_uel_teams[1], 'uel', 'A', 'scheduled');
    v_count := v_count + 2;
  END IF;

  -- UECL: positions 7-8 -> Group A (2 teams, 2 matches home/away)
  IF array_length(v_teams, 1) >= 8 THEN
    v_uecl_teams := ARRAY[v_teams[7], v_teams[8]];
    INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
    VALUES
      (p_league_id, p_season, 1, v_uecl_teams[1], v_uecl_teams[2], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 2, v_uecl_teams[2], v_uecl_teams[1], 'uecl', 'A', 'scheduled');
    v_count := v_count + 2;
  END IF;

  -- Seed competition_standings for group stage (so insert_match_result can update them)
  INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
  SELECT p_league_id, p_season, 'ucl', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_ucl_teams) AS t
  ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;

  IF array_length(v_teams, 1) >= 6 THEN
    INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
    SELECT p_league_id, p_season, 'uel', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_uel_teams) AS t
    ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;
  END IF;

  IF array_length(v_teams, 1) >= 8 THEN
    INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
    SELECT p_league_id, p_season, 'uecl', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_uecl_teams) AS t
    ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;
  END IF;

  RETURN json_build_object('success', true, 'matches_created', v_count, 'season', p_season);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
