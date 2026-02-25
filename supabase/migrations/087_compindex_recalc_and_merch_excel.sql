-- 087: CompIndex on-demand recalc + Merch revenue Excel formula
-- 1. update_league_compindex: recalc comp_index (avg top 14 OVR) for all teams
-- 2. compute_team_merch_revenue: Excel formula (IR^1.7 * 1M) * (0.6 if DEF, 1 if ATT), ROUND to -5

-- Recalculate CompIndex for all teams in a league (avg of top 14 OVR)
CREATE OR REPLACE FUNCTION update_league_compindex(p_league_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE teams t SET comp_index = (
    SELECT COALESCE(AVG(sub.r), 0)
    FROM (
      SELECT lp.rating as r
      FROM league_players lp
      WHERE lp.team_id = t.id
      ORDER BY lp.rating DESC NULLS LAST
      LIMIT 14
    ) sub
  ) WHERE t.league_id = p_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Merch revenue: Excel formula =ARRED((G^1.7*1000000)*SE(E="DEF",0.6,1),-5)
-- G = Int. Rep (1-5), E = ATT/DEF. ROUND to -5 = nearest 100000
CREATE OR REPLACE FUNCTION compute_team_merch_revenue(
  p_team_id UUID,
  p_merch_pct NUMERIC
)
RETURNS INTEGER AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_row RECORD;
  v_ir NUMERIC;
  v_ir_val NUMERIC;
  v_pos_mult NUMERIC;
  v_first_pos TEXT;
  v_per_player NUMERIC;
BEGIN
  FOR v_row IN
    SELECT lp.player_id, lp.rating, lp.positions, COALESCE(p.international_reputation, '1')::TEXT as ir
    FROM league_players lp
    LEFT JOIN player p ON p.player_id = lp.player_id
    WHERE lp.team_id = p_team_id
    ORDER BY lp.rating DESC NULLS LAST
    LIMIT 14
  LOOP
    v_ir := LEAST(5, GREATEST(1, COALESCE((v_row.ir)::NUMERIC, 1)));
    -- Excel: (IR^1.7 * 1000000) * (0.6 if DEF, 1 if ATT), rounded to nearest 100000
    v_first_pos := UPPER(SPLIT_PART(COALESCE(v_row.positions, ''), ',', 1));
    v_pos_mult := CASE
      WHEN v_first_pos IN ('GK','CB','LB','RB','LWB','RWB','CDM') THEN 0.6
      ELSE 1.0
    END;
    v_per_player := ROUND((POWER(v_ir, 1.7) * 1000000) * v_pos_mult, -5);
    v_sum := v_sum + v_per_player;
  END LOOP;

  RETURN (v_sum * LEAST(100, GREATEST(0, p_merch_pct)) / 100)::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;
