-- 081: Stock prices (moderator formula) - base $25, floor $12.50
-- HOF Rank: ±30%, Wage Bill vs avg: ±32.5%, Loan repayments: +10% low/-20% high, Merch % vs avg: ±7.5%, Merch Revenue: +20% 2×avg/-20% 0.5×avg

CREATE OR REPLACE FUNCTION compute_stock_price(p_team_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_league_id UUID;
  v_price NUMERIC := 25;
  v_hof_rank INTEGER;
  v_hof_total INTEGER;
  v_wage_bill INTEGER;
  v_avg_wage NUMERIC;
  v_loan_remaining INTEGER;
  v_avg_loan NUMERIC;
  v_merch_pct NUMERIC;
  v_avg_merch_pct NUMERIC;
  v_merch_rev INTEGER;
  v_avg_merch_rev NUMERIC;
  v_mod NUMERIC;
BEGIN
  SELECT league_id INTO v_league_id FROM teams WHERE id = p_team_id;
  IF v_league_id IS NULL THEN RETURN 25; END IF;

  -- HOF Rank: ±30% (better rank = higher; rank 1 = +30%, last = -30%)
  SELECT r.rn, r.cnt INTO v_hof_rank, v_hof_total
  FROM (
    SELECT team_id, ROW_NUMBER() OVER (ORDER BY pts DESC) as rn, COUNT(*) OVER () as cnt
    FROM (SELECT team_id, SUM(hof_points) as pts FROM hall_of_fame WHERE league_id = v_league_id GROUP BY team_id) h
  ) r
  WHERE r.team_id = p_team_id;

  IF v_hof_rank IS NOT NULL AND v_hof_total > 0 THEN
    v_mod := 0.3 * (1 - 2.0 * (v_hof_rank - 1) / GREATEST(v_hof_total - 1, 1));
    v_price := v_price * (1 + v_mod);
  END IF;

  -- Wage Bill vs avg: ±32.5%
  SELECT COALESCE(calculate_team_wages(p_team_id), 0) INTO v_wage_bill;

  SELECT AVG(COALESCE(calculate_team_wages(t.id), 0)) INTO v_avg_wage
  FROM teams t WHERE t.league_id = v_league_id;

  IF v_avg_wage > 0 THEN
    v_mod := LEAST(0.325, GREATEST(-0.325, 0.325 * (v_avg_wage - v_wage_bill) / v_avg_wage));
    v_price := v_price * (1 + v_mod);
  END IF;

  -- Loan repayments: +10% if low/none, -20% if high
  SELECT COALESCE(SUM(remaining), 0) INTO v_loan_remaining
  FROM loans WHERE team_id = p_team_id;

  SELECT AVG(rem) INTO v_avg_loan FROM (
    SELECT COALESCE(SUM(remaining), 0) as rem
    FROM loans l
    JOIN teams t ON t.id = l.team_id
    WHERE t.league_id = v_league_id
    GROUP BY t.id
  ) sub;

  IF v_avg_loan > 0 AND v_loan_remaining > v_avg_loan * 1.5 THEN
    v_price := v_price * 0.8;
  ELSIF v_loan_remaining < v_avg_loan * 0.5 OR v_avg_loan = 0 THEN
    v_price := v_price * 1.1;
  END IF;

  -- Merch % vs avg: ±7.5%
  SELECT (30 + COALESCE(merch_percentage, 0)) INTO v_merch_pct FROM teams WHERE id = p_team_id;
  SELECT AVG(30 + COALESCE(merch_percentage, 0)) INTO v_avg_merch_pct FROM teams WHERE league_id = v_league_id;

  IF v_avg_merch_pct > 0 THEN
    v_mod := LEAST(0.075, GREATEST(-0.075, 0.075 * (v_merch_pct - v_avg_merch_pct) / v_avg_merch_pct));
    v_price := v_price * (1 + v_mod);
  END IF;

  -- Merch Revenue: +20% if 2× avg, -20% if 0.5× avg
  v_merch_rev := COALESCE((SELECT merch_base_revenue FROM teams WHERE id = p_team_id), 0);
  SELECT AVG(COALESCE(merch_base_revenue, 0)) INTO v_avg_merch_rev FROM teams WHERE league_id = v_league_id;

  IF v_avg_merch_rev > 0 THEN
    IF v_merch_rev >= v_avg_merch_rev * 2 THEN
      v_price := v_price * 1.2;
    ELSIF v_merch_rev <= v_avg_merch_rev * 0.5 THEN
      v_price := v_price * 0.8;
    END IF;
  END IF;

  v_price := GREATEST(12.5, v_price);
  RETURN ROUND(v_price, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Called after end_season (from game API) to update stock_value for all teams
CREATE OR REPLACE FUNCTION update_league_stock_prices(p_league_id UUID)
RETURNS void AS $$
  UPDATE teams SET stock_value = compute_stock_price(id) WHERE league_id = p_league_id;
$$ LANGUAGE sql SECURITY DEFINER;
