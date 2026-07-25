-- 137: Balanced draft pool generation + auto-pick for mock (no-user) teams
--
-- Two gaps found while auditing the draft feature:
-- 1. The host's only way to build a draft pool was manual search-and-add, which in
--    practice produced wildly unbalanced pools (Ronaldo/Mbappe/Haaland-tier players
--    in a season-2 draft). There was no tool to generate a pool sized and rated
--    appropriately for the current season.
-- 2. make_draft_pick() requires `teams.user_id = p_actor_user_id`. Mock teams (added
--    via Host Controls "Add Mock Teams") have user_id = NULL, which can never equal
--    any actor — so nobody, not even the host, could ever submit a pick on a mock
--    team's turn. Any league using mock teams had its draft permanently stuck the
--    moment the turn order reached one.

-- Selects a balanced set of player_ids for this league's draft pool: one per required
-- position where available (skipping positions with no eligible candidate), then tops
-- up with additional random eligible players until the pool reaches team_count players.
-- Rating band = [this season's Basic-pack floor, this season's Prime-pack ceiling] —
-- Elite-tier pulls are a deliberately rare outlier, not representative of what the
-- league's rosters actually look like this season, so Prime (the flagship premium
-- tier) is used as the practical ceiling instead.
CREATE OR REPLACE FUNCTION select_balanced_draft_players(p_league_id UUID)
RETURNS TABLE(player_id TEXT) AS $$
DECLARE
  v_season INTEGER;
  v_team_count INTEGER;
  v_min_rating INTEGER;
  v_max_rating INTEGER;
  v_positions TEXT[] := ARRAY['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST','LM','RM'];
  v_pos TEXT;
  v_pid TEXT;
  v_selected TEXT[] := '{}';
BEGIN
  SELECT season INTO v_season FROM leagues WHERE id = p_league_id;
  SELECT COUNT(*) INTO v_team_count FROM teams WHERE league_id = p_league_id;
  IF v_team_count IS NULL OR v_team_count = 0 THEN
    RETURN;
  END IF;

  SELECT MIN(pro.rating) INTO v_min_rating
  FROM packs p JOIN pack_rating_odds pro ON pro.pack_id = p.id
  WHERE p.season = v_season AND p.pack_type = 'Basic' AND pro.probability > 0;

  SELECT MAX(pro.rating) INTO v_max_rating
  FROM packs p JOIN pack_rating_odds pro ON pro.pack_id = p.id
  WHERE p.season = v_season AND p.pack_type = 'Prime' AND pro.probability > 0;

  IF v_min_rating IS NULL THEN v_min_rating := 55; END IF;
  IF v_max_rating IS NULL THEN v_max_rating := 70; END IF;
  IF v_max_rating < v_min_rating THEN v_max_rating := v_min_rating + 10; END IF;

  -- One per required position, skipping any position with no eligible candidate
  FOREACH v_pos IN ARRAY v_positions LOOP
    EXIT WHEN COALESCE(array_length(v_selected, 1), 0) >= v_team_count;

    SELECT pl.player_id INTO v_pid
    FROM player pl
    WHERE pl.positions ILIKE '%' || v_pos || '%'
      AND pl.overall_rating BETWEEN v_min_rating AND v_max_rating
      AND NOT (pl.player_id = ANY(v_selected))
      AND NOT EXISTS (
        SELECT 1 FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.player_id = pl.player_id AND lp.team_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM draft_pool dpo
        WHERE dpo.league_id = p_league_id AND dpo.season = v_season AND dpo.player_id = pl.player_id
      )
    ORDER BY random()
    LIMIT 1;

    IF v_pid IS NOT NULL THEN
      v_selected := v_selected || v_pid;
    END IF;
  END LOOP;

  -- Top up to team_count with any-position eligible players
  WHILE COALESCE(array_length(v_selected, 1), 0) < v_team_count LOOP
    SELECT pl.player_id INTO v_pid
    FROM player pl
    WHERE pl.overall_rating BETWEEN v_min_rating AND v_max_rating
      AND NOT (pl.player_id = ANY(v_selected))
      AND NOT EXISTS (
        SELECT 1 FROM league_players lp
        WHERE lp.league_id = p_league_id AND lp.player_id = pl.player_id AND lp.team_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM draft_pool dpo
        WHERE dpo.league_id = p_league_id AND dpo.season = v_season AND dpo.player_id = pl.player_id
      )
    ORDER BY random()
    LIMIT 1;

    EXIT WHEN v_pid IS NULL;
    v_selected := v_selected || v_pid;
  END LOOP;

  RETURN QUERY SELECT unnest(v_selected);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolves consecutive draft picks belonging to teams with no owning user (mock teams),
-- picking the highest-rated eligible player each time, until it reaches a pick owned by
-- a real user (or runs out of picks/pool). Called after start_draft and after every real
-- user's make_draft_pick, so a mock team's turn is never something a human has to wait on.
CREATE OR REPLACE FUNCTION auto_resolve_mock_draft_picks(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_season INTEGER;
  v_pick RECORD;
  v_use_draft_pool BOOLEAN;
  v_player RECORD;
  v_wage INTEGER;
  v_resolved INTEGER := 0;
BEGIN
  SELECT season INTO v_season FROM leagues WHERE id = p_league_id;

  LOOP
    SELECT dp.id, dp.pick_number, COALESCE(dp.current_owner_team_id, dp.team_id) AS owner_team_id
    INTO v_pick
    FROM draft_picks dp
    WHERE dp.league_id = p_league_id AND dp.season = v_season AND dp.is_used = false
    ORDER BY dp.pick_number ASC
    LIMIT 1;

    EXIT WHEN v_pick IS NULL;

    -- Stop as soon as it's a real user's turn
    EXIT WHEN EXISTS (SELECT 1 FROM teams WHERE id = v_pick.owner_team_id AND user_id IS NOT NULL);

    SELECT EXISTS (SELECT 1 FROM draft_pool WHERE league_id = p_league_id AND season = v_season) INTO v_use_draft_pool;

    SELECT lp.id, lp.player_id, lp.rating
    INTO v_player
    FROM league_players lp
    WHERE lp.league_id = p_league_id AND lp.team_id IS NULL
      AND (NOT v_use_draft_pool OR EXISTS (
        SELECT 1 FROM draft_pool dpo WHERE dpo.league_id = p_league_id AND dpo.season = v_season AND dpo.player_id = lp.player_id
      ))
    ORDER BY lp.rating DESC NULLS LAST
    LIMIT 1;

    -- No eligible player left for this mock pick — mark it used with no player rather
    -- than looping forever (matches the "ignore that position/pick" spirit requested).
    IF v_player IS NULL THEN
      UPDATE draft_picks SET is_used = true WHERE id = v_pick.id;
      IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = p_league_id AND season = v_season AND is_used = false) THEN
        UPDATE leagues SET draft_active = false WHERE id = p_league_id;
      END IF;
      CONTINUE;
    END IF;

    v_wage := GREATEST(500000, (COALESCE(v_player.rating, 60) - 50) * 100000);

    UPDATE league_players SET team_id = v_pick.owner_team_id, origin_type = 'drafted' WHERE id = v_player.id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status, wage_discount_percent)
    VALUES (v_player.player_id, v_pick.owner_team_id, v_wage, v_season, 3, 'active', 20)
    ON CONFLICT (team_id, player_id) DO UPDATE SET
      wage = v_wage, start_season = v_season, years = 3, status = 'active', wage_discount_percent = 20;

    UPDATE draft_picks SET is_used = true, player_id = v_player.player_id WHERE id = v_pick.id;
    INSERT INTO draft_selections (draft_pick_id, player_id, item_type) VALUES (v_pick.id, v_player.player_id, 'player');

    IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = p_league_id AND season = v_season AND is_used = false) THEN
      UPDATE leagues SET draft_active = false WHERE id = p_league_id;
    END IF;

    PERFORM write_audit_log(p_league_id, 'auto_draft_pick', NULL,
      json_build_object('pick_id', v_pick.id, 'player_id', v_player.player_id, 'team_id', v_pick.owner_team_id)::jsonb);

    v_resolved := v_resolved + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'auto_resolved', v_resolved);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- start_draft: auto-resolve any leading mock-team picks immediately after creating them
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

  SELECT ARRAY_AGG(team_id ORDER BY points ASC, goal_diff ASC, goals_for ASC)
  INTO v_worst_three
  FROM (
    SELECT s.team_id, s.points, s.goal_diff, s.goals_for
    FROM standings s
    WHERE s.league_id = p_league_id AND s.season = v_season - 1
    ORDER BY s.points ASC, s.goal_diff ASC, s.goals_for ASC
    LIMIT 3
  ) sub;

  v_shuffled := COALESCE(v_worst_three, '{}');

  IF array_length(v_shuffled, 1) >= 2 THEN
    FOR v_i IN REVERSE array_length(v_shuffled, 1)..2 LOOP
      v_j := 1 + floor(random() * v_i)::INTEGER;
      v_tmp := v_shuffled[v_i];
      v_shuffled[v_i] := v_shuffled[v_j];
      v_shuffled[v_j] := v_tmp;
    END LOOP;
  END IF;

  FOR v_i IN 1..LEAST(array_length(v_shuffled, 1), 3) LOOP
    v_team_id := v_shuffled[v_i];
    IF v_team_id IS NOT NULL THEN
      v_pick_num := v_pick_num + 1;
      INSERT INTO draft_picks (league_id, team_id, original_team_id, current_owner_team_id, pick_number, season, is_used, item_reward)
      VALUES (p_league_id, v_team_id, v_team_id, v_team_id, v_pick_num, v_season, false, 'player');
      v_count := v_count + 1;
    END IF;
  END LOOP;

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

  UPDATE leagues SET draft_active = true WHERE id = p_league_id;

  PERFORM write_audit_log(p_league_id, 'start_draft', NULL,
    json_build_object('season', v_season, 'picks_created', v_count, 'lottery_top3', true)::jsonb);

  PERFORM auto_resolve_mock_draft_picks(p_league_id);

  RETURN json_build_object('success', true, 'picks_created', v_count, 'season', v_season);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- make_draft_pick: cascade into any following mock-team picks after a real user's pick
CREATE OR REPLACE FUNCTION make_draft_pick(
  p_draft_pick_id UUID,
  p_selected_player_id TEXT,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_pick RECORD;
  v_team_id UUID;
  v_league_id UUID;
  v_season INTEGER;
  v_roster_count INTEGER;
  v_player RECORD;
  v_wage INTEGER;
  v_bonus_type TEXT;
  v_bonus_value INTEGER;
  v_bonus_tier TEXT;
  v_use_draft_pool BOOLEAN;
BEGIN
  SELECT dp.league_id, dp.season, dp.bonus,
         COALESCE(dp.current_owner_team_id, dp.team_id) AS owner_team_id
  INTO v_pick
  FROM draft_picks dp
  WHERE dp.id = p_draft_pick_id AND dp.is_used = false;

  IF v_pick IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or already used draft pick');
  END IF;

  v_team_id := v_pick.owner_team_id;
  v_league_id := v_pick.league_id;
  v_season := v_pick.season;
  v_bonus_type := v_pick.bonus->>'type';
  v_bonus_value := (v_pick.bonus->>'value')::INTEGER;
  v_bonus_tier := v_pick.bonus->>'tier';

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_team_id AND user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to use this pick');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_league_id AND status = 'OFFSEASON' AND draft_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Draft not active');
  END IF;

  SELECT EXISTS (SELECT 1 FROM draft_pool WHERE league_id = v_league_id AND season = v_season) INTO v_use_draft_pool;

  IF v_bonus_type IS NULL OR v_bonus_type = 'player' OR v_bonus_type = 'player_choice_80' THEN
    IF p_selected_player_id IS NULL OR p_selected_player_id = '' THEN
      RETURN json_build_object('success', false, 'error', 'Player selection required');
    END IF;

    SELECT COUNT(*) INTO v_roster_count FROM league_players WHERE team_id = v_team_id;
    IF v_roster_count >= 23 THEN
      RETURN json_build_object('success', false, 'error', 'Roster is full (23 max)');
    END IF;

    SELECT lp.id, lp.player_id, lp.player_name, lp.rating, lp.positions, lp.full_name, lp.image
    INTO v_player
    FROM league_players lp
    WHERE lp.league_id = v_league_id AND lp.player_id = p_selected_player_id AND lp.team_id IS NULL;

    IF v_player IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Player not in draft pool');
    END IF;

    IF v_use_draft_pool AND NOT EXISTS (SELECT 1 FROM draft_pool WHERE league_id = v_league_id AND season = v_season AND player_id = p_selected_player_id) THEN
      RETURN json_build_object('success', false, 'error', 'Player not in host-selected draft pool');
    END IF;

    IF v_bonus_type = 'player_choice_80' AND COALESCE(v_player.rating, 0) > 80 THEN
      RETURN json_build_object('success', false, 'error', 'Player of choice (80) pick: selected player must have OVR 80 or below');
    END IF;

    v_wage := GREATEST(500000, (COALESCE(v_player.rating, 60) - 50) * 100000);

    UPDATE league_players SET team_id = v_team_id, origin_type = 'drafted' WHERE id = v_player.id;

    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status, wage_discount_percent)
    VALUES (p_selected_player_id, v_team_id, v_wage, v_season, 3, 'active', 20)
    ON CONFLICT (team_id, player_id) DO UPDATE SET
      wage = v_wage,
      start_season = v_season,
      years = 3,
      status = 'active',
      wage_discount_percent = 20;

    UPDATE draft_picks SET is_used = true, player_id = p_selected_player_id WHERE id = p_draft_pick_id;
    INSERT INTO draft_selections (draft_pick_id, player_id, item_type) VALUES (p_draft_pick_id, p_selected_player_id, 'player');

    IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = v_league_id AND season = v_season AND is_used = false) THEN
      UPDATE leagues SET draft_active = false WHERE id = v_league_id;
    END IF;

    PERFORM write_audit_log(v_league_id, 'make_draft_pick', p_actor_user_id,
      json_build_object('pick_id', p_draft_pick_id, 'player_id', p_selected_player_id, 'team_id', v_team_id, 'bonus', v_bonus_type)::jsonb);

    PERFORM auto_resolve_mock_draft_picks(v_league_id);

    RETURN json_build_object('success', true, 'player_name', v_player.player_name, 'team_id', v_team_id);
  END IF;

  IF v_bonus_type = 'merch_pct' THEN
    UPDATE teams SET merch_percentage = COALESCE(merch_percentage, 0) + COALESCE(v_bonus_value, 0) WHERE id = v_team_id;
    UPDATE draft_picks SET is_used = true WHERE id = p_draft_pick_id;
    INSERT INTO draft_selections (draft_pick_id, player_id, item_type) VALUES (p_draft_pick_id, NULL, 'merch_pct');
    IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = v_league_id AND season = v_season AND is_used = false) THEN
      UPDATE leagues SET draft_active = false WHERE id = v_league_id;
    END IF;
    PERFORM write_audit_log(v_league_id, 'make_draft_pick', p_actor_user_id,
      json_build_object('pick_id', p_draft_pick_id, 'bonus', v_bonus_type, 'value', v_bonus_value, 'team_id', v_team_id)::jsonb);
    PERFORM auto_resolve_mock_draft_picks(v_league_id);
    RETURN json_build_object('success', true, 'bonus', v_bonus_type, 'value', v_bonus_value);
  END IF;

  IF v_bonus_type = 'upgrade_ticket' THEN
    INSERT INTO team_upgrade_tickets (team_id, tier) VALUES (v_team_id, COALESCE(NULLIF(LOWER(v_bonus_tier), ''), 'bronze'));
    UPDATE draft_picks SET is_used = true WHERE id = p_draft_pick_id;
    INSERT INTO draft_selections (draft_pick_id, player_id, item_type) VALUES (p_draft_pick_id, NULL, 'upgrade_ticket');
    IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = v_league_id AND season = v_season AND is_used = false) THEN
      UPDATE leagues SET draft_active = false WHERE id = v_league_id;
    END IF;
    PERFORM write_audit_log(v_league_id, 'make_draft_pick', p_actor_user_id,
      json_build_object('pick_id', p_draft_pick_id, 'bonus', v_bonus_type, 'tier', v_bonus_tier, 'team_id', v_team_id)::jsonb);
    PERFORM auto_resolve_mock_draft_picks(v_league_id);
    RETURN json_build_object('success', true, 'bonus', v_bonus_type, 'tier', v_bonus_tier);
  END IF;

  RETURN json_build_object('success', false, 'error', 'Unknown bonus type');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
