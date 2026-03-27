-- 118: Fix round-robin so each team plays exactly once per round (circle method)
-- Previously pairs were assigned to rounds sequentially, causing teams to play multiple matches per round.

CREATE OR REPLACE FUNCTION insert_round_robin_matches(
  p_league_id UUID, p_season INTEGER, p_comp TEXT, p_teams UUID[], p_group TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_n INT := array_length(p_teams, 1);
  v_slots INT;  -- n or n+1 (with bye for odd n)
  v_round INT;
  v_count INT := 0;
  v_order INT[];  -- 1-indexed team indices in circle order
  v_i INT;
  v_home_idx INT;
  v_away_idx INT;
  v_home_team UUID;
  v_away_team UUID;
BEGIN
  IF v_n < 2 THEN RETURN 0; END IF;

  -- For odd n: add virtual bye (slot n+1), we skip matches involving it
  v_slots := CASE WHEN v_n % 2 = 1 THEN v_n + 1 ELSE v_n END;

  -- Build initial order: [1, 2, 3, ..., v_slots] (bye = v_slots when odd)
  v_order := ARRAY(SELECT gs FROM generate_series(1, v_slots) gs);

  -- Leg 1: (v_slots - 1) rounds, each round has v_slots/2 pairs
  FOR v_round IN 1..(v_slots - 1) LOOP
    FOR v_i IN 1..(v_slots / 2) LOOP
      v_home_idx := v_order[v_i];
      v_away_idx := v_order[v_slots - v_i + 1];
      -- Skip if either is bye (index > v_n)
      IF v_home_idx <= v_n AND v_away_idx <= v_n THEN
        v_home_team := p_teams[v_home_idx];
        v_away_team := p_teams[v_away_idx];
        INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
        VALUES (p_league_id, p_season, v_round, v_home_team, v_away_team, p_comp, p_group, 'scheduled');
        v_count := v_count + 1;
      END IF;
    END LOOP;
    -- Rotate: keep position 1 fixed, move last to position 2
    v_order := v_order[1:1] || ARRAY[v_order[v_slots]] || v_order[2:(v_slots-1)];
  END LOOP;

  -- Leg 2: return fixtures (swap home/away), same round structure
  v_order := ARRAY(SELECT gs FROM generate_series(1, v_slots) gs);
  FOR v_round IN 1..(v_slots - 1) LOOP
    FOR v_i IN 1..(v_slots / 2) LOOP
      v_home_idx := v_order[v_i];
      v_away_idx := v_order[v_slots - v_i + 1];
      IF v_home_idx <= v_n AND v_away_idx <= v_n THEN
        v_home_team := p_teams[v_away_idx];  -- swap
        v_away_team := p_teams[v_home_idx];
        INSERT INTO matches (league_id, season, round, home_team_id, away_team_id, competition_type, group_name, match_status)
        VALUES (p_league_id, p_season, v_round + (v_slots - 1), v_home_team, v_away_team, p_comp, p_group, 'scheduled');
        v_count := v_count + 1;
      END IF;
    END LOOP;
    v_order := v_order[1:1] || ARRAY[v_order[v_slots]] || v_order[2:(v_slots-1)];
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
