-- 116: Proportional qualification based on league size (14-team basis: UCL 6/14, UECL 4/14, UEL 4/14)
-- Supports 6-20 teams. Round-robin for 2-6 teams per group.

CREATE OR REPLACE FUNCTION insert_round_robin_matches(
  p_league_id UUID, p_season INTEGER, p_comp TEXT, p_teams UUID[], p_group TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_n INT := array_length(p_teams, 1);
  v_round INT := 1;
  v_matches_per_round INT;
  v_count INT := 0;
  v_i INT; v_j INT;
  v_pairs UUID[][];
  v_idx INT := 1;
  v_total_pairs INT;
BEGIN
  IF v_n < 2 THEN RETURN 0; END IF;

  -- Build all pairs (i,j) for i < j, each pair becomes 2 matches (home/away, away/home)
  v_total_pairs := v_n * (v_n - 1) / 2;
  v_matches_per_round := v_n / 2;  -- for even n; for odd n we use (n-1)/2

  -- Single round-robin: all pairs (i,j) i<j
  FOR v_i IN 1..v_n-1 LOOP
    FOR v_j IN v_i+1..v_n LOOP
      INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
      VALUES (p_league_id, p_season, v_round, p_teams[v_i], p_teams[v_j], p_comp, p_group, 'scheduled');
      v_count := v_count + 1;
      -- Assign to rounds: each round gets v_matches_per_round matches (or (n-1)/2 for odd n)
      IF v_n % 2 = 0 THEN
        IF v_count % v_matches_per_round = 0 THEN v_round := v_round + 1; END IF;
      ELSE
        IF v_count % ((v_n-1)/2) = 0 AND v_count > 0 THEN v_round := v_round + 1; END IF;
      END IF;
    END LOOP;
  END LOOP;

  v_round := v_round + 1;  -- start return leg

  -- Return leg: swap home/away
  FOR v_i IN 1..v_n-1 LOOP
    FOR v_j IN v_i+1..v_n LOOP
      INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
      VALUES (p_league_id, p_season, v_round, p_teams[v_j], p_teams[v_i], p_comp, p_group, 'scheduled');
      v_count := v_count + 1;
      IF v_n % 2 = 0 THEN
        IF v_count % v_matches_per_round = 0 THEN v_round := v_round + 1; END IF;
      ELSE
        IF v_count % ((v_n-1)/2) = 0 AND v_count > 0 THEN v_round := v_round + 1; END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Fix round assignment: the above logic is wrong. Simpler: just assign round = 1 for first half, round = 2 for second, etc.
-- Actually for 4 teams we need 6 rounds. Let me use a cleaner approach: precompute rounds using the circle method.
-- Simpler: use a table of (round, home_idx, away_idx) for each group size, or generate in order.
-- For 4 teams: 6 matches per leg, 2 per round. Rounds 1-3 leg1, 4-6 leg2.
-- The order of pairs matters for round assignment. Let me use a deterministic order.

DROP FUNCTION IF EXISTS insert_round_robin_matches(UUID, INTEGER, TEXT, UUID[], TEXT);

-- Simpler: generate matches in canonical order, assign rounds sequentially
CREATE OR REPLACE FUNCTION insert_round_robin_matches(
  p_league_id UUID, p_season INTEGER, p_comp TEXT, p_teams UUID[], p_group TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_n INT := array_length(p_teams, 1);
  v_matches_per_round INT;
  v_round INT := 1;
  v_in_round INT := 0;
  v_count INT := 0;
  v_i INT; v_j INT;
BEGIN
  IF v_n < 2 THEN RETURN 0; END IF;
  v_matches_per_round := CASE WHEN v_n % 2 = 0 THEN v_n / 2 ELSE (v_n - 1) / 2 END;

  -- Leg 1: (i,j) for i<j
  FOR v_i IN 1..v_n-1 LOOP
    FOR v_j IN v_i+1..v_n LOOP
      INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
      VALUES (p_league_id, p_season, v_round, p_teams[v_i], p_teams[v_j], p_comp, p_group, 'scheduled');
      v_count := v_count + 1;
      v_in_round := v_in_round + 1;
      IF v_in_round >= v_matches_per_round THEN v_round := v_round + 1; v_in_round := 0; END IF;
    END LOOP;
  END LOOP;

  -- Leg 2: (j,i) for i<j
  FOR v_i IN 1..v_n-1 LOOP
    FOR v_j IN v_i+1..v_n LOOP
      INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
      VALUES (p_league_id, p_season, v_round, p_teams[v_j], p_teams[v_i], p_comp, p_group, 'scheduled');
      v_count := v_count + 1;
      v_in_round := v_in_round + 1;
      IF v_in_round >= v_matches_per_round THEN v_round := v_round + 1; v_in_round := 0; END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Main function with proportional allocation
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
  v_pos INT;
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

  -- Proportional allocation (14-team basis: UCL 6, UECL 4, UEL 4)
  -- n_ucl = round(n * 6/14), min 2, max 6
  -- n_uecl = round(n * 4/14), min 0
  -- n_uel = remainder (n - n_ucl - n_uecl), min 0
  v_n_ucl := GREATEST(2, LEAST(6, ROUND(v_n * 6.0 / 14)::INT));
  v_n_uecl := GREATEST(0, ROUND(v_n * 4.0 / 14)::INT);
  v_n_uel := GREATEST(0, v_n - v_n_ucl - v_n_uecl);

  -- Ensure we don't overallocate (e.g. 8 teams: 3+2+3=8 ok; 10: 4+3+3=10 ok)
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

  -- UCL: positions 1 to v_n_ucl
  v_ucl_teams := ARRAY(SELECT v_teams[v_pos] FROM generate_series(1, v_n_ucl) AS v_pos);
  v_count := v_count + insert_round_robin_matches(p_league_id, p_season, 'ucl', v_ucl_teams, 'A');

  -- UECL: positions v_n_ucl+1 to v_n_ucl+v_n_uecl (if n_uecl >= 2)
  IF v_n_uecl >= 2 THEN
    v_uecl_teams := ARRAY(SELECT v_teams[v_pos] FROM generate_series(v_n_ucl + 1, v_n_ucl + v_n_uecl) AS v_pos);
    v_count := v_count + insert_round_robin_matches(p_league_id, p_season, 'uecl', v_uecl_teams, 'A');
  END IF;

  -- UEL: positions v_n_ucl+v_n_uecl+1 to end (if n_uel >= 2)
  IF v_n_uel >= 2 THEN
    v_uel_teams := ARRAY(SELECT v_teams[v_pos] FROM generate_series(v_n_ucl + v_n_uecl + 1, v_n_ucl + v_n_uecl + v_n_uel) AS v_pos);
    v_count := v_count + insert_round_robin_matches(p_league_id, p_season, 'uel', v_uel_teams, 'A');
  END IF;

  -- Super Cup (S2+)
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

  -- Seed competition_standings
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
