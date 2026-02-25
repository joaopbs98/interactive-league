-- 078: FA no-trade +4% to Points Value; penalty formula on release/trade (moderator rules)
-- Penalty = Yrs.remaining × Salary × guaranteed_pct

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS guaranteed_pct NUMERIC DEFAULT 1;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS no_trade_clause BOOLEAN DEFAULT false;
COMMENT ON COLUMN contracts.guaranteed_pct IS 'Guaranteed % as decimal 0-1 for penalty: Yrs × Salary × guaranteed_pct';
COMMENT ON COLUMN contracts.no_trade_clause IS 'Copied from FA bid; affects tradeability';

-- free_agent_points_value: add +4% when no_trade_clause = true
CREATE OR REPLACE FUNCTION free_agent_points_value(
  p_value_of_contract NUMERIC,
  p_guaranteed_pct NUMERIC,
  p_years INTEGER,
  p_no_trade_clause BOOLEAN DEFAULT false
) RETURNS NUMERIC AS $$
DECLARE
  v_base NUMERIC;
  v_g NUMERIC;
  v_guaranteed_mod NUMERIC;
  v_length_mod NUMERIC;
  v_result NUMERIC;
BEGIN
  v_base := p_value_of_contract / 100000.0;
  v_g := COALESCE(p_guaranteed_pct, 1);
  IF p_years = 1 THEN v_g := 1; END IF;

  v_guaranteed_mod := 1 + 0.2 * sign(v_g - 0.25) * power(abs(v_g - 0.25), 0.5);
  IF v_g < 0.2 THEN
    v_guaranteed_mod := v_guaranteed_mod + (-30.7 * power(0.2 - v_g, 2));
  END IF;

  v_length_mod := CASE LEAST(p_years, 5)
    WHEN 1 THEN 1
    WHEN 2 THEN 0.98
    WHEN 3 THEN 0.94
    WHEN 4 THEN 0.88
    ELSE 0.8
  END;

  v_result := v_base * v_guaranteed_mod * v_length_mod;
  IF p_no_trade_clause THEN
    v_result := v_result * 1.04;
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update resolve_free_agency: use no_trade_clause in ORDER BY, copy guaranteed_pct and no_trade_clause to contracts
-- (resolve_free_agency is in 077 - we need to update the ORDER BY and the INSERT)
-- The 077 migration has the latest resolve_free_agency. We'll override it here.
CREATE OR REPLACE FUNCTION resolve_free_agency(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_season INTEGER;
  v_status TEXT;
  v_fa RECORD;
  v_winner_team_id UUID;
  v_winner_bonus INTEGER;
  v_winner_salary INTEGER;
  v_winner_years INTEGER;
  v_winner_guaranteed_pct NUMERIC;
  v_winner_no_trade BOOLEAN;
  v_winner_bid_id UUID;
  v_roster_count INTEGER;
  v_budget INTEGER;
  v_assigned INTEGER := 0;
  v_skipped INTEGER := 0;
  v_wage_discount INTEGER;
BEGIN
  SELECT season, status::TEXT INTO v_season, v_status
  FROM leagues WHERE id = p_league_id;

  IF v_status != 'OFFSEASON' THEN
    RETURN json_build_object('success', false, 'error', 'Free agency can only be resolved during OFFSEASON');
  END IF;

  FOR v_fa IN
    SELECT DISTINCT lp.player_id, lp.id as league_player_id, lp.league_id, lp.player_name, lp.rating, lp.origin_type
    FROM league_players lp
    WHERE lp.league_id = p_league_id AND lp.team_id IS NULL
      AND EXISTS (
        SELECT 1 FROM free_agent_bids b
        WHERE b.league_id = p_league_id AND b.player_id = lp.player_id
          AND b.season = v_season AND b.status = 'pending'
      )
  LOOP
    SELECT b.id, b.team_id, b.bonus, b.salary, b.years, COALESCE(b.guaranteed_pct, 1), COALESCE(b.no_trade_clause, false)
    INTO v_winner_bid_id, v_winner_team_id, v_winner_bonus, v_winner_salary, v_winner_years, v_winner_guaranteed_pct, v_winner_no_trade
    FROM free_agent_bids b
    WHERE b.league_id = p_league_id AND b.player_id = v_fa.player_id
      AND b.season = v_season AND b.status = 'pending'
    ORDER BY
      free_agent_points_value(b.salary::numeric * b.years, COALESCE(b.guaranteed_pct, 1), b.years, COALESCE(b.no_trade_clause, false)) DESC,
      b.salary DESC,
      b.years DESC,
      b.created_at ASC
    LIMIT 1;

    IF v_winner_team_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COUNT(*) INTO v_roster_count
    FROM league_players WHERE team_id = v_winner_team_id;

    SELECT budget INTO v_budget FROM teams WHERE id = v_winner_team_id;

    IF (v_roster_count >= 23) OR (COALESCE(v_budget, 0) < v_winner_bonus) THEN
      UPDATE free_agent_bids SET status = 'cancelled' WHERE id = v_winner_bid_id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_wage_discount := CASE WHEN v_fa.origin_type IN ('drafted', 'packed') THEN 10 ELSE 0 END;

    UPDATE league_players SET team_id = v_winner_team_id
    WHERE id = v_fa.league_player_id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status, wage_discount_percent, guaranteed_pct, no_trade_clause)
    VALUES (v_fa.player_id, v_winner_team_id, v_winner_salary, v_season, v_winner_years, 'active', v_wage_discount, v_winner_guaranteed_pct, v_winner_no_trade)
    ON CONFLICT (team_id, player_id) DO UPDATE SET
      wage = v_winner_salary,
      start_season = v_season,
      years = v_winner_years,
      status = 'active',
      wage_discount_percent = v_wage_discount,
      guaranteed_pct = v_winner_guaranteed_pct,
      no_trade_clause = v_winner_no_trade;

    IF v_winner_bonus > 0 THEN
      PERFORM write_finance_entry(
        v_winner_team_id, p_league_id, -v_winner_bonus,
        'Signing Bonus', 'Free agency signing: ' || COALESCE(v_fa.player_name, v_fa.player_id),
        v_season
      );
    END IF;

    UPDATE free_agent_bids SET status = 'won' WHERE id = v_winner_bid_id;
    UPDATE free_agent_bids SET status = 'lost'
    WHERE league_id = p_league_id AND player_id = v_fa.player_id AND season = v_season AND id != v_winner_bid_id;

    v_assigned := v_assigned + 1;
  END LOOP;

  PERFORM write_audit_log(p_league_id, 'resolve_free_agency', NULL,
    json_build_object('assigned', v_assigned, 'skipped', v_skipped, 'season', v_season)::jsonb);

  RETURN json_build_object('success', true, 'assigned', v_assigned, 'skipped', v_skipped);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Release player with penalty (Yrs × Salary × guaranteed_pct)
CREATE OR REPLACE FUNCTION release_player_il25(p_team_id UUID, p_player_id TEXT, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_contract RECORD;
  v_league_id UUID;
  v_season INTEGER;
  v_penalty INTEGER;
  v_years_remaining INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not your team');
  END IF;

  SELECT c.wage, c.years, c.guaranteed_pct, t.league_id
  INTO v_contract
  FROM contracts c
  JOIN teams t ON t.id = c.team_id
  WHERE c.team_id = p_team_id AND c.player_id = p_player_id AND c.status = 'active';

  IF v_contract IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No active contract for this player');
  END IF;

  v_league_id := v_contract.league_id;
  SELECT season INTO v_season FROM leagues WHERE id = v_league_id;

  v_years_remaining := GREATEST(0, COALESCE(v_contract.years, 1));
  v_penalty := (v_years_remaining * COALESCE(v_contract.wage, 0) * COALESCE(v_contract.guaranteed_pct, 1))::INTEGER;

  IF v_penalty > 0 THEN
    PERFORM write_finance_entry(
      p_team_id, v_league_id, -v_penalty,
      'Release Penalty', 'Contract buyout: ' || p_player_id,
      COALESCE(v_season, 1)
    );
  END IF;

  UPDATE contracts SET status = 'terminated' WHERE team_id = p_team_id AND player_id = p_player_id;
  UPDATE league_players SET team_id = NULL WHERE team_id = p_team_id AND player_id = p_player_id;

  UPDATE teams SET
    expendables = array_remove(COALESCE(expendables, '{}'), p_player_id),
    starting_lineup = CASE WHEN starting_lineup ? p_player_id THEN starting_lineup - p_player_id ELSE starting_lineup END
  WHERE id = p_team_id;

  RETURN json_build_object('success', true, 'penalty', v_penalty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update execute_trade: charge penalty to selling club when trading a player (Yrs × Salary × guaranteed_pct)
-- Contract takeover (task 6) will reduce this
CREATE OR REPLACE FUNCTION execute_trade(
  p_trade_id UUID,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_trade RECORD;
  v_league_id UUID;
  v_season INTEGER;
  v_item RECORD;
  v_from_count INTEGER;
  v_to_count INTEGER;
  v_players_moving INTEGER := 0;
  v_penalty INTEGER;
  v_contract RECORD;
BEGIN
  SELECT t.*, ft.league_id
  INTO v_trade
  FROM trades t
  JOIN teams ft ON t.from_team_id = ft.id
  WHERE t.id = p_trade_id
  FOR UPDATE;

  IF v_trade IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF v_trade.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Trade already processed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM teams WHERE id = v_trade.to_team_id AND user_id = p_actor_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to accept this trade');
  END IF;

  v_league_id := v_trade.league_id;
  IF v_league_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Trade teams must be in a league');
  END IF;
  SELECT season INTO v_season FROM leagues WHERE id = v_league_id;

  IF EXISTS (SELECT 1 FROM leagues WHERE id = v_league_id AND status = 'IN_SEASON') THEN
    RETURN json_build_object('success', false, 'error', 'Trades not allowed during season');
  END IF;

  SELECT COUNT(*) INTO v_players_moving
  FROM trade_items
  WHERE trade_id = p_trade_id AND item_type = 'player' AND player_id IS NOT NULL;

  SELECT COUNT(*) INTO v_from_count
  FROM league_players WHERE team_id = v_trade.from_team_id;

  SELECT COUNT(*) INTO v_to_count
  FROM league_players WHERE team_id = v_trade.to_team_id;

  IF v_from_count < v_players_moving THEN
    RETURN json_build_object('success', false, 'error', 'Proposer does not have enough players');
  END IF;

  IF v_to_count + v_players_moving > 23 THEN
    RETURN json_build_object('success', false, 'error', 'Trade would exceed roster cap (23 max)');
  END IF;

  FOR v_item IN
    SELECT * FROM trade_items WHERE trade_id = p_trade_id AND item_type = 'draft_pick' AND draft_pick_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM draft_picks
      WHERE id = v_item.draft_pick_id
        AND COALESCE(current_owner_team_id, team_id) = v_trade.from_team_id
        AND is_used = false
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Invalid draft pick: not owned by proposer or already used');
    END IF;
  END LOOP;

  UPDATE trades SET status = 'accepted', responded_at = NOW() WHERE id = p_trade_id;

  FOR v_item IN
    SELECT * FROM trade_items WHERE trade_id = p_trade_id
  LOOP
    IF v_item.item_type = 'player' AND v_item.player_id IS NOT NULL THEN
      SELECT c.wage, c.years, c.guaranteed_pct INTO v_contract
      FROM contracts c
      WHERE c.player_id = v_item.player_id AND c.team_id = v_trade.from_team_id AND c.status = 'active';

      v_penalty := 0;
      IF v_contract IS NOT NULL THEN
        v_penalty := (GREATEST(0, COALESCE(v_contract.years, 1)) * COALESCE(v_contract.wage, 0) * COALESCE(v_contract.guaranteed_pct, 1))::INTEGER;
        IF v_penalty > 0 THEN
          PERFORM write_finance_entry(
            v_trade.from_team_id, v_league_id, -v_penalty,
            'Trade Penalty', 'Contract buyout for traded player: ' || v_item.player_id,
            COALESCE(v_season, 1)
          );
        END IF;
      END IF;

      UPDATE contracts SET
        team_id = v_trade.to_team_id,
        wage_discount_percent = CASE WHEN COALESCE(wage_discount_percent, 0) = 20 THEN 10 ELSE wage_discount_percent END
      WHERE player_id = v_item.player_id AND team_id = v_trade.from_team_id;

      UPDATE league_players SET team_id = v_trade.to_team_id
      WHERE league_id = v_league_id AND player_id = v_item.player_id AND team_id = v_trade.from_team_id;
    ELSIF v_item.item_type = 'draft_pick' AND v_item.draft_pick_id IS NOT NULL THEN
      UPDATE draft_picks SET current_owner_team_id = v_trade.to_team_id
      WHERE id = v_item.draft_pick_id;
    ELSIF v_item.item_type = 'money' AND v_item.amount IS NOT NULL AND v_item.amount > 0 THEN
      PERFORM write_finance_entry(
        v_trade.from_team_id, v_league_id, -v_item.amount,
        'Trade', 'Outgoing trade payment',
        COALESCE(v_season, 1)
      );
      PERFORM write_finance_entry(
        v_trade.to_team_id, v_league_id, v_item.amount,
        'Trade', 'Incoming trade payment',
        COALESCE(v_season, 1)
      );
    END IF;
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
