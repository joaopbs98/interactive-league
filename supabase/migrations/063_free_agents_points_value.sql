-- 063: Free Agents - guaranteed_pct, Points Value formula (IL25 spec)
-- Add guaranteed_pct to free_agent_bids; update resolve_free_agency with Truth formula

ALTER TABLE free_agent_bids ADD COLUMN IF NOT EXISTS guaranteed_pct NUMERIC DEFAULT 1;
ALTER TABLE free_agent_bids ADD COLUMN IF NOT EXISTS no_trade_clause BOOLEAN DEFAULT false;

COMMENT ON COLUMN free_agent_bids.guaranteed_pct IS 'Guaranteed percentage as decimal 0-1 (1 = 100%). 1-year contracts always 100%.';
COMMENT ON COLUMN free_agent_bids.no_trade_clause IS 'Adds boost to Points Value (TBD formula)';

-- Helper: compute Points Value for a bid (IL25 Truth formula)
-- Points Value = (H/100000) * GuaranteedMod * LengthMod
-- GuaranteedMod = 1 + 0.2*sign(G-0.25)*abs(G-0.25)^0.5 + (G<0.2 ? -30.7*(0.2-G)^2 : 0)
-- LengthMod = CHOOSE(E, 1, 0.98, 0.94, 0.88, 0.8)
CREATE OR REPLACE FUNCTION free_agent_points_value(
  p_value_of_contract NUMERIC,
  p_guaranteed_pct NUMERIC,
  p_years INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  v_base NUMERIC;
  v_g NUMERIC;
  v_guaranteed_mod NUMERIC;
  v_length_mod NUMERIC;
BEGIN
  v_base := p_value_of_contract / 100000.0;
  v_g := COALESCE(p_guaranteed_pct, 1);
  -- 1-year contracts always 100%
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

  RETURN v_base * v_guaranteed_mod * v_length_mod;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update resolve_free_agency to use Points Value formula
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
BEGIN
  SELECT season, status::TEXT INTO v_season, v_status
  FROM leagues WHERE id = p_league_id;

  IF v_status != 'OFFSEASON' THEN
    RETURN json_build_object('success', false, 'error', 'Free agency can only be resolved during OFFSEASON');
  END IF;

  FOR v_fa IN
    SELECT DISTINCT lp.player_id, lp.id as league_player_id, lp.league_id, lp.player_name, lp.rating
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

    UPDATE league_players SET team_id = v_winner_team_id
    WHERE id = v_fa.league_player_id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_fa.player_id, v_winner_team_id, v_winner_salary, v_season, v_winner_years, 'active')
    ON CONFLICT (team_id, player_id) DO UPDATE SET
      wage = v_winner_salary,
      start_season = v_season,
      years = v_winner_years,
      status = 'active';

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
