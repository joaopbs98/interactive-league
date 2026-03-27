-- 046: Fix generate_schedule unnest syntax
-- "column unnest does not exist" - use FROM unnest() with alias instead of SELECT unnest()

CREATE OR REPLACE FUNCTION generate_schedule(p_league_id UUID, p_season INTEGER)
RETURNS JSON AS $$
DECLARE
  v_teams UUID[];
  v_num_teams INTEGER;
  v_total_rounds INTEGER;
  v_matches_per_round INTEGER;
  v_round INTEGER;
  v_i INTEGER;
  v_home UUID;
  v_away UUID;
  v_rotated UUID[];
  v_match_count INTEGER := 0;
  v_actor_id UUID;
BEGIN
  SELECT array_agg(id ORDER BY random()) INTO v_teams
  FROM teams WHERE league_id = p_league_id;

  v_num_teams := array_length(v_teams, 1);
  IF v_num_teams IS NULL OR v_num_teams < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Need at least 2 teams');
  END IF;

  -- If odd number add a "bye" placeholder
  IF v_num_teams % 2 = 1 THEN
    v_teams := v_teams || NULL::UUID;
    v_num_teams := v_num_teams + 1;
  END IF;

  v_total_rounds := (v_num_teams - 1) * 2; -- home and away
  v_matches_per_round := v_num_teams / 2;

  -- Delete existing fixtures for this league+season
  DELETE FROM matches WHERE league_id = p_league_id AND season = p_season;

  v_rotated := v_teams;

  FOR v_round IN 1..v_total_rounds LOOP
    FOR v_i IN 1..v_matches_per_round LOOP
      v_home := v_rotated[v_i];
      v_away := v_rotated[v_num_teams - v_i + 1];

      IF v_home IS NOT NULL AND v_away IS NOT NULL THEN
        -- Swap home/away for second half of season
        IF v_round > (v_total_rounds / 2) THEN
          INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, match_status)
          VALUES (p_league_id, p_season, v_round, v_away, v_home, 'scheduled');
        ELSE
          INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, match_status)
          VALUES (p_league_id, p_season, v_round, v_home, v_away, 'scheduled');
        END IF;
        v_match_count := v_match_count + 1;
      END IF;
    END LOOP;

    -- Rotate: fix first element, rotate rest
    v_rotated := v_rotated[1:1] || v_rotated[v_num_teams:v_num_teams] || v_rotated[2:v_num_teams-1];
  END LOOP;

  -- Update league
  UPDATE leagues SET total_rounds = v_total_rounds, current_round = 1 WHERE id = p_league_id;

  -- Initialize standings for all teams (fixed: use FROM unnest with alias)
  INSERT INTO standings (league_id, season, team_id)
  SELECT p_league_id, p_season, t.team_id
  FROM unnest(v_teams) AS t(team_id)
  WHERE t.team_id IS NOT NULL
  ON CONFLICT (league_id, season, team_id) DO NOTHING;

  PERFORM write_audit_log(p_league_id, 'generate_schedule', NULL,
    json_build_object('season', p_season, 'rounds', v_total_rounds, 'matches', v_match_count)::jsonb);

  RETURN json_build_object(
    'success', true,
    'total_rounds', v_total_rounds,
    'matches_created', v_match_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
