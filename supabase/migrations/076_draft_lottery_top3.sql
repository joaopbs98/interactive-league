-- 076: Draft lottery for top 3 picks (moderator rule)
-- 3 worst teams by standings get picks 1-3 in random order; rest = inverse standings

CREATE OR REPLACE FUNCTION start_draft(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_season INTEGER;
  v_status league_status;
  v_team RECORD;
  v_pick_num INTEGER := 0;
  v_count INTEGER := 0;
  v_worst_three UUID[] := '{}';
  v_shuffled UUID[];
  v_team_id UUID;
  v_i INTEGER;
  v_j INTEGER;
  v_tmp UUID;
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

  IF NOT EXISTS (SELECT 1 FROM standings WHERE league_id = p_league_id AND season = v_season - 1) THEN
    RETURN json_build_object('success', false, 'error', 'No standings for prior season - run at least one matchday first');
  END IF;

  -- Collect 3 worst teams (last 3 in standings: points ASC, goal_diff ASC, goals_for ASC)
  SELECT ARRAY_AGG(team_id ORDER BY points ASC, goal_diff ASC, goals_for ASC)
  INTO v_worst_three
  FROM (
    SELECT s.team_id
    FROM standings s
    WHERE s.league_id = p_league_id AND s.season = v_season - 1
    ORDER BY s.points ASC, s.goal_diff ASC, s.goals_for ASC
    LIMIT 3
  ) sub;

  v_shuffled := COALESCE(v_worst_three, '{}');

  -- Fisher-Yates shuffle for top 3
  IF array_length(v_shuffled, 1) >= 2 THEN
    FOR v_i IN REVERSE array_length(v_shuffled, 1)..2 LOOP
      v_j := 1 + floor(random() * v_i)::INTEGER;
      v_tmp := v_shuffled[v_i];
      v_shuffled[v_i] := v_shuffled[v_j];
      v_shuffled[v_j] := v_tmp;
    END LOOP;
  END IF;

  -- Insert picks 1-3 from shuffled worst three
  FOR v_i IN 1..LEAST(array_length(v_shuffled, 1), 3) LOOP
    v_team_id := v_shuffled[v_i];
    IF v_team_id IS NOT NULL THEN
      v_pick_num := v_pick_num + 1;
      INSERT INTO draft_picks (league_id, team_id, original_team_id, current_owner_team_id, pick_number, season, is_used, item_reward)
      VALUES (p_league_id, v_team_id, v_team_id, v_team_id, v_pick_num, v_season, false, 'player');
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Insert picks 4+ from rest of teams (inverse standings, excluding those already in top 3)
  FOR v_team IN
    SELECT s.team_id
    FROM standings s
    WHERE s.league_id = p_league_id AND s.season = v_season - 1
      AND s.team_id != ALL(COALESCE(v_shuffled, ARRAY[]::UUID[]))
    ORDER BY s.points ASC, s.goal_diff ASC, s.goals_for ASC
  LOOP
    v_pick_num := v_pick_num + 1;
    INSERT INTO draft_picks (league_id, team_id, original_team_id, current_owner_team_id, pick_number, season, is_used, item_reward)
    VALUES (p_league_id, v_team.team_id, v_team.team_id, v_team.team_id, v_pick_num, v_season, false, 'player');
    v_count := v_count + 1;
  END LOOP;

  -- If fewer than 3 teams in league, we may have inserted all in first loop. Handle edge case:
  -- When v_worst_three has all teams (e.g. 2 teams), the second loop adds nothing. That's correct.
  -- When we have 4+ teams: first 3 from shuffled, rest from second loop. Good.

  UPDATE leagues SET draft_active = true WHERE id = p_league_id;

  PERFORM write_audit_log(p_league_id, 'start_draft', NULL,
    json_build_object('season', v_season, 'picks_created', v_count, 'lottery_top3', true)::jsonb);

  RETURN json_build_object('success', true, 'picks_created', v_count, 'season', v_season);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
