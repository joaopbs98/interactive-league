-- 120: Guard against null team_id in auto_assign_competition_stages
-- Matches can have null home/away if team was deleted (ON DELETE SET NULL).
-- competition_standings could have stale data. Skip inserts when team_id is null.

CREATE OR REPLACE FUNCTION auto_assign_competition_stages(p_league_id UUID, p_season INTEGER)
RETURNS void AS $$
DECLARE
  v_comp TEXT;
  v_stage TEXT;
  v_team_id UUID;
  v_match RECORD;
  v_final_round INTEGER;
  v_semi_round INTEGER;
  v_winner_id UUID;
  v_loser_id UUID;
  v_knockout_rounds INTEGER[];
BEGIN
  FOR v_comp IN SELECT unnest(ARRAY['ucl','uel','uecl']) LOOP
    SELECT array_agg(DISTINCT round ORDER BY round DESC)
    INTO v_knockout_rounds
    FROM matches
    WHERE league_id = p_league_id AND season = p_season
      AND competition_type = v_comp
      AND (group_name IS NULL OR group_name = '')
      AND match_status = 'simulated';

    IF v_knockout_rounds IS NULL OR array_length(v_knockout_rounds, 1) IS NULL THEN
      FOR v_team_id IN
        SELECT DISTINCT team_id FROM competition_standings
        WHERE league_id = p_league_id AND season = p_season AND competition_type = v_comp
          AND team_id IS NOT NULL
      LOOP
        INSERT INTO team_competition_results (team_id, league_id, season, stage)
        VALUES (v_team_id, p_league_id, p_season, upper(v_comp) || ' Group Stage')
        ON CONFLICT (team_id, league_id, season) DO UPDATE SET
          stage = CASE
            WHEN get_hof_points_for_stage(EXCLUDED.stage) > get_hof_points_for_stage(team_competition_results.stage)
            THEN EXCLUDED.stage
            ELSE team_competition_results.stage
          END;
      END LOOP;
      CONTINUE;
    END IF;

    SELECT round INTO v_final_round
    FROM (
      SELECT round, count(*) as cnt
      FROM matches
      WHERE league_id = p_league_id AND season = p_season
        AND competition_type = v_comp
        AND (group_name IS NULL OR group_name = '')
        AND match_status = 'simulated'
      GROUP BY round
      ORDER BY count(*) ASC, round DESC
      LIMIT 1
    ) sub;

    FOR v_match IN
      SELECT id, home_team_id, away_team_id, home_score, away_score
      FROM matches
      WHERE league_id = p_league_id AND season = p_season
        AND competition_type = v_comp
        AND round = v_final_round
        AND (group_name IS NULL OR group_name = '')
        AND match_status = 'simulated'
    LOOP
      IF (v_match.home_score IS NOT NULL AND v_match.away_score IS NOT NULL) THEN
        IF v_match.home_score > v_match.away_score THEN
          v_winner_id := v_match.home_team_id;
          v_loser_id := v_match.away_team_id;
        ELSE
          v_winner_id := v_match.away_team_id;
          v_loser_id := v_match.home_team_id;
        END IF;

        IF v_winner_id IS NOT NULL THEN
          INSERT INTO team_competition_results (team_id, league_id, season, stage)
          VALUES (v_winner_id, p_league_id, p_season, upper(v_comp) || ' Winners')
          ON CONFLICT (team_id, league_id, season) DO UPDATE SET
            stage = CASE WHEN get_hof_points_for_stage(upper(v_comp) || ' Winners') > get_hof_points_for_stage(team_competition_results.stage)
              THEN upper(v_comp) || ' Winners' ELSE team_competition_results.stage END;
        END IF;

        IF v_loser_id IS NOT NULL THEN
          INSERT INTO team_competition_results (team_id, league_id, season, stage)
          VALUES (v_loser_id, p_league_id, p_season, upper(v_comp) || ' Finalist')
          ON CONFLICT (team_id, league_id, season) DO UPDATE SET
            stage = CASE WHEN get_hof_points_for_stage(upper(v_comp) || ' Finalist') > get_hof_points_for_stage(team_competition_results.stage)
              THEN upper(v_comp) || ' Finalist' ELSE team_competition_results.stage END;
        END IF;
      END IF;
    END LOOP;

    SELECT round INTO v_semi_round
    FROM (
      SELECT round, count(*) as cnt
      FROM matches
      WHERE league_id = p_league_id AND season = p_season
        AND competition_type = v_comp
        AND (group_name IS NULL OR group_name = '')
        AND match_status = 'simulated'
        AND round != v_final_round
      GROUP BY round
      ORDER BY count(*) ASC, round DESC
      LIMIT 1
    ) sub;

    IF v_semi_round IS NOT NULL THEN
      FOR v_match IN
        SELECT home_team_id, away_team_id, home_score, away_score
        FROM matches
        WHERE league_id = p_league_id AND season = p_season
          AND competition_type = v_comp
          AND round = v_semi_round
          AND match_status = 'simulated'
      LOOP
        IF v_match.home_score IS NOT NULL AND v_match.away_score IS NOT NULL THEN
          IF v_match.home_score > v_match.away_score THEN
            v_loser_id := v_match.away_team_id;
          ELSE
            v_loser_id := v_match.home_team_id;
          END IF;

          IF v_loser_id IS NOT NULL THEN
            INSERT INTO team_competition_results (team_id, league_id, season, stage)
            VALUES (v_loser_id, p_league_id, p_season, upper(v_comp) || ' Semi-Finalist')
            ON CONFLICT (team_id, league_id, season) DO UPDATE SET
              stage = CASE WHEN get_hof_points_for_stage(upper(v_comp) || ' Semi-Finalist') > get_hof_points_for_stage(team_competition_results.stage)
                THEN upper(v_comp) || ' Semi-Finalist' ELSE team_competition_results.stage END;
          END IF;
        END IF;
      END LOOP;
    END IF;

    FOR v_team_id IN
      SELECT DISTINCT team_id FROM competition_standings
      WHERE league_id = p_league_id AND season = p_season AND competition_type = v_comp
        AND team_id IS NOT NULL
    LOOP
      INSERT INTO team_competition_results (team_id, league_id, season, stage)
      VALUES (v_team_id, p_league_id, p_season, upper(v_comp) || ' Group Stage')
      ON CONFLICT (team_id, league_id, season) DO UPDATE SET
        stage = CASE
          WHEN get_hof_points_for_stage(upper(v_comp) || ' Group Stage') > get_hof_points_for_stage(team_competition_results.stage)
          THEN upper(v_comp) || ' Group Stage'
          ELSE team_competition_results.stage
        END;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
