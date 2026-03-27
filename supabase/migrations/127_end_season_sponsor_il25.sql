-- 127: Rewrite end_season sponsor block for IL25 - sponsor_season_terms, performance tiers, TR by rank
-- Contract: sponsor_contract_ends_season (S2-S4: 4; S5-S6: 6; S7-S8: 8; S9-S10: 10)
-- Term lookup: sponsor_season_terms; fallback to sponsors for custom
-- Performance-tier: lookup sponsor_payout_tiers by competition + stage
-- TR by rank: OFFSET (rank-1) LIMIT count
-- Merch penalty alternate: if merch < 2.5% to lose, use cash penalty 2.5% * merch_rev * 3

CREATE OR REPLACE FUNCTION get_sponsor_stage_pattern(p_stage TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_stage IS NULL THEN RETURN NULL; END IF;
  IF p_stage ILIKE '%Winner%' THEN RETURN 'winner'; END IF;
  IF p_stage ILIKE '%Finalist%' THEN RETURN 'finalist'; END IF;
  IF p_stage ILIKE '%Semi%' THEN RETURN 'semi'; END IF;
  IF p_stage ILIKE '%Group%' THEN RETURN 'group'; END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
  v_term RECORD;
  v_tier RECORD;
  v_bonus_met BOOLEAN;
  v_player RECORD;
  v_count INTEGER;
  v_tcr RECORD;
  v_comp TEXT;
  v_amt INTEGER;
  v_winner_id UUID;
  v_sc_prize INTEGER;
  v_stage_pattern TEXT;
  v_payout_amt INTEGER;
  v_tr_rank INTEGER;
  v_tr_count INTEGER;
  v_merch_penalty INTEGER;
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

  PERFORM auto_assign_competition_stages(p_league_id, v_season);

  -- Domestic prize money + HOF
  FOR v_team IN
    SELECT team_id FROM standings
    WHERE league_id = p_league_id AND season = v_season
    ORDER BY points DESC, goal_diff DESC, goals_for DESC
  LOOP
    v_position := v_position + 1;

    IF v_season >= 2 THEN
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
    END IF;

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

  IF v_season >= 2 THEN
    -- Competition prize money (UCL/UEL/UECL)
    FOR v_tcr IN
      SELECT team_id, stage FROM team_competition_results
      WHERE league_id = p_league_id AND season = v_season
    LOOP
      IF v_tcr.stage IS NULL THEN CONTINUE; END IF;

      v_comp := LOWER(SPLIT_PART(v_tcr.stage, ' ', 1));
      IF v_comp NOT IN ('ucl', 'uel', 'uecl') THEN CONTINUE; END IF;

      v_amt := get_competition_prize(v_season, v_comp, 'start');
      IF v_amt > 0 THEN
        PERFORM write_finance_entry(
          v_tcr.team_id, p_league_id, v_amt,
          'Prize Money', 'Season ' || v_season || ' ' || UPPER(v_comp) || ' starting bonus',
          v_season
        );
        v_prize_total := v_prize_total + v_amt;
      END IF;

      v_amt := get_competition_prize(v_season, v_comp, 'stage');
      IF v_amt > 0 THEN
        IF v_tcr.stage LIKE '% Semi-Finalist' OR v_tcr.stage LIKE '% Finalist' OR v_tcr.stage LIKE '% Winners' THEN
          PERFORM write_finance_entry(
            v_tcr.team_id, p_league_id, v_amt,
            'Prize Money', 'Season ' || v_season || ' ' || UPPER(v_comp) || ' semi-finals',
            v_season
          );
          v_prize_total := v_prize_total + v_amt;
        END IF;
        IF v_tcr.stage LIKE '% Finalist' OR v_tcr.stage LIKE '% Winners' THEN
          PERFORM write_finance_entry(
            v_tcr.team_id, p_league_id, v_amt,
            'Prize Money', 'Season ' || v_season || ' ' || UPPER(v_comp) || ' final',
            v_season
          );
          v_prize_total := v_prize_total + v_amt;
        END IF;
        IF v_tcr.stage LIKE '% Winners' THEN
          PERFORM write_finance_entry(
            v_tcr.team_id, p_league_id, v_amt,
            'Prize Money', 'Season ' || v_season || ' ' || UPPER(v_comp) || ' winner',
            v_season
          );
          v_prize_total := v_prize_total + v_amt;
        END IF;
      END IF;
    END LOOP;

    -- Super Cup winner
    v_sc_prize := get_competition_prize(v_season, 'ucl', 'supercup');
    IF v_sc_prize > 0 THEN
      SELECT CASE WHEN home_score > away_score THEN home_team_id ELSE away_team_id END INTO v_winner_id
      FROM matches
      WHERE league_id = p_league_id AND season = v_season
        AND competition_type = 'supercup' AND match_status = 'simulated'
      LIMIT 1;
      IF v_winner_id IS NOT NULL THEN
        PERFORM write_finance_entry(
          v_winner_id, p_league_id, v_sc_prize,
          'Prize Money', 'Season ' || v_season || ' Super Cup winner',
          v_season
        );
        v_prize_total := v_prize_total + v_sc_prize;
      END IF;
    END IF;
  END IF;

  -- Sponsor payments: IL25 - sponsor_season_terms, sponsor_contract_ends_season, performance tiers
  IF v_season >= 2 THEN
    FOR v_team IN
      SELECT t.id as team_id, t.sponsor_id, t.sponsor_signed_at_season, t.sponsor_contract_ends_season, t.merch_percentage
      FROM teams t
      WHERE t.league_id = p_league_id AND t.sponsor_id IS NOT NULL
    LOOP
      -- Contract validity: new (sponsor_contract_ends_season) or legacy (sponsor_signed_at_season + 1)
      IF v_team.sponsor_contract_ends_season IS NOT NULL AND v_season > v_team.sponsor_contract_ends_season THEN
        UPDATE teams SET sponsor_id = NULL, sponsor_signed_at_season = NULL, sponsor_contract_ends_season = NULL WHERE id = v_team.team_id;
        CONTINUE;
      END IF;
      IF v_team.sponsor_contract_ends_season IS NULL AND v_team.sponsor_signed_at_season IS NOT NULL AND v_season > v_team.sponsor_signed_at_season + 1 THEN
        UPDATE teams SET sponsor_id = NULL, sponsor_signed_at_season = NULL WHERE id = v_team.team_id;
        CONTINUE;
      END IF;

      -- Term lookup: sponsor_season_terms first, else sponsors (custom)
      SELECT sst.base_payment, sst.bonus_amount, sst.bonus_condition_code, sst.bonus_merch_pct,
             COALESCE(sst.transfer_request_count, 0) as tr_count,
             COALESCE(sst.transfer_request_rank, 1) as tr_rank,
             COALESCE(sst.merch_modifier, 0) as merch_mod,
             COALESCE(sst.repayment_penalty, 0) as repay,
             sst.payout_type
      INTO v_term
      FROM sponsor_season_terms sst
      WHERE sst.sponsor_id = v_team.sponsor_id AND sst.season = v_season;

      IF v_term IS NULL THEN
        SELECT s.base_payment, s.bonus_amount, s.bonus_condition as bonus_condition_code, NULL::numeric as bonus_merch_pct,
               COALESCE(s.transfer_request_count, 0) as tr_count, 1 as tr_rank,
               COALESCE(s.merch_modifier, 0) as merch_mod,
               COALESCE(s.repayment_penalty, 0) as repay,
               'fixed'::text as payout_type
        INTO v_term
        FROM sponsors s WHERE s.id = v_team.sponsor_id;
      END IF;

      IF v_term IS NULL THEN CONTINUE; END IF;

      -- Check if still in contract (legacy: sponsor_signed_at_season + 1; new: <= sponsor_contract_ends_season)
      IF v_team.sponsor_contract_ends_season IS NOT NULL AND v_season > v_team.sponsor_contract_ends_season THEN CONTINUE; END IF;
      IF v_team.sponsor_contract_ends_season IS NULL AND v_team.sponsor_signed_at_season IS NOT NULL AND v_season > v_team.sponsor_signed_at_season + 1 THEN CONTINUE; END IF;

      IF v_term.payout_type = 'performance_tier' THEN
        -- Performance-based: get stage, match tier, pay amount, apply TR/merch
        SELECT stage INTO v_comp_stage FROM team_competition_results
        WHERE league_id = p_league_id AND team_id = v_team.team_id AND season = v_season LIMIT 1;

        v_stage_pattern := get_sponsor_stage_pattern(v_comp_stage);
        v_comp := NULL;
        IF v_comp_stage IS NOT NULL THEN
          v_comp := LOWER(SPLIT_PART(v_comp_stage, ' ', 1));
          IF v_comp NOT IN ('ucl', 'uel', 'uecl') THEN v_comp := NULL; END IF;
        END IF;

        IF v_comp IS NOT NULL AND v_stage_pattern IS NOT NULL THEN
          SELECT spt.payout_amount, spt.merch_modifier, spt.transfer_request_count, spt.transfer_request_rank
          INTO v_tier
          FROM sponsor_payout_tiers spt
          JOIN sponsor_season_terms sst ON sst.id = spt.sponsor_season_term_id
          WHERE sst.sponsor_id = v_team.sponsor_id AND sst.season = v_season
            AND spt.competition = v_comp AND spt.stage_pattern = v_stage_pattern
          LIMIT 1;

          IF v_tier IS NOT NULL THEN
            v_payout_amt := v_tier.payout_amount + v_term.base_payment;
            IF v_payout_amt > 0 THEN
              PERFORM write_finance_entry(
                v_team.team_id, p_league_id, v_payout_amt,
                'Sponsor Payment', 'Sponsor performance payout season ' || v_season,
                v_season
              );
              v_sponsor_total := v_sponsor_total + v_payout_amt;
            END IF;
            IF v_tier.merch_modifier != 0 THEN
              UPDATE teams SET merch_percentage = COALESCE(merch_percentage, 0) + v_tier.merch_modifier
              WHERE id = v_team.team_id;
            END IF;
            v_tr_count := COALESCE(v_tier.transfer_request_count, 0);
            v_tr_rank := COALESCE(v_tier.transfer_request_rank, 1);
            IF v_tr_count > 0 THEN
              v_count := 0;
              FOR v_player IN
                SELECT id FROM league_players
                WHERE team_id = v_team.team_id
                ORDER BY rating DESC NULLS LAST, id ASC
                OFFSET (v_tr_rank - 1)
                LIMIT v_tr_count
              LOOP
                UPDATE league_players SET transfer_request = true WHERE id = v_player.id;
                v_count := v_count + 1;
              END LOOP;
            END IF;
          ELSE
            -- No tier match (e.g. no competition) - use base only for Spotify S6/S8
            IF v_term.base_payment > 0 THEN
              PERFORM write_finance_entry(
                v_team.team_id, p_league_id, v_term.base_payment,
                'Sponsor Payment', 'Sponsor base payment season ' || v_season,
                v_season
              );
              v_sponsor_total := v_sponsor_total + v_term.base_payment;
            END IF;
          END IF;
        ELSE
          IF v_term.base_payment > 0 THEN
            PERFORM write_finance_entry(
              v_team.team_id, p_league_id, v_term.base_payment,
              'Sponsor Payment', 'Sponsor base payment season ' || v_season,
              v_season
            );
            v_sponsor_total := v_sponsor_total + v_term.base_payment;
          END IF;
        END IF;
      ELSE
        -- Fixed payout
        PERFORM write_finance_entry(
          v_team.team_id, p_league_id, v_term.base_payment,
          'Sponsor Payment', 'Sponsor base payment season ' || v_season,
          v_season
        );
        v_sponsor_total := v_sponsor_total + v_term.base_payment;

        v_bonus_met := false;
        IF v_term.bonus_amount IS NOT NULL AND v_term.bonus_amount > 0 AND v_term.bonus_condition_code IS NOT NULL THEN
          IF eval_sponsor_bonus(v_team.team_id, p_league_id, v_season, v_term.bonus_condition_code) THEN
            v_bonus_met := true;
            PERFORM write_finance_entry(
              v_team.team_id, p_league_id, v_term.bonus_amount,
              'Sponsor Bonus', 'Sponsor bonus season ' || v_season,
              v_season
            );
            v_sponsor_total := v_sponsor_total + v_term.bonus_amount;
          END IF;
        END IF;
        IF v_term.bonus_merch_pct IS NOT NULL AND v_term.bonus_merch_pct > 0 AND v_bonus_met THEN
          UPDATE teams SET merch_percentage = COALESCE(merch_percentage, 0) + v_term.bonus_merch_pct
          WHERE id = v_team.team_id;
        END IF;

        IF NOT v_bonus_met AND (v_term.tr_count > 0 OR v_term.merch_mod != 0 OR v_term.repay > 0) THEN
          IF v_term.tr_count > 0 THEN
            v_count := 0;
            FOR v_player IN
              SELECT id FROM league_players
              WHERE team_id = v_team.team_id
              ORDER BY rating DESC NULLS LAST, id ASC
              OFFSET (v_term.tr_rank - 1)
              LIMIT v_term.tr_count
            LOOP
              UPDATE league_players SET transfer_request = true WHERE id = v_player.id;
              v_count := v_count + 1;
            END LOOP;
          END IF;
          IF v_term.merch_mod != 0 THEN
            IF v_term.merch_mod < 0 AND COALESCE(v_team.merch_percentage, 0) < 2.5 THEN
              v_merch_pct := 30 + COALESCE(v_team.merch_percentage, 0);
              v_merch_rev := compute_team_merch_revenue(v_team.team_id, v_merch_pct);
              v_merch_penalty := (v_merch_rev * 0.025 * 3)::INTEGER;
              IF v_merch_penalty > 0 THEN
                PERFORM write_finance_entry(
                  v_team.team_id, p_league_id, -v_merch_penalty,
                  'Sponsor Failure', 'Merch penalty alternate (2.5% * 3) season ' || v_season,
                  v_season
                );
              END IF;
            ELSE
              UPDATE teams SET merch_percentage = COALESCE(merch_percentage, 0) + v_term.merch_mod
              WHERE id = v_team.team_id;
            END IF;
          END IF;
          IF v_term.repay > 0 THEN
            PERFORM write_finance_entry(
              v_team.team_id, p_league_id, -v_term.repay,
              'Sponsor Failure', 'Repayment penalty season ' || v_season,
              v_season
            );
          END IF;
        END IF;
      END IF;

      -- Clear sponsor when contract ends
      IF v_team.sponsor_contract_ends_season IS NOT NULL AND v_season = v_team.sponsor_contract_ends_season THEN
        UPDATE teams SET sponsor_id = NULL, sponsor_signed_at_season = NULL, sponsor_contract_ends_season = NULL WHERE id = v_team.team_id;
      ELSIF v_team.sponsor_contract_ends_season IS NULL AND v_team.sponsor_signed_at_season IS NOT NULL AND v_season = v_team.sponsor_signed_at_season + 1 THEN
        UPDATE teams SET sponsor_id = NULL, sponsor_signed_at_season = NULL WHERE id = v_team.team_id;
      END IF;
    END LOOP;
  END IF;

  -- Trade objectives
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

  UPDATE leagues SET
    season = season + 1,
    active_season = COALESCE(active_season, season) + 1,
    current_round = 0,
    current_round_ucl = 0,
    current_round_uel = 0,
    current_round_uecl = 0,
    fa_pool_status = 'draft',
    status = 'OFFSEASON'
  WHERE id = p_league_id;

  PERFORM write_audit_log(p_league_id, 'end_season', NULL,
    json_build_object(
      'season', v_season,
      'prizes_distributed', v_prize_total,
      'sponsor_total', v_sponsor_total,
      'wages_deducted', v_wage_total,
      'merch_total', v_merch_total,
      'contracts_expired', v_expired_count
    )::jsonb);

  RETURN json_build_object(
    'success', true,
    'season_ended', v_season,
    'prizes_distributed', v_prize_total,
    'sponsor_total', v_sponsor_total,
    'wages_deducted', v_wage_total,
    'merch_total', v_merch_total,
    'contracts_expired', v_expired_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
