-- Keep the settlement implementation private and put league membership checks
-- plus user notifications around every public settlement call.
ALTER FUNCTION finish_auction(UUID, UUID) RENAME TO finish_auction_unchecked;

CREATE OR REPLACE FUNCTION finish_auction(p_auction_id UUID, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_auction RECORD;
  v_result JSON;
  v_winning_team_id UUID;
BEGIN
  SELECT a.id, a.league_id, a.team_id, a.winning_team_id, a.asset_type,
         COALESCE(lp.full_name, lp.player_name, tut.tier || ' upgrade ticket', 'Auction asset') AS asset_name
  INTO v_auction
  FROM auctions a
  LEFT JOIN league_players lp ON lp.league_id = a.league_id AND lp.player_id = a.player_id
  LEFT JOIN team_upgrade_tickets tut ON tut.id = a.upgrade_ticket_id
  WHERE a.id = p_auction_id;

  IF v_auction IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Auction not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM leagues l
    WHERE l.id = v_auction.league_id
      AND (
        l.commissioner_user_id = p_actor_user_id
        OR EXISTS (SELECT 1 FROM teams t WHERE t.league_id = l.id AND t.user_id = p_actor_user_id)
      )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this league');
  END IF;

  v_result := finish_auction_unchecked(p_auction_id, p_actor_user_id);

  IF COALESCE((v_result->>'success')::BOOLEAN, false)
     AND NOT COALESCE((v_result->>'already_finished')::BOOLEAN, false) THEN
    SELECT a.winning_team_id INTO v_winning_team_id FROM auctions a WHERE a.id = p_auction_id;

    INSERT INTO notifications (user_id, league_id, team_id, type, title, message)
    SELECT t.user_id, v_auction.league_id, t.id, 'auction_finished',
           CASE WHEN t.id = v_winning_team_id THEN 'Auction won' ELSE 'Auction finished' END,
           v_auction.asset_name || ' finished as ' || COALESCE(v_result->>'outcome', 'finished') || '.'
    FROM teams t
    WHERE t.id IN (v_auction.team_id, v_winning_team_id)
      AND t.user_id IS NOT NULL;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION finish_auction_unchecked(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finish_auction(UUID, UUID) TO authenticated;
