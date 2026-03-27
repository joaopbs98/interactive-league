-- 061: Registration validator - IL25 squad rules (21-23 players, max 3 GKs)
-- Call before generate_schedule / Start Season; block if any team invalid

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

  IF v_squad_size > 23 THEN
    v_errors := array_append(v_errors, 'Squad must have at most 23 players (has ' || v_squad_size || ')');
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
    'errors', to_json(v_errors)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate all teams in league; returns invalid teams list
CREATE OR REPLACE FUNCTION validate_league_registration(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_team RECORD;
  v_result JSON;
  v_invalid JSONB := '[]'::jsonb;
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
  END LOOP;

  RETURN json_build_object(
    'valid', v_all_valid,
    'invalid_teams', v_invalid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
