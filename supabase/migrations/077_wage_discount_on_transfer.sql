-- 077: Wage discount on transfer (moderator rule)
-- Packed/drafted = 20% at original club; on transfer drops to 10%

COMMENT ON COLUMN contracts.wage_discount_percent IS 'Discount %: drafted=20, packed=20 at original club; on transfer both drop to 10';

-- Update execute_trade: when moving a player contract, if wage_discount_percent=20 set to 10
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
      -- Move contract: when wage_discount_percent=20 (drafted/packed), drop to 10 on transfer
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

-- Update resolve_free_agency: FA signings get wage_discount_percent=10 when player was previously drafted/packed (on transfer)
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
    SELECT b.id, b.team_id, b.bonus, b.salary, b.years, COALESCE(b.guaranteed_pct, 1)
    INTO v_winner_bid_id, v_winner_team_id, v_winner_bonus, v_winner_salary, v_winner_years, v_winner_guaranteed_pct
    FROM free_agent_bids b
    WHERE b.league_id = p_league_id AND b.player_id = v_fa.player_id
      AND b.season = v_season AND b.status = 'pending'
    ORDER BY
      free_agent_points_value(b.salary::numeric * b.years, COALESCE(b.guaranteed_pct, 1), b.years) DESC,
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

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status, wage_discount_percent)
    VALUES (v_fa.player_id, v_winner_team_id, v_winner_salary, v_season, v_winner_years, 'active', v_wage_discount)
    ON CONFLICT (team_id, player_id) DO UPDATE SET
      wage = v_winner_salary,
      start_season = v_season,
      years = v_winner_years,
      status = 'active',
      wage_discount_percent = v_wage_discount;

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
