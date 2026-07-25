-- 133: Squad limit rework
-- - During OFFSEASON, squads may exceed 23 players (no cap on trades / FA / packs / auctions).
-- - At season start (generate_schedule), squads with >23 players no longer BLOCK the season:
--   instead the host fines the team (1,000,000 per player over 23) and the season proceeds.
-- - Squads with <21 players still BLOCK season start (can't field a legal team).
-- - Max 3 GKs still blocks season start (unchanged).

-- 1. validate_squad_registration: >23 is no longer a blocking error, just reported as excess_players
CREATE OR REPLACE FUNCTION validate_squad_registration(p_league_id UUID, p_team_id UUID)
RETURNS JSON AS $$
DECLARE
  v_squad_size INTEGER;
  v_gk_count INTEGER;
  v_errors TEXT[] := '{}';
  v_valid BOOLEAN := true;
BEGIN
  SELECT COUNT(*) INTO v_squad_size
  FROM league_players lp
  WHERE lp.team_id = p_team_id;

  SELECT COUNT(*) INTO v_gk_count
  FROM league_players lp
  WHERE lp.team_id = p_team_id
    AND lp.positions LIKE '%GK%';

  IF v_squad_size < 21 THEN
    v_errors := array_append(v_errors, 'Squad must have at least 21 players (has ' || v_squad_size || ')');
    v_valid := false;
  END IF;

  IF v_gk_count > 3 THEN
    v_errors := array_append(v_errors, 'Maximum 3 goalkeepers allowed (has ' || v_gk_count || ')');
    v_valid := false;
  END IF;

  RETURN json_build_object(
    'valid', v_valid,
    'squad_size', v_squad_size,
    'gk_count', v_gk_count,
    'excess_players', GREATEST(0, v_squad_size - 23),
    'errors', to_json(v_errors)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. validate_league_registration: split blocking issues from fineable excess-squad teams
CREATE OR REPLACE FUNCTION validate_league_registration(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_team RECORD;
  v_result JSON;
  v_invalid JSONB := '[]'::jsonb;
  v_fine_teams JSONB := '[]'::jsonb;
  v_all_valid BOOLEAN := true;
BEGIN
  FOR v_team IN
    SELECT t.id, t.name
    FROM teams t
    WHERE t.league_id = p_league_id
  LOOP
    SELECT validate_squad_registration(p_league_id, v_team.id) INTO v_result;

    IF NOT (v_result->>'valid')::boolean THEN
      v_all_valid := false;
      v_invalid := v_invalid || jsonb_build_array(jsonb_build_object(
        'team_id', v_team.id,
        'team_name', v_team.name,
        'squad_size', (v_result->>'squad_size')::integer,
        'gk_count', (v_result->>'gk_count')::integer,
        'errors', v_result->'errors'
      ));
    END IF;

    IF (v_result->>'excess_players')::integer > 0 THEN
      v_fine_teams := v_fine_teams || jsonb_build_array(jsonb_build_object(
        'team_id', v_team.id,
        'team_name', v_team.name,
        'squad_size', (v_result->>'squad_size')::integer,
        'excess_players', (v_result->>'excess_players')::integer,
        'fine_amount', (v_result->>'excess_players')::integer * 1000000
      ));
    END IF;
  END LOOP;

  RETURN json_build_object(
    'valid', v_all_valid,
    'invalid_teams', v_invalid,
    'fine_teams', v_fine_teams
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. execute_trade: remove the 23-player roster cap (offseason squads can exceed 23)
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

-- 4. resolve_free_agency: remove the 23-player roster cap (budget check remains)
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

    SELECT budget INTO v_budget FROM teams WHERE id = v_winner_team_id;

    IF COALESCE(v_budget, 0) < v_winner_bonus THEN
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
