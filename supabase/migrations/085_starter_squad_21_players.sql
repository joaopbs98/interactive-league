-- 085: Starter squad 21 players, max 3 GKs (align with validate_league_registration)
-- Registration requires 21-23 players, max 3 GKs. Old auto_starter_squad gave 18 and FLEX could add GKs.

CREATE OR REPLACE FUNCTION auto_starter_squad(
  p_team_id UUID,
  p_league_id UUID,
  p_season INTEGER DEFAULT 1
) RETURNS JSON AS $$
DECLARE
  v_assigned INTEGER := 0;
  v_player RECORD;
  v_squad_json JSONB := '[]'::jsonb;
  v_wage INTEGER;
BEGIN
  -- Starter squads: OVR 50-60 only. Total 21 players (21-23 required for registration).
  -- GK: 2 players (max 3 allowed; FLEX must not pick GKs)
  FOR v_player IN
    SELECT p.player_id, p.name, p.full_name, p.positions, p.overall_rating, p.image,
           p.club_name, p.country_name, p.acceleration, p.sprint_speed, p.agility,
           p.reactions, p.balance, p.shot_power, p.jumping, p.stamina, p.strength,
           p.crossing, p.finishing, p.heading_accuracy, p.short_passing, p.volleys,
           p.dribbling, p.curve, p.fk_accuracy, p.long_passing, p.ball_control,
           p.standing_tackle, p.sliding_tackle, p.gk_diving, p.gk_handling,
           p.gk_kicking, p.gk_positioning, p.gk_reflexes, p.defensive_awareness
    FROM player p
    WHERE p.positions LIKE '%GK%'
      AND p.overall_rating BETWEEN 50 AND 60
      AND p.player_id NOT IN (
        SELECT lp.player_id FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
      )
    ORDER BY random() LIMIT 2
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    VALUES (p_league_id, v_player.player_id, COALESCE(v_player.name, 'Unknown'),
            v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id,
            v_player.full_name, v_player.image)
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;
    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;
    v_squad_json := v_squad_json || jsonb_build_object(
      'player_id', v_player.player_id, 'name', COALESCE(v_player.full_name, v_player.name),
      'positions', v_player.positions, 'overall_rating', COALESCE(v_player.overall_rating, 60),
      'image', v_player.image, 'club_name', v_player.club_name, 'country_name', v_player.country_name
    );
    v_assigned := v_assigned + 1;
  END LOOP;

  -- DEF: 5 players
  FOR v_player IN
    SELECT p.player_id, p.name, p.full_name, p.positions, p.overall_rating, p.image,
           p.club_name, p.country_name
    FROM player p
    WHERE (p.positions LIKE '%CB%' OR p.positions LIKE '%LB%' OR p.positions LIKE '%RB%'
           OR p.positions LIKE '%RWB%' OR p.positions LIKE '%LWB%')
      AND p.positions NOT LIKE '%GK%'
      AND p.overall_rating BETWEEN 50 AND 60
      AND p.player_id NOT IN (
        SELECT lp.player_id FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
      )
    ORDER BY random() LIMIT 5
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    VALUES (p_league_id, v_player.player_id, COALESCE(v_player.name, 'Unknown'),
            v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id,
            v_player.full_name, v_player.image)
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;
    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;
    v_squad_json := v_squad_json || jsonb_build_object(
      'player_id', v_player.player_id, 'name', COALESCE(v_player.full_name, v_player.name),
      'positions', v_player.positions, 'overall_rating', COALESCE(v_player.overall_rating, 60),
      'image', v_player.image, 'club_name', v_player.club_name, 'country_name', v_player.country_name
    );
    v_assigned := v_assigned + 1;
  END LOOP;

  -- MID: 5 players
  FOR v_player IN
    SELECT p.player_id, p.name, p.full_name, p.positions, p.overall_rating, p.image,
           p.club_name, p.country_name
    FROM player p
    WHERE (p.positions LIKE '%CM%' OR p.positions LIKE '%CDM%' OR p.positions LIKE '%CAM%'
           OR p.positions LIKE '%LM%' OR p.positions LIKE '%RM%')
      AND p.positions NOT LIKE '%GK%'
      AND p.overall_rating BETWEEN 50 AND 60
      AND p.player_id NOT IN (
        SELECT lp.player_id FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
      )
    ORDER BY random() LIMIT 5
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    VALUES (p_league_id, v_player.player_id, COALESCE(v_player.name, 'Unknown'),
            v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id,
            v_player.full_name, v_player.image)
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;
    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;
    v_squad_json := v_squad_json || jsonb_build_object(
      'player_id', v_player.player_id, 'name', COALESCE(v_player.full_name, v_player.name),
      'positions', v_player.positions, 'overall_rating', COALESCE(v_player.overall_rating, 60),
      'image', v_player.image, 'club_name', v_player.club_name, 'country_name', v_player.country_name
    );
    v_assigned := v_assigned + 1;
  END LOOP;

  -- FWD: 4 players
  FOR v_player IN
    SELECT p.player_id, p.name, p.full_name, p.positions, p.overall_rating, p.image,
           p.club_name, p.country_name
    FROM player p
    WHERE (p.positions LIKE '%ST%' OR p.positions LIKE '%CF%' OR p.positions LIKE '%LW%' OR p.positions LIKE '%RW%')
      AND p.positions NOT LIKE '%GK%' AND p.positions NOT LIKE '%CB%'
      AND p.overall_rating BETWEEN 50 AND 60
      AND p.player_id NOT IN (
        SELECT lp.player_id FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
      )
    ORDER BY random() LIMIT 4
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    VALUES (p_league_id, v_player.player_id, COALESCE(v_player.name, 'Unknown'),
            v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id,
            v_player.full_name, v_player.image)
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;
    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;
    v_squad_json := v_squad_json || jsonb_build_object(
      'player_id', v_player.player_id, 'name', COALESCE(v_player.full_name, v_player.name),
      'positions', v_player.positions, 'overall_rating', COALESCE(v_player.overall_rating, 60),
      'image', v_player.image, 'club_name', v_player.club_name, 'country_name', v_player.country_name
    );
    v_assigned := v_assigned + 1;
  END LOOP;

  -- FLEX: 5 players (any non-GK position) - excludes GK to stay within max 3 GKs
  FOR v_player IN
    SELECT p.player_id, p.name, p.full_name, p.positions, p.overall_rating, p.image,
           p.club_name, p.country_name
    FROM player p
    WHERE p.positions NOT LIKE '%GK%'
      AND p.overall_rating BETWEEN 50 AND 60
      AND p.player_id NOT IN (
        SELECT lp.player_id FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
      )
    ORDER BY random() LIMIT 5
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    VALUES (p_league_id, v_player.player_id, COALESCE(v_player.name, 'Unknown'),
            v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id,
            v_player.full_name, v_player.image)
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;
    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, p_season, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;
    v_squad_json := v_squad_json || jsonb_build_object(
      'player_id', v_player.player_id, 'name', COALESCE(v_player.full_name, v_player.name),
      'positions', v_player.positions, 'overall_rating', COALESCE(v_player.overall_rating, 60),
      'image', v_player.image, 'club_name', v_player.club_name, 'country_name', v_player.country_name
    );
    v_assigned := v_assigned + 1;
  END LOOP;

  UPDATE teams SET squad = v_squad_json WHERE id = p_team_id;

  PERFORM write_finance_entry(
    p_team_id, p_league_id, 250000000,
    'Initial Budget', 'Starting budget for season ' || p_season,
    p_season
  );

  RETURN json_build_object(
    'success', true,
    'players_assigned', v_assigned,
    'squad_json_size', jsonb_array_length(v_squad_json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top up existing teams with 18-20 players to reach 21 (for teams created before this migration)
CREATE OR REPLACE FUNCTION top_up_squad_to_21(p_team_id UUID, p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_count INTEGER;
  v_gk_count INTEGER;
  v_to_add INTEGER;
  v_player RECORD;
  v_squad_json JSONB;
  v_wage INTEGER;
  v_added INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_count FROM league_players WHERE team_id = p_team_id;
  SELECT COUNT(*) INTO v_gk_count FROM league_players WHERE team_id = p_team_id AND positions LIKE '%GK%';

  IF v_count >= 21 THEN
    RETURN json_build_object('success', true, 'added', 0, 'message', 'Squad already has 21+ players');
  END IF;

  v_to_add := 21 - v_count;

  -- If > 3 GKs, release excess to free agency first
  IF v_gk_count > 3 THEN
    FOR v_player IN
      SELECT id, player_id FROM league_players
      WHERE team_id = p_team_id AND positions LIKE '%GK%'
      ORDER BY rating DESC
      OFFSET 3
    LOOP
      UPDATE league_players SET team_id = NULL WHERE id = v_player.id;
      DELETE FROM contracts WHERE team_id = p_team_id AND player_id = v_player.player_id;
      v_gk_count := v_gk_count - 1;
      v_count := v_count - 1;
      v_to_add := v_to_add + 1;
    END LOOP;
  END IF;

  -- Add non-GK players to reach 21
  FOR v_player IN
    SELECT p.player_id, p.name, p.full_name, p.positions, p.overall_rating, p.image, p.club_name, p.country_name
    FROM player p
    WHERE p.positions NOT LIKE '%GK%'
      AND p.overall_rating BETWEEN 50 AND 60
      AND p.player_id NOT IN (
        SELECT lp.player_id FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.team_id IS NOT NULL
      )
    ORDER BY random() LIMIT v_to_add
  LOOP
    v_wage := GREATEST(500000, (COALESCE(v_player.overall_rating, 60) - 50) * 100000);
    INSERT INTO league_players (league_id, player_id, player_name, positions, rating, team_id, full_name, image)
    VALUES (p_league_id, v_player.player_id, COALESCE(v_player.name, 'Unknown'),
            v_player.positions, COALESCE(v_player.overall_rating, 60), p_team_id,
            v_player.full_name, v_player.image)
    ON CONFLICT (league_id, player_id) DO UPDATE SET team_id = p_team_id;
    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_player.player_id, p_team_id, v_wage, 1, 3, 'active')
    ON CONFLICT (team_id, player_id) DO NOTHING;
    v_added := v_added + 1;
  END LOOP;

  -- Refresh teams.squad JSON
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'player_id', lp.player_id, 'name', COALESCE(lp.full_name, lp.player_name),
    'positions', lp.positions, 'overall_rating', lp.rating,
    'image', lp.image, 'club_name', NULL, 'country_name', NULL
  )), '[]'::jsonb) INTO v_squad_json
  FROM league_players lp WHERE lp.team_id = p_team_id;
  UPDATE teams SET squad = v_squad_json WHERE id = p_team_id;

  RETURN json_build_object('success', true, 'added', v_added);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
