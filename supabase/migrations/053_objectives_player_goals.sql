-- 053: Objectives extension - player_goals, payload, season_to_check (IL25 spec 10)
-- Extends trade objectives to support player_goals condition type

ALTER TABLE objectives ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS season_to_check INTEGER;

-- Note: end_season in 047 evaluates objectives. To add player_goals support,
-- the objectives loop would need an additional branch:
--   ELSIF v_obj.trigger_condition ILIKE '%player_goals%' THEN
--     v_player_id := (v_obj.payload->>'player_id');
--     v_threshold := COALESCE((v_obj.payload->>'threshold')::integer, 10);
--     SELECT COALESCE(goals,0) INTO v_player_goals FROM league_players
--     WHERE league_id=p_league_id AND team_id=v_obj.from_team_id AND player_id=v_player_id;
--     IF v_player_goals >= v_threshold THEN ... (transfer funds, mark fulfilled)
--
-- league_players.goals must be populated by match simulation for this to work.
