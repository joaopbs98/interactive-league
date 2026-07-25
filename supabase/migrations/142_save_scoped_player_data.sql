-- The master player table is an immutable seed catalogue. Every mutable value
-- belongs to a league/save through league_players. Custom compatibility rows
-- are tagged so other saves never discover them.
ALTER TABLE player ADD COLUMN IF NOT EXISTS source_league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_player_source_league ON player(source_league_id) WHERE source_league_id IS NOT NULL;

ALTER TABLE league_players
  ADD COLUMN IF NOT EXISTS international_reputation TEXT,
  ADD COLUMN IF NOT EXISTS country_name TEXT,
  ADD COLUMN IF NOT EXISTS country_flag TEXT,
  ADD COLUMN IF NOT EXISTS dob TEXT,
  ADD COLUMN IF NOT EXISTS height_cm TEXT,
  ADD COLUMN IF NOT EXISTS weight_kg TEXT,
  ADD COLUMN IF NOT EXISTS value TEXT,
  ADD COLUMN IF NOT EXISTS preferred_foot TEXT,
  ADD COLUMN IF NOT EXISTS skill_moves TEXT,
  ADD COLUMN IF NOT EXISTS weak_foot TEXT,
  ADD COLUMN IF NOT EXISTS body_type TEXT;

UPDATE league_players lp SET
  international_reputation = COALESCE(lp.international_reputation, p.international_reputation),
  country_name = COALESCE(lp.country_name, p.country_name),
  country_flag = COALESCE(lp.country_flag, p.country_flag),
  dob = COALESCE(lp.dob, p.dob),
  height_cm = COALESCE(lp.height_cm, p.height_cm),
  weight_kg = COALESCE(lp.weight_kg, p.weight_kg),
  value = COALESCE(lp.value, p.value),
  preferred_foot = COALESCE(lp.preferred_foot, p.preferred_foot),
  skill_moves = COALESCE(lp.skill_moves, p.skill_moves),
  weak_foot = COALESCE(lp.weak_foot, p.weak_foot),
  body_type = COALESCE(lp.body_type, p.body_type)
FROM player p WHERE p.player_id = lp.player_id;

CREATE OR REPLACE FUNCTION compute_team_merch_revenue(p_team_id UUID, p_merch_pct NUMERIC)
RETURNS INTEGER AS $$
DECLARE v_sum NUMERIC := 0; v_row RECORD; v_ir NUMERIC; v_pos_mult NUMERIC;
  v_first_pos TEXT; v_per_player NUMERIC; v_ir_raw TEXT;
BEGIN
  FOR v_row IN
    SELECT lp.player_id, lp.rating, lp.positions,
           COALESCE(lp.international_reputation, p.international_reputation, '1')::TEXT AS ir
    FROM league_players lp LEFT JOIN player p ON p.player_id = lp.player_id
    WHERE lp.team_id = p_team_id ORDER BY lp.rating DESC NULLS LAST LIMIT 14
  LOOP
    v_ir_raw := (regexp_match(COALESCE(v_row.ir, '1'), '[0-9]+'))[1];
    v_ir := LEAST(5, GREATEST(1, COALESCE(NULLIF(trim(v_ir_raw), '')::NUMERIC, 1)));
    v_first_pos := UPPER(SPLIT_PART(COALESCE(v_row.positions, ''), ',', 1));
    v_pos_mult := CASE WHEN v_first_pos IN ('GK','CB','LB','RB','LWB','RWB','CDM') THEN 0.6 ELSE 1.0 END;
    v_per_player := ROUND((POWER(v_ir, 1.7) * 1000000) * v_pos_mult, -5);
    v_sum := v_sum + v_per_player;
  END LOOP;
  RETURN (v_sum * LEAST(100, GREATEST(0, p_merch_pct)) / 100)::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;
