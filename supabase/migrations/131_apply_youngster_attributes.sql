-- 131: Extend apply_youngster_rating_delta to accept attribute updates
-- p_attribute_updates JSONB: { "standing_tackle": 78, "defensive_awareness": 76, ... }

CREATE OR REPLACE FUNCTION apply_youngster_rating_delta(
  p_league_id UUID,
  p_player_id TEXT,
  p_delta INTEGER,
  p_games_played INTEGER,
  p_adj_avg NUMERIC,
  p_actor_user_id UUID,
  p_attribute_updates JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_lp RECORD;
  v_new_rating INTEGER;
  v_attr_key TEXT;
  v_attr_val INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = p_league_id AND commissioner_user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Host only');
  END IF;

  SELECT lp.id, lp.team_id, lp.rating
  INTO v_lp
  FROM league_players lp
  WHERE lp.league_id = p_league_id AND lp.player_id = p_player_id AND lp.team_id IS NOT NULL;

  IF v_lp IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Player not found on a team');
  END IF;

  v_new_rating := LEAST(99, GREATEST(40, COALESCE(v_lp.rating, 60) + COALESCE(p_delta, 0)));

  -- Base update: rating, games, adj_avg
  UPDATE league_players SET
    rating = v_new_rating,
    youngster_games_played = COALESCE(p_games_played, youngster_games_played),
    youngster_adj_avg = COALESCE(p_adj_avg, youngster_adj_avg)
  WHERE id = v_lp.id;

  -- Apply attribute updates if provided (only whitelisted stat columns)
  IF p_attribute_updates IS NOT NULL THEN
    FOR v_attr_key, v_attr_val IN
      SELECT t.key, (t.value #>> '{}')::integer
      FROM jsonb_each(p_attribute_updates) AS t(key, value)
    LOOP
      v_attr_val := LEAST(99, GREATEST(1, COALESCE(v_attr_val, 1)));
      IF v_attr_key IN ('acceleration','sprint_speed','agility','reactions','balance','shot_power','jumping','stamina','strength','long_shots','aggression','interceptions','positioning','vision','penalties','composure','crossing','finishing','heading_accuracy','short_passing','volleys','dribbling','curve','fk_accuracy','long_passing','ball_control','defensive_awareness','standing_tackle','sliding_tackle','gk_diving','gk_handling','gk_kicking','gk_positioning','gk_reflexes') THEN
        EXECUTE format('UPDATE league_players SET %I = $1 WHERE id = $2', v_attr_key)
          USING v_attr_val, v_lp.id;
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object('success', true, 'delta', p_delta, 'new_rating', v_new_rating);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
