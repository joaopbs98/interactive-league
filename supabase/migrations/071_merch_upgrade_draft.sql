-- 071: Draft merch_pct adds to team.merch_percentage; upgrade tickets (Bronze/Silver/Gold/Platinum)

-- team_upgrade_tickets: store upgrade tickets earned from draft
CREATE TABLE IF NOT EXISTS team_upgrade_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  used_on_player_id TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_upgrade_tickets_team ON team_upgrade_tickets(team_id);
COMMENT ON TABLE team_upgrade_tickets IS 'Upgrade tickets from draft: Bronze +1, Silver +2, Gold +3, Platinum +4 OVR when used';

ALTER TABLE team_upgrade_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own team upgrade tickets" ON team_upgrade_tickets
  FOR SELECT USING (team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()));

-- RPC: use upgrade ticket on a player (adds rating)
CREATE OR REPLACE FUNCTION use_upgrade_ticket(
  p_ticket_id UUID,
  p_player_id TEXT,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_ticket RECORD;
  v_rating_boost INTEGER;
BEGIN
  SELECT t.id, t.team_id, t.tier, t.used_on_player_id
  INTO v_ticket
  FROM team_upgrade_tickets t
  WHERE t.id = p_ticket_id;

  IF v_ticket IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.used_on_player_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Ticket already used');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_ticket.team_id AND user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not your team');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM league_players WHERE team_id = v_ticket.team_id AND player_id = p_player_id) THEN
    RETURN json_build_object('success', false, 'error', 'Player not on your team');
  END IF;

  v_rating_boost := CASE v_ticket.tier
    WHEN 'bronze' THEN 1
    WHEN 'silver' THEN 2
    WHEN 'gold' THEN 3
    WHEN 'platinum' THEN 4
    ELSE 1
  END;

  UPDATE league_players SET rating = LEAST(99, COALESCE(rating, 0) + v_rating_boost)
  WHERE team_id = v_ticket.team_id AND player_id = p_player_id;

  UPDATE team_upgrade_tickets SET used_on_player_id = p_player_id, used_at = NOW() WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'rating_boost', v_rating_boost, 'player_id', p_player_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update make_draft_pick: merch_pct adds to team.merch_percentage; upgrade_ticket grants ticket
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

  -- Verify actor owns the team that has this pick
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_team_id AND user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to use this pick');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_league_id AND status = 'OFFSEASON' AND draft_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Draft not active');
  END IF;

  -- For player picks (player, player_choice_80): require player selection
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

    -- Player of choice (80): selected player must have OVR <= 80
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

    RETURN json_build_object('success', true, 'player_name', v_player.player_name, 'team_id', v_team_id);
  END IF;

  -- merch_pct: add fixed % on top of current team.merch_percentage
  IF v_bonus_type = 'merch_pct' THEN
    UPDATE teams SET merch_percentage = COALESCE(merch_percentage, 0) + COALESCE(v_bonus_value, 0)
    WHERE id = v_team_id;

    UPDATE draft_picks SET is_used = true WHERE id = p_draft_pick_id;
    INSERT INTO draft_selections (draft_pick_id, player_id, item_type) VALUES (p_draft_pick_id, NULL, 'merch_pct');
    IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = v_league_id AND season = v_season AND is_used = false) THEN
      UPDATE leagues SET draft_active = false WHERE id = v_league_id;
    END IF;
    PERFORM write_audit_log(v_league_id, 'make_draft_pick', p_actor_user_id,
      json_build_object('pick_id', p_draft_pick_id, 'bonus', v_bonus_type, 'value', v_bonus_value, 'team_id', v_team_id)::jsonb);
    RETURN json_build_object('success', true, 'bonus_type', v_bonus_type, 'value_added', v_bonus_value, 'team_id', v_team_id);
  END IF;

  -- upgrade_ticket: grant ticket (Bronze/Silver/Gold/Platinum)
  IF v_bonus_type = 'upgrade_ticket' THEN
    INSERT INTO team_upgrade_tickets (team_id, tier)
    VALUES (v_team_id, COALESCE(NULLIF(LOWER(v_bonus_tier), ''), 'bronze'));

    UPDATE draft_picks SET is_used = true WHERE id = p_draft_pick_id;
    INSERT INTO draft_selections (draft_pick_id, player_id, item_type) VALUES (p_draft_pick_id, NULL, 'upgrade_ticket');
    IF NOT EXISTS (SELECT 1 FROM draft_picks WHERE league_id = v_league_id AND season = v_season AND is_used = false) THEN
      UPDATE leagues SET draft_active = false WHERE id = v_league_id;
    END IF;
    PERFORM write_audit_log(v_league_id, 'make_draft_pick', p_actor_user_id,
      json_build_object('pick_id', p_draft_pick_id, 'bonus', v_bonus_type, 'tier', v_bonus_tier, 'team_id', v_team_id)::jsonb);
    RETURN json_build_object('success', true, 'bonus_type', v_bonus_type, 'tier', COALESCE(v_bonus_tier, 'bronze'), 'team_id', v_team_id);
  END IF;

  RETURN json_build_object('success', false, 'error', 'Unknown bonus type');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
