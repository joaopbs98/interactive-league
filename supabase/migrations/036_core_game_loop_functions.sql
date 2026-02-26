-- 036: Core game loop functions
-- generateSchedule, simulateMatchday, endSeason, auto-starter-squad

------------------------------------------------------------
-- 1. Generate round-robin schedule
------------------------------------------------------------
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

  -- Initialize standings for all teams
  INSERT INTO standings (league_id, season, team_id)
  SELECT p_league_id, p_season, unnest(v_teams)
  WHERE unnest IS NOT NULL
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

------------------------------------------------------------
-- 2. Simulate a single match (helper)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION simulate_single_match(
  p_match_id UUID,
  p_home_ovr NUMERIC,
  p_away_ovr NUMERIC
) RETURNS JSON AS $$
DECLARE
  v_diff NUMERIC;
  v_home_goals INTEGER;
  v_away_goals INTEGER;
  v_home_base NUMERIC;
  v_away_base NUMERIC;
BEGIN
  v_diff := (p_home_ovr - p_away_ovr) / 10.0;

  -- Expected goals: base ~1.3 for home, ~1.0 for away, shifted by OVR diff
  v_home_base := GREATEST(0.3, 1.3 + v_diff * 0.3);
  v_away_base := GREATEST(0.3, 1.0 - v_diff * 0.3);

  -- Poisson-like random: floor(random * base * 2) clamped 0-6
  v_home_goals := LEAST(6, GREATEST(0, floor(random() * v_home_base * 2.5)::integer));
  v_away_goals := LEAST(6, GREATEST(0, floor(random() * v_away_base * 2.5)::integer));

  UPDATE matches
  SET home_score = v_home_goals,
      away_score = v_away_goals,
      match_status = 'simulated',
      played_at = NOW()
  WHERE id = p_match_id;

  RETURN json_build_object('home_goals', v_home_goals, 'away_goals', v_away_goals);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------
-- 3. Simulate matchday (all matches in current round)
------------------------------------------------------------
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
  -- Get league info
  SELECT current_round, season, total_rounds INTO v_current_round, v_season, v_total_rounds
  FROM leagues WHERE id = p_league_id;

  IF v_current_round IS NULL OR v_current_round = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No schedule generated');
  END IF;

  -- Check there are unplayed matches this round
  IF NOT EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND season = v_season
      AND round = v_current_round AND match_status = 'scheduled'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'No scheduled matches for round ' || v_current_round);
  END IF;

  -- Simulate each match
  FOR v_match IN
    SELECT m.id, m.home_team_id, m.away_team_id
    FROM matches m
    WHERE m.league_id = p_league_id AND m.season = v_season
      AND m.round = v_current_round AND m.match_status = 'scheduled'
  LOOP
    -- Calculate average OVR for each team from league_players
    SELECT COALESCE(AVG(rating), 60) INTO v_home_ovr
    FROM league_players WHERE team_id = v_match.home_team_id;

    SELECT COALESCE(AVG(rating), 60) INTO v_away_ovr
    FROM league_players WHERE team_id = v_match.away_team_id;

    v_result := simulate_single_match(v_match.id, v_home_ovr, v_away_ovr);
    v_results := v_results || v_result;
    v_match_count := v_match_count + 1;

    -- Update standings
    IF (v_result->>'home_goals')::int > (v_result->>'away_goals')::int THEN
      -- Home win
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
      -- Away win
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
      -- Draw
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

  -- Decrement injury and suspension counters
  UPDATE league_players SET injury_games_remaining = GREATEST(0, injury_games_remaining - 1)
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND injury_games_remaining > 0;

  UPDATE league_players SET suspension_games_remaining = GREATEST(0, suspension_games_remaining - 1)
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND suspension_games_remaining > 0;

  -- Advance round
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

------------------------------------------------------------
-- 4. End Season (atomic, idempotent)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION end_season(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_season INTEGER;
  v_status league_status;
  v_team RECORD;
  v_total_wages INTEGER;
  v_prize_money INTEGER;
  v_position INTEGER := 0;
  v_expired_count INTEGER := 0;
  v_wage_total INTEGER := 0;
  v_prize_total INTEGER := 0;
BEGIN
  SELECT season, status INTO v_season, v_status FROM leagues WHERE id = p_league_id;

  -- Idempotency: prevent running twice
  IF v_status = 'SEASON_END_PROCESSING' OR v_status = 'OFFSEASON' THEN
    RETURN json_build_object('success', false, 'error', 'Season already ended or processing');
  END IF;

  -- Mark as processing
  UPDATE leagues SET status = 'SEASON_END_PROCESSING' WHERE id = p_league_id;

  -- Step 1: Verify all matches simulated
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND season = v_season AND match_status = 'scheduled'
  ) THEN
    UPDATE leagues SET status = 'IN_SEASON' WHERE id = p_league_id;
    RETURN json_build_object('success', false, 'error', 'Not all matches have been simulated');
  END IF;

  -- Step 2: Standings already maintained by simulateMatchday

  -- Step 3: Prize money distribution (by position)
  FOR v_team IN
    SELECT team_id FROM standings
    WHERE league_id = p_league_id AND season = v_season
    ORDER BY points DESC, goal_diff DESC, goals_for DESC
  LOOP
    v_position := v_position + 1;
    v_prize_money := CASE
      WHEN v_position = 1 THEN 50000000
      WHEN v_position = 2 THEN 35000000
      WHEN v_position = 3 THEN 25000000
      WHEN v_position = 4 THEN 15000000
      ELSE 10000000
    END;

    PERFORM write_finance_entry(
      v_team.team_id, p_league_id, v_prize_money,
      'Prize Money', 'Season ' || v_season || ' finish: position ' || v_position,
      v_season
    );
    v_prize_total := v_prize_total + v_prize_money;
  END LOOP;

  -- Step 4-5: Sponsor + trade objectives (simplified: log placeholder)
  -- Full implementation would iterate sponsor rules and trade_objectives here

  -- Step 6: Decrement contract years
  UPDATE contracts SET years = COALESCE(years, 1) - 1
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND status = 'active';

  -- Step 7: Expire contracts (years <= 0)
  UPDATE contracts SET status = 'expired'
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND status = 'active' AND years <= 0;

  -- Release expired players to free agency
  UPDATE league_players SET team_id = NULL
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND player_id IN (
      SELECT player_id FROM contracts
      WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
        AND status = 'expired'
    );

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Step 8: Wage payment (deduct total wages for each team)
  FOR v_team IN
    SELECT t.id as team_id FROM teams t WHERE t.league_id = p_league_id
  LOOP
    SELECT COALESCE(SUM(wage), 0) INTO v_total_wages
    FROM contracts WHERE team_id = v_team.team_id AND status = 'active';

    IF v_total_wages > 0 THEN
      PERFORM write_finance_entry(
        v_team.team_id, p_league_id, -v_total_wages,
        'Wage Payment', 'Season ' || v_season || ' wages',
        v_season
      );
      v_wage_total := v_wage_total + v_total_wages;
    END IF;
  END LOOP;

  -- Step 9: CompIndex (simplified: avg rating of squad)
  UPDATE teams t SET comp_index = (
    SELECT COALESCE(AVG(lp.rating), 0)
    FROM league_players lp WHERE lp.team_id = t.id
  ) WHERE t.league_id = p_league_id;

  -- Step 10: Draft pool not auto-generated here (host triggers manually)

  -- Step 11: Increment season + set OFFSEASON
  UPDATE leagues SET
    season = season + 1,
    active_season = COALESCE(active_season, season) + 1,
    current_round = 0,
    status = 'OFFSEASON'
  WHERE id = p_league_id;

  -- Step 12: Audit log
  PERFORM write_audit_log(p_league_id, 'end_season', NULL,
    json_build_object(
      'season', v_season,
      'prizes_distributed', v_prize_total,
      'wages_deducted', v_wage_total,
      'contracts_expired', v_expired_count
    )::jsonb);

  RETURN json_build_object(
    'success', true,
    'season_ended', v_season,
    'prizes_distributed', v_prize_total,
    'wages_deducted', v_wage_total,
    'contracts_expired', v_expired_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------
-- 5. Auto-generate starter squad for a team
------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_starter_squad(
  p_team_id UUID,
  p_league_id UUID,
  p_season INTEGER DEFAULT 1
) RETURNS JSON AS $$
DECLARE
  v_assigned INTEGER := 0;
  v_player RECORD;
  v_target_gk INTEGER := 2;
  v_target_def INTEGER := 5;
  v_target_mid INTEGER := 5;
  v_target_fwd INTEGER := 4;
  v_target_flex INTEGER := 2;
  v_gk INTEGER := 0;
  v_def INTEGER := 0;
  v_mid INTEGER := 0;
  v_fwd INTEGER := 0;
  v_flex INTEGER := 0;
  v_wage INTEGER;
BEGIN
  -- Pick GKs
  FOR v_player IN
    SELECT player_id, positions, overall_rating FROM player
    WHERE positions LIKE '%GK%'
      AND player_id NOT IN (SELECT lp.player_id FROM league_players lp WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL)
    ORDER BY random() LIMIT v_target_gk
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    SELECT p_league_id, v_player.player_id, COALESCE(p.name, 'Unknown'), v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id, p.full_name, p.image
    FROM player p WHERE p.player_id = v_player.player_id
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;

    v_gk := v_gk + 1;
    v_assigned := v_assigned + 1;
  END LOOP;

  -- Pick DEFs
  FOR v_player IN
    SELECT player_id, positions, overall_rating FROM player
    WHERE (positions LIKE '%CB%' OR positions LIKE '%LB%' OR positions LIKE '%RB%' OR positions LIKE '%RWB%' OR positions LIKE '%LWB%')
      AND positions NOT LIKE '%GK%'
      AND player_id NOT IN (SELECT lp.player_id FROM league_players lp WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL)
    ORDER BY random() LIMIT v_target_def
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    SELECT p_league_id, v_player.player_id, COALESCE(p.name, 'Unknown'), v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id, p.full_name, p.image
    FROM player p WHERE p.player_id = v_player.player_id
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;

    v_def := v_def + 1;
    v_assigned := v_assigned + 1;
  END LOOP;

  -- Pick MIDs
  FOR v_player IN
    SELECT player_id, positions, overall_rating FROM player
    WHERE (positions LIKE '%CM%' OR positions LIKE '%CDM%' OR positions LIKE '%CAM%' OR positions LIKE '%LM%' OR positions LIKE '%RM%')
      AND positions NOT LIKE '%GK%'
      AND player_id NOT IN (SELECT lp.player_id FROM league_players lp WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL)
    ORDER BY random() LIMIT v_target_mid
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    SELECT p_league_id, v_player.player_id, COALESCE(p.name, 'Unknown'), v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id, p.full_name, p.image
    FROM player p WHERE p.player_id = v_player.player_id
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;

    v_mid := v_mid + 1;
    v_assigned := v_assigned + 1;
  END LOOP;

  -- Pick FWDs
  FOR v_player IN
    SELECT player_id, positions, overall_rating FROM player
    WHERE (positions LIKE '%ST%' OR positions LIKE '%CF%' OR positions LIKE '%LW%' OR positions LIKE '%RW%')
      AND positions NOT LIKE '%GK%' AND positions NOT LIKE '%CB%'
      AND player_id NOT IN (SELECT lp.player_id FROM league_players lp WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL)
    ORDER BY random() LIMIT v_target_fwd
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    SELECT p_league_id, v_player.player_id, COALESCE(p.name, 'Unknown'), v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id, p.full_name, p.image
    FROM player p WHERE p.player_id = v_player.player_id
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;

    v_fwd := v_fwd + 1;
    v_assigned := v_assigned + 1;
  END LOOP;

  -- Pick flex (any position)
  FOR v_player IN
    SELECT player_id, positions, overall_rating FROM player
    WHERE player_id NOT IN (SELECT lp.player_id FROM league_players lp WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL)
    ORDER BY random() LIMIT v_target_flex
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    SELECT p_league_id, v_player.player_id, COALESCE(p.name, 'Unknown'), v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id, p.full_name, p.image
    FROM player p WHERE p.player_id = v_player.player_id
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;

    v_flex := v_flex + 1;
    v_assigned := v_assigned + 1;
  END LOOP;

  -- Credit initial budget with ledger entry
  PERFORM write_finance_entry(
    p_team_id, p_league_id, 250000000,
    'Initial Budget', 'Starting budget for season ' || p_season,
    p_season
  );

  RETURN json_build_object(
    'success', true,
    'players_assigned', v_assigned,
    'gk', v_gk, 'def', v_def, 'mid', v_mid, 'fwd', v_fwd, 'flex', v_flex
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------
-- 6. Apply fine (host tool)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_fine(
  p_league_id UUID,
  p_team_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_actor_id UUID
) RETURNS JSON AS $$
BEGIN
  PERFORM write_finance_entry(
    p_team_id, p_league_id, -p_amount,
    'Fine', p_reason,
    (SELECT season FROM leagues WHERE id = p_league_id)
  );

  PERFORM write_audit_log(p_league_id, 'apply_fine', p_actor_id,
    json_build_object('team_id', p_team_id, 'amount', p_amount, 'reason', p_reason)::jsonb);

  RETURN json_build_object('success', true, 'amount', p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------
-- 7. Random injury generator (host tool)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_random_injuries(
  p_league_id UUID,
  p_actor_id UUID,
  p_count INTEGER DEFAULT 3
) RETURNS JSON AS $$
DECLARE
  v_player RECORD;
  v_severity INTEGER;
  v_injured INTEGER := 0;
BEGIN
  FOR v_player IN
    SELECT lp.player_id, lp.team_id, lp.player_name
    FROM league_players lp
    JOIN teams t ON lp.team_id = t.id
    WHERE t.league_id = p_league_id
      AND lp.team_id IS NOT NULL
      AND lp.injury_games_remaining = 0
    ORDER BY random()
    LIMIT p_count
  LOOP
    -- Roll severity: 1-3 games (50%), 4-6 (30%), 7-10 (20%)
    v_severity := CASE
      WHEN random() < 0.5 THEN 1 + floor(random() * 3)::int
      WHEN random() < 0.8 THEN 4 + floor(random() * 3)::int
      ELSE 7 + floor(random() * 4)::int
    END;

    UPDATE league_players SET injury_games_remaining = v_severity
    WHERE player_id = v_player.player_id AND league_id = p_league_id;

    -- Also insert into injuries table for tracking
    INSERT INTO injuries (player_id, team_id, league_id, type, description, games_remaining)
    VALUES (v_player.player_id, v_player.team_id, p_league_id, 'injury',
      'Random injury (' || v_severity || ' games)', v_severity);

    v_injured := v_injured + 1;
  END LOOP;

  PERFORM write_audit_log(p_league_id, 'generate_injuries', p_actor_id,
    json_build_object('count', v_injured)::jsonb);

  RETURN json_build_object('success', true, 'injuries_generated', v_injured);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
