-- 112: IL qualification rules (UCL 1-6, UECL 7-10, UEL 11-14) + Super Cup
-- Season 1 uses same-season domestic standings; S2+ uses previous season.
-- Super Cup: UCL winner vs UEL winner from previous season (S2+ only).

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
BEGIN
  -- Season 1: use same-season standings. S2+: use previous season.
  v_qual_season := CASE WHEN p_season = 1 THEN p_season ELSE p_season - 1 END;

  -- Get top 14 teams from qualification season standings
  SELECT array_agg(team_id ORDER BY pos)
  INTO v_teams
  FROM (
    SELECT team_id, ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) as pos
    FROM standings
    WHERE league_id = p_league_id AND season = v_qual_season
    LIMIT 14
  ) sub;

  IF v_teams IS NULL OR array_length(v_teams, 1) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Need at least 6 teams in standings for qualification');
  END IF;

  v_n := array_length(v_teams, 1);

  -- Check if matches already exist for this season's competitions
  SELECT COUNT(*) INTO v_exists
  FROM matches
  WHERE league_id = p_league_id AND season = p_season
    AND competition_type IN ('ucl', 'uel', 'uecl', 'supercup');
  IF v_exists > 0 THEN
    RETURN json_build_object('success', false, 'error', 'International matches already exist for this season. Delete them first to regenerate.');
  END IF;

  -- UCL: positions 1-6 (6 teams), double round-robin, 10 rounds x 3 matches
  v_ucl_teams := ARRAY[v_teams[1], v_teams[2], v_teams[3], v_teams[4], v_teams[5], v_teams[6]];
  -- Circle method: rounds 1-5 single leg, 6-10 return leg
  -- Round 1: (1,2),(3,4),(5,6)
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 1, v_ucl_teams[1], v_ucl_teams[2], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 1, v_ucl_teams[3], v_ucl_teams[4], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 1, v_ucl_teams[5], v_ucl_teams[6], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  -- Round 2: (1,3),(2,5),(4,6)
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 2, v_ucl_teams[1], v_ucl_teams[3], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 2, v_ucl_teams[2], v_ucl_teams[5], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 2, v_ucl_teams[4], v_ucl_teams[6], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  -- Round 3: (1,4),(2,6),(3,5)
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 3, v_ucl_teams[1], v_ucl_teams[4], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 3, v_ucl_teams[2], v_ucl_teams[6], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 3, v_ucl_teams[3], v_ucl_teams[5], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  -- Round 4: (1,5),(2,4),(3,6)
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 4, v_ucl_teams[1], v_ucl_teams[5], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 4, v_ucl_teams[2], v_ucl_teams[4], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 4, v_ucl_teams[3], v_ucl_teams[6], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  -- Round 5: (1,6),(2,3),(4,5)
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 5, v_ucl_teams[1], v_ucl_teams[6], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 5, v_ucl_teams[2], v_ucl_teams[3], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 5, v_ucl_teams[4], v_ucl_teams[5], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  -- Return leg rounds 6-10
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 6, v_ucl_teams[2], v_ucl_teams[1], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 6, v_ucl_teams[4], v_ucl_teams[3], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 6, v_ucl_teams[6], v_ucl_teams[5], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 7, v_ucl_teams[3], v_ucl_teams[1], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 7, v_ucl_teams[5], v_ucl_teams[2], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 7, v_ucl_teams[6], v_ucl_teams[4], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 8, v_ucl_teams[4], v_ucl_teams[1], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 8, v_ucl_teams[6], v_ucl_teams[2], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 8, v_ucl_teams[5], v_ucl_teams[3], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 9, v_ucl_teams[5], v_ucl_teams[1], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 9, v_ucl_teams[4], v_ucl_teams[2], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 9, v_ucl_teams[6], v_ucl_teams[3], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;
  INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
  VALUES
    (p_league_id, p_season, 10, v_ucl_teams[6], v_ucl_teams[1], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 10, v_ucl_teams[3], v_ucl_teams[2], 'ucl', 'A', 'scheduled'),
    (p_league_id, p_season, 10, v_ucl_teams[5], v_ucl_teams[4], 'ucl', 'A', 'scheduled');
  v_count := v_count + 3;

  -- UECL: positions 7-10 (4 teams), double round-robin, 6 rounds x 2 matches
  IF v_n >= 10 THEN
    v_uecl_teams := ARRAY[v_teams[7], v_teams[8], v_teams[9], v_teams[10]];
    INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
    VALUES
      (p_league_id, p_season, 1, v_uecl_teams[1], v_uecl_teams[2], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 1, v_uecl_teams[3], v_uecl_teams[4], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 2, v_uecl_teams[1], v_uecl_teams[3], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 2, v_uecl_teams[2], v_uecl_teams[4], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 3, v_uecl_teams[1], v_uecl_teams[4], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 3, v_uecl_teams[2], v_uecl_teams[3], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 4, v_uecl_teams[2], v_uecl_teams[1], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 4, v_uecl_teams[4], v_uecl_teams[3], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 5, v_uecl_teams[3], v_uecl_teams[1], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 5, v_uecl_teams[4], v_uecl_teams[2], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 6, v_uecl_teams[4], v_uecl_teams[1], 'uecl', 'A', 'scheduled'),
      (p_league_id, p_season, 6, v_uecl_teams[3], v_uecl_teams[2], 'uecl', 'A', 'scheduled');
    v_count := v_count + 12;
  END IF;

  -- UEL: positions 11-14 (4 teams), double round-robin, 6 rounds x 2 matches
  IF v_n >= 14 THEN
    v_uel_teams := ARRAY[v_teams[11], v_teams[12], v_teams[13], v_teams[14]];
    INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
    VALUES
      (p_league_id, p_season, 1, v_uel_teams[1], v_uel_teams[2], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 1, v_uel_teams[3], v_uel_teams[4], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 2, v_uel_teams[1], v_uel_teams[3], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 2, v_uel_teams[2], v_uel_teams[4], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 3, v_uel_teams[1], v_uel_teams[4], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 3, v_uel_teams[2], v_uel_teams[3], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 4, v_uel_teams[2], v_uel_teams[1], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 4, v_uel_teams[4], v_uel_teams[3], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 5, v_uel_teams[3], v_uel_teams[1], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 5, v_uel_teams[4], v_uel_teams[2], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 6, v_uel_teams[4], v_uel_teams[1], 'uel', 'A', 'scheduled'),
      (p_league_id, p_season, 6, v_uel_teams[3], v_uel_teams[2], 'uel', 'A', 'scheduled');
    v_count := v_count + 12;
  END IF;

  -- Super Cup: UCL winner vs UEL winner from previous season (S2+ only)
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

  -- Seed competition_standings for UCL/UECL/UEL (not supercup)
  INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
  SELECT p_league_id, p_season, 'ucl', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_ucl_teams) AS t
  ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;

  IF v_n >= 10 THEN
    INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
    SELECT p_league_id, p_season, 'uecl', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_uecl_teams) AS t
    ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;
  END IF;

  IF v_n >= 14 THEN
    INSERT INTO competition_standings (league_id, season, competition_type, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, goal_diff, points)
    SELECT p_league_id, p_season, 'uel', 'A', t, 0, 0, 0, 0, 0, 0, 0, 0 FROM unnest(v_uel_teams) AS t
    ON CONFLICT (league_id, season, competition_type, group_name, team_id) DO NOTHING;
  END IF;

  RETURN json_build_object('success', true, 'matches_created', v_count, 'season', p_season);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
