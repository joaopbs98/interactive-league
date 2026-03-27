-- 040: Enforce rating cap for starter squads (first season only)
-- Per final_doc: "18 players, OVR 50–60" - starter squads are a one-time basis for new teams.
-- After that, users get players from: Packs, Draft (S2+), Free Agents, Auctions, Trades (per final_doc.md).

-- Update auto_starter_squad to filter OVR 50-60 (starter squads are season 1 only)
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
  -- Starter squads: OVR 50-60 only (first-season basis; new players from packs, draft, FA, auctions, trades)
  -- GK: 2 players
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

  -- FLEX: 2 players (any position)
  FOR v_player IN
    SELECT p.player_id, p.name, p.full_name, p.positions, p.overall_rating, p.image,
           p.club_name, p.country_name
    FROM player p
    WHERE p.overall_rating BETWEEN 50 AND 60
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
