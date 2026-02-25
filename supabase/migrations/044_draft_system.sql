-- 044: Draft system - start_draft, make_draft_pick (per final_doc 6.4, 8.1)
-- Draft is Season 2+ only; order = inverse of prior standings; roster cap enforced

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS draft_active BOOLEAN DEFAULT false;

-- Ensure draft_picks has current_owner_team_id (from 035)
-- Use COALESCE(current_owner_team_id, team_id) for pick ownership

CREATE OR REPLACE FUNCTION start_draft(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_season INTEGER;
  v_status league_status;
  v_team RECORD;
  v_pick_num INTEGER := 0;
  v_count INTEGER := 0;
BEGIN
  SELECT season, status INTO v_season, v_status FROM leagues WHERE id = p_league_id;

  IF v_status != 'OFFSEASON' THEN
    RETURN json_build_object('success', false, 'error', 'Draft only in OFFSEASON');
  END IF;

  IF v_season < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Draft is Season 2+ only');
  END IF;

  IF EXISTS (SELECT 1 FROM draft_picks WHERE league_id = p_league_id AND season = v_season) THEN
    RETURN json_build_object('success', false, 'error', 'Draft already started for this season');
  END IF;

  -- Create draft_picks: inverse order of prior season standings (last place = pick 1)
  IF NOT EXISTS (SELECT 1 FROM standings WHERE league_id = p_league_id AND season = v_season - 1) THEN
    RETURN json_build_object('success', false, 'error', 'No standings for prior season - run at least one matchday first');
  END IF;

  FOR v_team IN
    SELECT s.team_id
    FROM standings s
    WHERE s.league_id = p_league_id AND s.season = v_season - 1
    ORDER BY s.points ASC, s.goal_diff ASC, s.goals_for ASC
  LOOP
    v_pick_num := v_pick_num + 1;
    INSERT INTO draft_picks (league_id, team_id, original_team_id, current_owner_team_id, pick_number, season, is_used, item_reward)
    VALUES (p_league_id, v_team.team_id, v_team.team_id, v_team.team_id, v_pick_num, v_season, false, 'player');
    v_count := v_count + 1;
  END LOOP;

  UPDATE leagues SET draft_active = true WHERE id = p_league_id;

  PERFORM write_audit_log(p_league_id, 'start_draft', NULL,
    json_build_object('season', v_season, 'picks_created', v_count)::jsonb);

  RETURN json_build_object('success', true, 'picks_created', v_count, 'season', v_season);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION make_draft_pick(
  p_draft_pick_id UUID,
  p_selected_player_id TEXT,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_pick RECORD;
  v_league_id UUID;
  v_team_id UUID;
  v_season INTEGER;
  v_roster_count INTEGER;
  v_player RECORD;
  v_wage INTEGER;
BEGIN
  SELECT dp.id, dp.league_id, dp.current_owner_team_id, dp.team_id, dp.season, dp.is_used
  INTO v_pick
  FROM draft_picks dp
  WHERE dp.id = p_draft_pick_id;

  IF v_pick IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Draft pick not found');
  END IF;

  IF v_pick.is_used THEN
    RETURN json_build_object('success', false, 'error', 'Pick already used');
  END IF;

  -- Verify actor owns the team that has this pick
  IF NOT EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = COALESCE(v_pick.current_owner_team_id, v_pick.team_id)
      AND t.user_id = p_actor_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to use this pick');
  END IF;

  v_team_id := COALESCE(v_pick.current_owner_team_id, v_pick.team_id);
  v_league_id := v_pick.league_id;
  v_season := v_pick.season;

  -- Phase + draft_active check
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_league_id AND status = 'OFFSEASON' AND draft_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Draft not active');
  END IF;

  -- Roster cap (IL25: max 23)
  SELECT COUNT(*) INTO v_roster_count FROM league_players WHERE team_id = v_team_id;
  IF v_roster_count >= 23 THEN
    RETURN json_build_object('success', false, 'error', 'Roster is full (23 max)');
  END IF;

  -- Player must be free agent in this league (draft pool)
  SELECT lp.id, lp.player_id, lp.player_name, lp.rating, lp.positions, lp.full_name, lp.image
  INTO v_player
  FROM league_players lp
  WHERE lp.league_id = v_league_id AND lp.player_id = p_selected_player_id AND lp.team_id IS NULL;

  IF v_player IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Player not in draft pool');
  END IF;

  v_wage := GREATEST(500000, (COALESCE(v_player.rating, 60) - 50) * 100000);

  -- Assign player to team
  UPDATE league_players SET team_id = v_team_id WHERE id = v_player.id;

  -- Create contract
  INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
  VALUES (p_selected_player_id, v_team_id, v_wage, v_season, 3, 'active')
  ON CONFLICT (team_id, player_id) DO NOTHING;

  -- Mark pick used + record selection
  UPDATE draft_picks SET is_used = true, player_id = p_selected_player_id WHERE id = p_draft_pick_id;
  INSERT INTO draft_selections (draft_pick_id, player_id, item_type) VALUES (p_draft_pick_id, p_selected_player_id, 'player');

  -- Check if draft complete -> set draft_active = false
  IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = v_league_id AND season = v_season AND is_used = false) THEN
    UPDATE leagues SET draft_active = false WHERE id = v_league_id;
  END IF;

  PERFORM write_audit_log(v_league_id, 'make_draft_pick', p_actor_user_id,
    json_build_object('pick_id', p_draft_pick_id, 'player_id', p_selected_player_id, 'team_id', v_team_id)::jsonb);

  RETURN json_build_object('success', true, 'player_name', v_player.player_name, 'team_id', v_team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
