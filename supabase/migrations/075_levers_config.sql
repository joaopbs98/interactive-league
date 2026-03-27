-- 075: Levers config (leagues.levers_enabled) - S2 scrapped levers; configurable per league
-- When false: hide sell-merch UI, block sell_merch_percentage RPC

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS levers_enabled BOOLEAN DEFAULT true;
COMMENT ON COLUMN leagues.levers_enabled IS 'When false, sell-merch (Barcelona lever) is disabled for this league (S2+ rule)';

-- Update sell_merch_percentage to check levers_enabled
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
  v_levers_enabled BOOLEAN;
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

  SELECT COALESCE(l.levers_enabled, true) INTO v_levers_enabled
  FROM leagues l WHERE l.id = v_team.league_id;

  IF NOT v_levers_enabled THEN
    RETURN json_build_object('success', false, 'error', 'Levers are disabled for this league');
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
