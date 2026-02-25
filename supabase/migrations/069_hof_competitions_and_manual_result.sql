-- 069: HOF from competition stages (Truth §8); manual result insertion

-- team_competition_results: host enters each team's competition stage per season
CREATE TABLE IF NOT EXISTS team_competition_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  stage TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_tcr_league_season ON team_competition_results(league_id, season);
ALTER TABLE team_competition_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view competition results in their leagues" ON team_competition_results
  FOR SELECT USING (
    league_id IN (SELECT league_id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Commissioners can manage competition results" ON team_competition_results
  FOR ALL USING (
    league_id IN (SELECT id FROM leagues WHERE commissioner_user_id = auth.uid())
  );

-- Stage -> HOF points (Truth §8)
CREATE OR REPLACE FUNCTION get_hof_points_for_stage(p_stage TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_stage
    WHEN 'UCL Winners' THEN 10
    WHEN 'UCL Finalist' THEN 9
    WHEN 'UCL Semi-Finalist' THEN 8
    WHEN 'UCL Group Stage' THEN 5
    WHEN 'UEL Winners' THEN 7
    WHEN 'UEL Finalist' THEN 6
    WHEN 'UEL Semi-Finalist' THEN 5
    WHEN 'UEL Group Stage' THEN 2
    WHEN 'UECL Winners' THEN 4
    WHEN 'UECL Finalist' THEN 3
    WHEN 'UECL Semi-Finalist' THEN 2
    WHEN 'UECL Group Stage' THEN 1
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- insert_match_result: manual result entry (for match_mode = MANUAL)
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
BEGIN
  SELECT m.id, m.league_id, m.season, m.round, m.match_status, m.home_team_id, m.away_team_id
  INTO v_match
  FROM matches m
  WHERE m.id = p_match_id;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.match_status = 'simulated' THEN
    RETURN json_build_object('success', false, 'error', 'Match already has a result');
  END IF;

  IF p_home_score IS NULL OR p_away_score IS NULL OR p_home_score < 0 OR p_away_score < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid scores');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_match.league_id AND commissioner_user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Host only');
  END IF;

  v_league_id := v_match.league_id;
  v_season := v_match.season;
  v_round := v_match.round;

  UPDATE matches
  SET home_score = p_home_score, away_score = p_away_score, match_status = 'simulated', played_at = NOW()
  WHERE id = p_match_id;

  -- Update standings
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

  -- If all matches in this round are done, advance round
  SELECT COUNT(*) INTO v_remaining
  FROM matches
  WHERE league_id = v_league_id AND season = v_season AND round = v_round AND match_status = 'scheduled';

  IF v_remaining = 0 THEN
    UPDATE leagues SET current_round = current_round + 1 WHERE id = v_league_id;
  END IF;

  PERFORM write_audit_log(v_league_id, 'insert_match_result', p_actor_user_id,
    json_build_object('match_id', p_match_id, 'home_score', p_home_score, 'away_score', p_away_score)::jsonb);

  RETURN json_build_object('success', true, 'home_score', p_home_score, 'away_score', p_away_score, 'round_advanced', v_remaining = 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Host: set team competition result (for HOF)
CREATE OR REPLACE FUNCTION set_team_competition_result(
  p_team_id UUID,
  p_league_id UUID,
  p_season INTEGER,
  p_stage TEXT,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = p_league_id AND commissioner_user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Host only');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND league_id = p_league_id) THEN
    RETURN json_build_object('success', false, 'error', 'Team not in league');
  END IF;

  INSERT INTO team_competition_results (team_id, league_id, season, stage)
  VALUES (p_team_id, p_league_id, p_season, p_stage)
  ON CONFLICT (team_id, league_id, season) DO UPDATE SET stage = p_stage;

  RETURN json_build_object('success', true, 'stage', p_stage);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update end_season: HOF from competition results when available, else position-based fallback
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
  v_sponsor_total INTEGER := 0;
  v_obj RECORD;
  v_from_budget INTEGER;
  v_to_budget INTEGER;
  v_sponsor RECORD;
  v_team_position INTEGER;
  v_hof_points INTEGER;
  v_comp_stage TEXT;
BEGIN
  SELECT season, status INTO v_season, v_status FROM leagues WHERE id = p_league_id;

  IF v_status = 'SEASON_END_PROCESSING' OR v_status = 'OFFSEASON' THEN
    RETURN json_build_object('success', false, 'error', 'Season already ended or processing');
  END IF;

  UPDATE leagues SET status = 'SEASON_END_PROCESSING' WHERE id = p_league_id;

  IF EXISTS (
    SELECT 1 FROM matches
    WHERE league_id = p_league_id AND season = v_season AND match_status = 'scheduled'
  ) THEN
    UPDATE leagues SET status = 'IN_SEASON' WHERE id = p_league_id;
    RETURN json_build_object('success', false, 'error', 'Not all matches have been simulated');
  END IF;

  -- Step 3: Prize money + HOF points (competition-based when team_competition_results exists)
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

    -- HOF: competition-based if team_competition_results exists, else position-based
    SELECT stage INTO v_comp_stage
    FROM team_competition_results
    WHERE team_id = v_team.team_id AND league_id = p_league_id AND season = v_season;

    IF v_comp_stage IS NOT NULL THEN
      v_hof_points := get_hof_points_for_stage(v_comp_stage);
    ELSE
      v_hof_points := GREATEST(10, 100 - (v_position - 1) * 20);
    END IF;

    INSERT INTO hall_of_fame (league_id, team_id, season, position, hof_points)
    VALUES (p_league_id, v_team.team_id, v_season, v_position, v_hof_points)
    ON CONFLICT (league_id, team_id, season) DO UPDATE SET position = v_position, hof_points = v_hof_points;
  END LOOP;

  -- Step 4: Sponsor bonuses (unchanged from 062)
  FOR v_team IN
    SELECT t.id as team_id, t.sponsor_id, s.base_payment, s.bonus_amount, s.bonus_condition
    FROM teams t
    LEFT JOIN sponsors s ON t.sponsor_id = s.id
    WHERE t.league_id = p_league_id AND t.sponsor_id IS NOT NULL AND s.id IS NOT NULL
  LOOP
    PERFORM write_finance_entry(
      v_team.team_id, p_league_id, v_team.base_payment,
      'Sponsor Payment', 'Sponsor base payment season ' || v_season,
      v_season
    );
    v_sponsor_total := v_sponsor_total + v_team.base_payment;

    IF v_team.bonus_amount IS NOT NULL AND v_team.bonus_amount > 0 AND v_team.bonus_condition IS NOT NULL THEN
      SELECT pos INTO v_team_position FROM (
        SELECT team_id, ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) as pos
        FROM standings WHERE league_id = p_league_id AND season = v_season
      ) sub WHERE team_id = v_team.team_id;

      IF v_team.bonus_condition ILIKE '%position%4%' OR v_team.bonus_condition ILIKE '%top%4%' THEN
        IF v_team_position <= 4 THEN
          PERFORM write_finance_entry(
            v_team.team_id, p_league_id, v_team.bonus_amount,
            'Sponsor Bonus', 'Top 4 finish bonus season ' || v_season,
            v_season
          );
          v_sponsor_total := v_sponsor_total + v_team.bonus_amount;
        END IF;
      ELSIF v_team.bonus_condition ILIKE '%champion%' OR v_team.bonus_condition ILIKE '%1%' THEN
        IF v_team_position = 1 THEN
          PERFORM write_finance_entry(
            v_team.team_id, p_league_id, v_team.bonus_amount,
            'Sponsor Bonus', 'Champion bonus season ' || v_season,
            v_season
          );
          v_sponsor_total := v_sponsor_total + v_team.bonus_amount;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Step 5: Trade objectives
  FOR v_obj IN
    SELECT o.id, o.from_team_id, o.to_team_id, o.reward_amount, o.trigger_condition, o.description
    FROM objectives o
    JOIN trades tr ON o.trade_id = tr.id
    WHERE tr.league_id = p_league_id AND o.fulfilled = false
      AND (tr.season IS NULL OR tr.season = v_season)
  LOOP
    v_team_position := NULL;
    IF v_obj.from_team_id IS NOT NULL THEN
      SELECT pos INTO v_team_position FROM (
        SELECT team_id, ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) as pos
        FROM standings WHERE league_id = p_league_id AND season = v_season
      ) sub WHERE team_id = v_obj.from_team_id;
    END IF;

    IF v_obj.trigger_condition ILIKE '%position%4%' AND v_team_position IS NOT NULL AND v_team_position <= 4 THEN
      PERFORM write_finance_entry(v_obj.from_team_id, p_league_id, -v_obj.reward_amount,
        'Trade Objective', v_obj.description, v_season);
      PERFORM write_finance_entry(v_obj.to_team_id, p_league_id, v_obj.reward_amount,
        'Trade Objective', v_obj.description, v_season);
      UPDATE objectives SET fulfilled = true WHERE id = v_obj.id;
    ELSIF v_obj.trigger_condition ILIKE '%champion%' AND v_team_position = 1 THEN
      PERFORM write_finance_entry(v_obj.from_team_id, p_league_id, -v_obj.reward_amount,
        'Trade Objective', v_obj.description, v_season);
      PERFORM write_finance_entry(v_obj.to_team_id, p_league_id, v_obj.reward_amount,
        'Trade Objective', v_obj.description, v_season);
      UPDATE objectives SET fulfilled = true WHERE id = v_obj.id;
    ELSE
      UPDATE objectives SET fulfilled = false WHERE id = v_obj.id;
    END IF;
  END LOOP;

  -- Step 6-7: Contract years, expire, release
  UPDATE contracts SET years = COALESCE(years, 1) - 1
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND status = 'active';

  UPDATE contracts SET status = 'expired'
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND status = 'active' AND years <= 0;

  UPDATE league_players SET team_id = NULL
  WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
    AND player_id IN (
      SELECT player_id FROM contracts
      WHERE team_id IN (SELECT id FROM teams WHERE league_id = p_league_id)
        AND status = 'expired'
    );

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Step 8: Wage payment
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

  -- Step 9: CompIndex = top 14 OVR average only
  UPDATE teams t SET comp_index = (
    SELECT COALESCE(AVG(sub.r), 0)
    FROM (
      SELECT lp.rating as r
      FROM league_players lp
      WHERE lp.team_id = t.id
      ORDER BY lp.rating DESC
      LIMIT 14
    ) sub
  ) WHERE t.league_id = p_league_id;

  -- Step 10-11: Increment season, set OFFSEASON
  UPDATE leagues SET
    season = season + 1,
    active_season = COALESCE(active_season, season) + 1,
    current_round = 0,
    status = 'OFFSEASON'
  WHERE id = p_league_id;

  PERFORM write_audit_log(p_league_id, 'end_season', NULL,
    json_build_object(
      'season', v_season,
      'prizes_distributed', v_prize_total,
      'sponsor_total', v_sponsor_total,
      'wages_deducted', v_wage_total,
      'contracts_expired', v_expired_count
    )::jsonb);

  RETURN json_build_object(
    'success', true,
    'season_ended', v_season,
    'prizes_distributed', v_prize_total,
    'sponsor_total', v_sponsor_total,
    'wages_deducted', v_wage_total,
    'contracts_expired', v_expired_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
