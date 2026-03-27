-- 043: Implement sponsor bonuses and trade objectives in end_season (per final_doc 6.8 steps 4-5)
-- Sponsor: base_payment + bonus_amount if bonus_condition met (e.g. position <= 4)
-- Objectives: evaluate trigger_condition, transfer funds, mark fulfilled/failed

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

  -- Step 4: Sponsor bonuses (teams with sponsor_id get base_payment + bonus if condition met)
  FOR v_team IN
    SELECT t.id as team_id, t.sponsor_id, s.base_payment, s.bonus_amount, s.bonus_condition
    FROM teams t
    LEFT JOIN sponsors s ON t.sponsor_id = s.id
    WHERE t.league_id = p_league_id AND t.sponsor_id IS NOT NULL AND s.id IS NOT NULL
  LOOP
    -- Base payment
    PERFORM write_finance_entry(
      v_team.team_id, p_league_id, v_team.base_payment,
      'Sponsor Payment', 'Sponsor base payment season ' || v_season,
      v_season
    );
    v_sponsor_total := v_sponsor_total + v_team.base_payment;

    -- Bonus if condition met (e.g. "position<=4" or "champion")
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

  -- Step 5: Trade objectives (evaluate trigger_condition, transfer funds)
  FOR v_obj IN
    SELECT o.id, o.from_team_id, o.to_team_id, o.reward_amount, o.trigger_condition, o.description
    FROM objectives o
    JOIN trades tr ON o.trade_id = tr.id
    WHERE tr.league_id = p_league_id AND o.fulfilled = false
      AND (tr.season IS NULL OR tr.season = v_season)
  LOOP
    -- Simple condition evaluation: "position<=4", "champion", "player_goals>=10"
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

  -- Step 10: Draft pool not auto-generated here (host triggers start_draft)

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
