-- 108: Fix compute_team_merch_revenue to handle international_reputation values like "1 International reputation"
-- EAFC/FIFA data may store IR as "1 International reputation" instead of "1"; extract first numeric part

CREATE OR REPLACE FUNCTION compute_team_merch_revenue(
  p_team_id UUID,
  p_merch_pct NUMERIC
)
RETURNS INTEGER AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_row RECORD;
  v_ir NUMERIC;
  v_pos_mult NUMERIC;
  v_first_pos TEXT;
  v_per_player NUMERIC;
  v_ir_raw TEXT;
BEGIN
  FOR v_row IN
    SELECT lp.player_id, lp.rating, lp.positions, COALESCE(p.international_reputation, '1')::TEXT as ir
    FROM league_players lp
    LEFT JOIN player p ON p.player_id = lp.player_id
    WHERE lp.team_id = p_team_id
    ORDER BY lp.rating DESC NULLS LAST
    LIMIT 14
  LOOP
    -- Extract first numeric part (handles "1 International reputation", "3", etc.)
    v_ir_raw := (regexp_match(COALESCE(v_row.ir, '1'), '[0-9]+'))[1];
    v_ir := LEAST(5, GREATEST(1, COALESCE(NULLIF(trim(v_ir_raw), '')::NUMERIC, 1)));
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
