-- 049: resolve_free_agency - IL25 sealed-bid free agency resolution
-- offer_score = bonus + (salary * years * 0.5)
-- Tie-break: higher salary, longer years, earlier created_at

CREATE OR REPLACE FUNCTION resolve_free_agency(p_league_id UUID)
RETURNS JSON AS $$
DECLARE
  v_season INTEGER;
  v_status TEXT;
  v_fa RECORD;
  v_bids RECORD;
  v_winner_team_id UUID;
  v_winner_bonus INTEGER;
  v_winner_salary INTEGER;
  v_winner_years INTEGER;
  v_winner_bid_id UUID;
  v_roster_count INTEGER;
  v_budget INTEGER;
  v_assigned INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  SELECT season, status::TEXT INTO v_season, v_status
  FROM leagues WHERE id = p_league_id;

  IF v_status != 'OFFSEASON' THEN
    RETURN json_build_object('success', false, 'error', 'Free agency can only be resolved during OFFSEASON');
  END IF;

  -- For each free agent in this league with pending bids
  FOR v_fa IN
    SELECT DISTINCT lp.player_id, lp.id as league_player_id, lp.league_id, lp.player_name, lp.rating
    FROM league_players lp
    WHERE lp.league_id = p_league_id AND lp.team_id IS NULL
      AND EXISTS (
        SELECT 1 FROM free_agent_bids b
        WHERE b.league_id = p_league_id AND b.player_id = lp.player_id
          AND b.season = v_season AND b.status = 'pending'
      )
  LOOP
    -- Get best bid by offer_score (bonus + salary*years*0.5), tie-break: salary DESC, years DESC, created_at ASC
    SELECT b.id, b.team_id, b.bonus, b.salary, b.years
    INTO v_winner_bid_id, v_winner_team_id, v_winner_bonus, v_winner_salary, v_winner_years
    FROM free_agent_bids b
    WHERE b.league_id = p_league_id AND b.player_id = v_fa.player_id
      AND b.season = v_season AND b.status = 'pending'
    ORDER BY
      (b.bonus + (b.salary * b.years * 0.5)) DESC,
      b.salary DESC,
      b.years DESC,
      b.created_at ASC
    LIMIT 1;

    IF v_winner_team_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Re-validate winner: roster < 23, budget >= bonus
    SELECT COUNT(*) INTO v_roster_count
    FROM league_players WHERE team_id = v_winner_team_id;

    SELECT budget INTO v_budget FROM teams WHERE id = v_winner_team_id;

    IF (v_roster_count >= 23) OR (COALESCE(v_budget, 0) < v_winner_bonus) THEN
      -- Mark this bid as cancelled, move to next bidder (simplified: skip)
      UPDATE free_agent_bids SET status = 'cancelled' WHERE id = v_winner_bid_id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Assign player to team
    UPDATE league_players SET team_id = v_winner_team_id
    WHERE id = v_fa.league_player_id;

    -- Create contract
    INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
    VALUES (v_fa.player_id, v_winner_team_id, v_winner_salary, v_season, v_winner_years, 'active')
    ON CONFLICT (team_id, player_id) DO UPDATE SET
      wage = v_winner_salary,
      start_season = v_season,
      years = v_winner_years,
      status = 'active';

    -- Deduct signing bonus (write_finance_entry updates teams.budget)
    IF v_winner_bonus > 0 THEN
      PERFORM write_finance_entry(
        v_winner_team_id, p_league_id, -v_winner_bonus,
        'Signing Bonus', 'Free agency signing: ' || COALESCE(v_fa.player_name, v_fa.player_id),
        v_season
      );
    END IF;

    -- Mark winner and losers
    UPDATE free_agent_bids SET status = 'won' WHERE id = v_winner_bid_id;
    UPDATE free_agent_bids SET status = 'lost'
    WHERE league_id = p_league_id AND player_id = v_fa.player_id AND season = v_season AND id != v_winner_bid_id;

    v_assigned := v_assigned + 1;
  END LOOP;

  PERFORM write_audit_log(p_league_id, 'resolve_free_agency', NULL,
    json_build_object('assigned', v_assigned, 'skipped', v_skipped, 'season', v_season)::jsonb);

  RETURN json_build_object('success', true, 'assigned', v_assigned, 'skipped', v_skipped);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
