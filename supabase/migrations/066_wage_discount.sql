-- 066: Wage discount - drafted 20%, packed 10% (IL25 spec)
-- wage_bill = sum(wage * (1 - discount/100))

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS wage_discount_percent INTEGER DEFAULT 0;

COMMENT ON COLUMN contracts.wage_discount_percent IS 'Discount %: drafted=20, packed=10, on transfer drafted drops to 10';

-- Update calculate_team_wages to apply discounts
CREATE OR REPLACE FUNCTION calculate_team_wages(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_wages INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    c.wage * (1 - COALESCE(c.wage_discount_percent, 0) / 100.0)
  ), 0)::INTEGER INTO total_wages
  FROM contracts c
  WHERE c.team_id = p_team_id AND c.status = 'active';
  
  RETURN total_wages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update make_draft_pick to set wage_discount_percent = 20 for drafted players
CREATE OR REPLACE FUNCTION make_draft_pick(
  p_draft_pick_id UUID,
  p_selected_player_id TEXT,
  p_actor_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_team_id UUID;
  v_league_id UUID;
  v_season INTEGER;
  v_roster_count INTEGER;
  v_player RECORD;
  v_wage INTEGER;
BEGIN
  SELECT dp.team_id, dp.league_id, l.season
  INTO v_team_id, v_league_id, v_season
  FROM draft_picks dp
  JOIN leagues l ON l.id = dp.league_id
  WHERE dp.id = p_draft_pick_id AND dp.is_used = false;

  IF v_team_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or already used draft pick');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_team_id AND user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not your pick');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_league_id AND status = 'OFFSEASON' AND draft_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Draft not active');
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
    json_build_object('pick_id', p_draft_pick_id, 'player_id', p_selected_player_id, 'team_id', v_team_id)::jsonb);

  RETURN json_build_object('success', true, 'player_name', v_player.player_name, 'team_id', v_team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
