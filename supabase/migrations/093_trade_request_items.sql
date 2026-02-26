-- 093: Add 'request' item type for trade - request players from the other team
-- When item_type = 'request', player moves from to_team to from_team on accept

ALTER TABLE trade_items DROP CONSTRAINT IF EXISTS trade_items_item_type_check;
ALTER TABLE trade_items ADD CONSTRAINT trade_items_item_type_check
  CHECK (item_type IN ('player', 'money', 'objective', 'draft_pick', 'request'));

-- Update execute_trade to handle request items (player from to_team -> from_team)
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
  v_players_to_count INTEGER := 0;
  v_players_from_count INTEGER := 0;
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

  SELECT COUNT(*) INTO v_players_to_count
  FROM trade_items
  WHERE trade_id = p_trade_id AND item_type = 'player' AND player_id IS NOT NULL;

  SELECT COUNT(*) INTO v_players_from_count
  FROM trade_items
  WHERE trade_id = p_trade_id AND item_type = 'request' AND player_id IS NOT NULL;

  SELECT COUNT(*) INTO v_from_count
  FROM league_players WHERE team_id = v_trade.from_team_id;

  SELECT COUNT(*) INTO v_to_count
  FROM league_players WHERE team_id = v_trade.to_team_id;

  IF v_from_count < v_players_to_count THEN
    RETURN json_build_object('success', false, 'error', 'Proposer does not have enough players');
  END IF;

  IF v_to_count < v_players_from_count THEN
    RETURN json_build_object('success', false, 'error', 'Your team does not have enough players for this trade');
  END IF;

  IF v_to_count - v_players_from_count + v_players_to_count > 23 THEN
    RETURN json_build_object('success', false, 'error', 'Trade would exceed roster cap (23 max)');
  END IF;

  IF v_from_count - v_players_to_count + v_players_from_count > 23 THEN
    RETURN json_build_object('success', false, 'error', 'Trade would exceed proposer roster cap (23 max)');
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

  FOR v_item IN
    SELECT * FROM trade_items WHERE trade_id = p_trade_id AND item_type = 'request' AND player_id IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM league_players
      WHERE league_id = v_league_id AND player_id = v_item.player_id AND team_id = v_trade.to_team_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Requested player not on your team');
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
    ELSIF v_item.item_type = 'request' AND v_item.player_id IS NOT NULL THEN
      UPDATE contracts SET team_id = v_trade.from_team_id
      WHERE player_id = v_item.player_id AND team_id = v_trade.to_team_id;

      UPDATE league_players SET team_id = v_trade.from_team_id
      WHERE league_id = v_league_id AND player_id = v_item.player_id AND team_id = v_trade.to_team_id;
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
