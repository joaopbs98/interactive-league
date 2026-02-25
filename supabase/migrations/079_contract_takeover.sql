-- 079: Contract takeover on trades (moderator rule)
-- When buying club takes X% of contract (10% increments): new wage = original × X%, seller penalty = original × (1-X)

ALTER TABLE trade_items ADD COLUMN IF NOT EXISTS contract_takeover_pct INTEGER DEFAULT 100;
COMMENT ON COLUMN trade_items.contract_takeover_pct IS '100=full contract; 10-90 in 10% steps = buying club takes that % of wage, seller penalty reduced';

-- Update execute_trade to apply contract takeover
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
  v_takeover_pct INTEGER;
  v_new_wage INTEGER;
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
      v_takeover_pct := COALESCE(v_item.contract_takeover_pct, 100);
      IF v_takeover_pct < 10 OR v_takeover_pct > 100 OR (v_takeover_pct % 10) != 0 THEN
        v_takeover_pct := 100;
      END IF;

      SELECT c.wage, c.years, c.guaranteed_pct INTO v_contract
      FROM contracts c
      WHERE c.player_id = v_item.player_id AND c.team_id = v_trade.from_team_id AND c.status = 'active';

      v_penalty := 0;
      IF v_contract IS NOT NULL THEN
        v_penalty := (GREATEST(0, COALESCE(v_contract.years, 1)) * COALESCE(v_contract.wage, 0) * COALESCE(v_contract.guaranteed_pct, 1))::INTEGER;
        v_penalty := (v_penalty * (100 - v_takeover_pct) / 100)::INTEGER;
        IF v_penalty > 0 THEN
          PERFORM write_finance_entry(
            v_trade.from_team_id, v_league_id, -v_penalty,
            'Trade Penalty', 'Contract buyout for traded player: ' || v_item.player_id || ' (takeover ' || v_takeover_pct || '%)',
            COALESCE(v_season, 1)
          );
        END IF;
      END IF;

      v_new_wage := COALESCE(v_contract.wage, 0);
      IF v_takeover_pct < 100 AND v_contract IS NOT NULL THEN
        v_new_wage := (v_new_wage * v_takeover_pct / 100)::INTEGER;
      END IF;

      UPDATE contracts SET
        team_id = v_trade.to_team_id,
        wage = GREATEST(v_new_wage, 500000),
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
