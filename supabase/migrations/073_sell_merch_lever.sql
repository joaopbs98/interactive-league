-- 073: Sell future merch % for immediate payout (10% transaction cost) - Barcelona "lever"
-- Teams can sell merch_percentage (draft bonus) for cash. Base 30% cannot be sold.

-- Update end_season: store merch_base_revenue when paying (for lever valuation)
-- We need to modify the Step 8b loop to also UPDATE teams.merch_base_revenue
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
  v_merch_total INTEGER := 0;
  v_merch_rev INTEGER;
  v_merch_pct NUMERIC;
  v_obj RECORD;
  v_team_position INTEGER;
  v_hof_points INTEGER;
  v_comp_stage TEXT;
  v_sponsor RECORD;
  v_bonus_met BOOLEAN;
  v_player RECORD;
  v_count INTEGER;
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

  -- Step 3: Prize money + HOF points
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

  -- Step 4: Sponsor bonuses + failure penalties
  FOR v_team IN
    SELECT t.id as team_id, t.sponsor_id, t.merch_percentage
    FROM teams t
    WHERE t.league_id = p_league_id AND t.sponsor_id IS NOT NULL
  LOOP
    SELECT s.base_payment, s.bonus_amount, s.bonus_condition,
           COALESCE(s.transfer_request_count, 0) as tr_count,
           COALESCE(s.merch_modifier, 0) as merch_mod,
           COALESCE(s.repayment_penalty, 0) as repay
    INTO v_sponsor
    FROM sponsors s WHERE s.id = v_team.sponsor_id;

    IF v_sponsor IS NULL THEN CONTINUE; END IF;

    PERFORM write_finance_entry(
      v_team.team_id, p_league_id, v_sponsor.base_payment,
      'Sponsor Payment', 'Sponsor base payment season ' || v_season,
      v_season
    );
    v_sponsor_total := v_sponsor_total + v_sponsor.base_payment;

    v_bonus_met := false;
    IF v_sponsor.bonus_amount IS NOT NULL AND v_sponsor.bonus_amount > 0 AND v_sponsor.bonus_condition IS NOT NULL THEN
      SELECT pos INTO v_team_position FROM (
        SELECT team_id, ROW_NUMBER() OVER (ORDER BY points DESC, goal_diff DESC, goals_for DESC) as pos
        FROM standings WHERE league_id = p_league_id AND season = v_season
      ) sub WHERE team_id = v_team.team_id;

      IF v_sponsor.bonus_condition ILIKE '%position%4%' OR v_sponsor.bonus_condition ILIKE '%top%4%' THEN
        IF v_team_position <= 4 THEN
          v_bonus_met := true;
          PERFORM write_finance_entry(
            v_team.team_id, p_league_id, v_sponsor.bonus_amount,
            'Sponsor Bonus', 'Top 4 finish bonus season ' || v_season,
            v_season
          );
          v_sponsor_total := v_sponsor_total + v_sponsor.bonus_amount;
        END IF;
      ELSIF v_sponsor.bonus_condition ILIKE '%champion%' OR v_sponsor.bonus_condition ILIKE '%1%' THEN
        IF v_team_position = 1 THEN
          v_bonus_met := true;
          PERFORM write_finance_entry(
            v_team.team_id, p_league_id, v_sponsor.bonus_amount,
            'Sponsor Bonus', 'Champion bonus season ' || v_season,
            v_season
          );
          v_sponsor_total := v_sponsor_total + v_sponsor.bonus_amount;
        END IF;
      END IF;
    END IF;

    IF NOT v_bonus_met AND (v_sponsor.tr_count > 0 OR v_sponsor.merch_mod != 0 OR v_sponsor.repay > 0) THEN
      IF v_sponsor.tr_count > 0 THEN
        v_count := 0;
        FOR v_player IN
          SELECT id FROM league_players
          WHERE team_id = v_team.team_id
          ORDER BY rating DESC NULLS LAST
          LIMIT v_sponsor.tr_count
        LOOP
          UPDATE league_players SET transfer_request = true WHERE id = v_player.id;
          v_count := v_count + 1;
        END LOOP;
      END IF;
      IF v_sponsor.merch_mod != 0 THEN
        UPDATE teams SET merch_percentage = COALESCE(merch_percentage, 0) + v_sponsor.merch_mod
        WHERE id = v_team.team_id;
      END IF;
      IF v_sponsor.repay > 0 THEN
        PERFORM write_finance_entry(
          v_team.team_id, p_league_id, -v_sponsor.repay,
          'Sponsor Failure', 'Repayment penalty season ' || v_season,
          v_season
        );
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

  -- Step 8b: Merchandise revenue (top 14, IR+position, 30% base + draft merch_pct)
  FOR v_team IN
    SELECT t.id as team_id, t.merch_percentage
    FROM teams t WHERE t.league_id = p_league_id
  LOOP
    v_merch_pct := 30 + COALESCE(v_team.merch_percentage, 0);
    v_merch_rev := compute_team_merch_revenue(v_team.team_id, v_merch_pct);
    IF v_merch_rev > 0 THEN
      PERFORM write_finance_entry(
        v_team.team_id, p_league_id, v_merch_rev,
        'Merchandise', 'Season ' || v_season || ' merchandise revenue (top 14)',
        v_season
      );
      v_merch_total := v_merch_total + v_merch_rev;
      UPDATE teams SET merch_base_revenue = v_merch_rev WHERE id = v_team.team_id;
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
      'merch_total', v_merch_total,
      'wages_deducted', v_wage_total,
      'contracts_expired', v_expired_count
    )::jsonb);

  RETURN json_build_object(
    'success', true,
    'season_ended', v_season,
    'prizes_distributed', v_prize_total,
    'sponsor_total', v_sponsor_total,
    'merch_total', v_merch_total,
    'wages_deducted', v_wage_total,
    'contracts_expired', v_expired_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Sell future merch % for immediate payout (10% transaction cost)
CREATE OR REPLACE FUNCTION sell_merch_percentage(
  p_team_id UUID,
  p_pct_to_sell NUMERIC,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_team RECORD;
  v_effective_pct NUMERIC;
  v_base_revenue INTEGER;
  v_estimated INTEGER;
  v_value NUMERIC;
  v_payout INTEGER;
  v_league_id UUID;
  v_season INTEGER;
BEGIN
  SELECT t.id, t.user_id, t.merch_percentage, t.merch_base_revenue, t.league_id
  INTO v_team
  FROM teams t WHERE t.id = p_team_id;

  IF v_team IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  IF v_team.user_id != p_actor_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Not your team');
  END IF;

  IF p_pct_to_sell IS NULL OR p_pct_to_sell <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid percentage');
  END IF;

  v_effective_pct := 30 + COALESCE(v_team.merch_percentage, 0);
  IF p_pct_to_sell > COALESCE(v_team.merch_percentage, 0) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot sell more than your draft merch bonus. Base 30% cannot be sold.');
  END IF;

  v_base_revenue := COALESCE(v_team.merch_base_revenue, 0);
  IF v_base_revenue <= 0 THEN
    v_estimated := compute_team_merch_revenue(p_team_id, v_effective_pct);
    v_base_revenue := v_estimated;
  END IF;

  IF v_base_revenue <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'No merchandise revenue to sell. Need at least one season of merch payouts or a squad.');
  END IF;

  v_value := v_base_revenue * (p_pct_to_sell / v_effective_pct);
  v_payout := (v_value * 0.9)::INTEGER;

  IF v_payout <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Payout too small');
  END IF;

  SELECT season INTO v_season FROM leagues WHERE id = v_team.league_id;

  UPDATE teams SET merch_percentage = GREATEST(0, COALESCE(merch_percentage, 0) - p_pct_to_sell)
  WHERE id = p_team_id;

  PERFORM write_finance_entry(
    p_team_id, v_team.league_id, v_payout,
    'Merch Sale', 'Sold ' || p_pct_to_sell || '% merch for immediate payout (10% fee)',
    COALESCE(v_season, 1)
  );

  RETURN json_build_object(
    'success', true,
    'payout', v_payout,
    'pct_sold', p_pct_to_sell,
    'new_merch_pct', GREATEST(0, COALESCE(v_team.merch_percentage, 0) - p_pct_to_sell)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
