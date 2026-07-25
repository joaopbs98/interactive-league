-- Dual auction systems: host Dutch Auction and manager Auction House.

ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'auction_house',
  ADD COLUMN IF NOT EXISTS asset_type TEXT NOT NULL DEFAULT 'player',
  ADD COLUMN IF NOT EXISTS upgrade_ticket_id UUID REFERENCES team_upgrade_tickets(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winning_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winning_amount INTEGER,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS unsold_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

ALTER TABLE auctions
  ADD CONSTRAINT auctions_status_check CHECK (status IN ('draft', 'active', 'finished')),
  ADD CONSTRAINT auctions_mode_check CHECK (mode IN ('dutch', 'auction_house')),
  ADD CONSTRAINT auctions_asset_type_check CHECK (asset_type IN ('player', 'upgrade_ticket')),
  ADD CONSTRAINT auctions_asset_check CHECK (
    (asset_type = 'player' AND player_id IS NOT NULL AND upgrade_ticket_id IS NULL) OR
    (asset_type = 'upgrade_ticket' AND player_id IS NULL AND upgrade_ticket_id IS NOT NULL)
  ),
  ADD CONSTRAINT auctions_amount_check CHECK (
    starting_bid >= 0 AND starting_bid % 100000 = 0 AND
    (reserve_amount IS NULL OR (reserve_amount >= 0 AND reserve_amount % 100000 = 0))
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_active_player
  ON auctions (league_id, player_id)
  WHERE status IN ('draft', 'active') AND player_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_active_ticket
  ON auctions (upgrade_ticket_id)
  WHERE status IN ('draft', 'active') AND upgrade_ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION auction_unsold_fee(p_reserve INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF COALESCE(p_reserve, 0) <= 0 THEN RETURN 0; END IF;
  RETURN GREATEST(100000, ROUND((p_reserve * 0.04) / 100000.0)::INTEGER * 100000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION create_auction_house_listing(
  p_league_id UUID,
  p_team_id UUID,
  p_asset_type TEXT,
  p_asset_id TEXT,
  p_starting_bid INTEGER,
  p_reserve INTEGER,
  p_end_time TIMESTAMPTZ,
  p_actor_user_id UUID
) RETURNS JSON AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM teams t JOIN leagues l ON l.id = t.league_id
    WHERE t.id = p_team_id AND t.league_id = p_league_id
      AND t.user_id = p_actor_user_id AND l.status = 'OFFSEASON'
  ) THEN RETURN json_build_object('success', false, 'error', 'Listings are only available to your team during transfer season'); END IF;
  IF p_end_time <= NOW() THEN RETURN json_build_object('success', false, 'error', 'Deadline must be in the future'); END IF;
  IF p_starting_bid < 0 OR p_starting_bid % 100000 <> 0 OR p_reserve < 0 OR p_reserve % 100000 <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amounts must use $100,000 increments');
  END IF;

  IF p_asset_type = 'player' THEN
    IF NOT EXISTS (SELECT 1 FROM league_players WHERE league_id = p_league_id AND team_id = p_team_id AND player_id = p_asset_id) THEN
      RETURN json_build_object('success', false, 'error', 'Player is not owned by your team');
    END IF;
    INSERT INTO auctions (league_id, mode, asset_type, player_id, team_id, starting_bid, reserve_amount, end_time, status, created_by)
    VALUES (p_league_id, 'auction_house', 'player', p_asset_id, p_team_id, p_starting_bid, p_reserve, p_end_time, 'active', p_actor_user_id)
    RETURNING id INTO v_id;
  ELSIF p_asset_type = 'upgrade_ticket' THEN
    IF NOT EXISTS (SELECT 1 FROM team_upgrade_tickets WHERE id = p_asset_id::UUID AND team_id = p_team_id AND used_on_player_id IS NULL) THEN
      RETURN json_build_object('success', false, 'error', 'Unused ticket is not owned by your team');
    END IF;
    INSERT INTO auctions (league_id, mode, asset_type, player_id, upgrade_ticket_id, team_id, starting_bid, reserve_amount, end_time, status, created_by)
    VALUES (p_league_id, 'auction_house', 'upgrade_ticket', NULL, p_asset_id::UUID, p_team_id, p_starting_bid, p_reserve, p_end_time, 'active', p_actor_user_id)
    RETURNING id INTO v_id;
  ELSE RETURN json_build_object('success', false, 'error', 'Unsupported asset type'); END IF;

  PERFORM write_audit_log(p_league_id, 'create_auction_listing', p_actor_user_id,
    jsonb_build_object('auction_id', v_id, 'team_id', p_team_id, 'asset_type', p_asset_type, 'asset_id', p_asset_id));
  RETURN json_build_object('success', true, 'auction_id', v_id, 'unsold_fee', auction_unsold_fee(p_reserve));
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'This asset is already listed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION publish_dutch_auction(
  p_league_id UUID,
  p_player_id TEXT,
  p_starting_bid INTEGER,
  p_end_time TIMESTAMPTZ,
  p_actor_user_id UUID
) RETURNS JSON AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = p_league_id AND commissioner_user_id = p_actor_user_id AND status = 'OFFSEASON') THEN
    RETURN json_build_object('success', false, 'error', 'Host-only during transfer season');
  END IF;
  IF p_end_time <= NOW() OR p_starting_bid < 0 OR p_starting_bid % 100000 <> 0 THEN
    RETURN json_build_object('success', false, 'error', 'Use a future deadline and $100,000 bid increments');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM league_players WHERE league_id = p_league_id AND player_id = p_player_id AND team_id IS NULL) THEN
    RETURN json_build_object('success', false, 'error', 'Player is not available in this league');
  END IF;
  INSERT INTO auctions (league_id, mode, asset_type, player_id, team_id, starting_bid, reserve_amount, end_time, status, created_by)
  VALUES (p_league_id, 'dutch', 'player', p_player_id, NULL, p_starting_bid, 0, p_end_time, 'active', p_actor_user_id)
  RETURNING id INTO v_id;
  PERFORM write_audit_log(p_league_id, 'publish_dutch_auction', p_actor_user_id, jsonb_build_object('auction_id', v_id, 'player_id', p_player_id));
  RETURN json_build_object('success', true, 'auction_id', v_id);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Player is already in an auction');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION place_auction_bid(
  p_auction_id UUID,
  p_team_id UUID,
  p_amount INTEGER,
  p_actor_user_id UUID
) RETURNS JSON AS $$
DECLARE v_auction RECORD; v_highest INTEGER; v_minimum INTEGER;
BEGIN
  SELECT a.* INTO v_auction FROM auctions a WHERE a.id = p_auction_id FOR UPDATE;
  IF v_auction IS NULL OR v_auction.status <> 'active' THEN RETURN json_build_object('success', false, 'error', 'Auction is not active'); END IF;
  IF v_auction.end_time <= NOW() THEN RETURN json_build_object('success', false, 'error', 'Auction has ended'); END IF;
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_auction.league_id AND status = 'OFFSEASON') THEN RETURN json_build_object('success', false, 'error', 'Bidding is only available during transfer season'); END IF;
  IF v_auction.team_id = p_team_id THEN RETURN json_build_object('success', false, 'error', 'You cannot bid on your own listing'); END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND league_id = v_auction.league_id AND user_id = p_actor_user_id AND budget >= p_amount) THEN
    RETURN json_build_object('success', false, 'error', 'Team not eligible or budget is insufficient');
  END IF;
  SELECT MAX(amount) INTO v_highest FROM bids WHERE auction_id = p_auction_id;
  v_minimum := CASE WHEN v_highest IS NULL THEN v_auction.starting_bid ELSE v_highest + 100000 END;
  IF p_amount < v_minimum OR p_amount % 100000 <> 0 THEN RETURN json_build_object('success', false, 'error', 'Bid must meet the minimum in $100,000 increments', 'minimum', v_minimum); END IF;
  INSERT INTO bids (auction_id, team_id, amount) VALUES (p_auction_id, p_team_id, p_amount);
  UPDATE auctions SET current_bid = p_amount WHERE id = p_auction_id;
  RETURN json_build_object('success', true, 'minimum_next_bid', p_amount + 100000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION finish_auction(p_auction_id UUID, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE v_auction RECORD; v_winner RECORD; v_fee INTEGER; v_season INTEGER; v_host BOOLEAN;
BEGIN
  SELECT a.* INTO v_auction FROM auctions a WHERE a.id = p_auction_id FOR UPDATE;
  IF v_auction IS NULL THEN RETURN json_build_object('success', false, 'error', 'Auction not found'); END IF;
  IF v_auction.status = 'finished' THEN RETURN json_build_object('success', true, 'already_finished', true, 'outcome', v_auction.outcome); END IF;
  SELECT season, commissioner_user_id = p_actor_user_id INTO v_season, v_host FROM leagues WHERE id = v_auction.league_id;
  IF NOT COALESCE(v_host, false) AND v_auction.end_time > NOW() THEN RETURN json_build_object('success', false, 'error', 'Auction has not ended'); END IF;

  SELECT b.team_id, b.amount INTO v_winner
  FROM bids b JOIN teams t ON t.id = b.team_id
  WHERE b.auction_id = p_auction_id AND t.budget >= b.amount
  ORDER BY b.amount DESC, b.created_at ASC LIMIT 1;

  IF v_winner.team_id IS NOT NULL AND v_winner.amount >= COALESCE(v_auction.reserve_amount, 0) THEN
    IF v_auction.asset_type = 'player' THEN
      UPDATE league_players SET team_id = v_winner.team_id WHERE league_id = v_auction.league_id AND player_id = v_auction.player_id;
      UPDATE contracts SET team_id = v_winner.team_id WHERE player_id = v_auction.player_id AND team_id IN (SELECT id FROM teams WHERE league_id = v_auction.league_id);
      IF NOT FOUND THEN
        INSERT INTO contracts (player_id, team_id, wage, start_season, years, status)
        SELECT v_auction.player_id, v_winner.team_id, GREATEST(500000, (COALESCE(lp.rating, 60) - 50) * 100000), v_season, 3, 'active'
        FROM league_players lp WHERE lp.league_id = v_auction.league_id AND lp.player_id = v_auction.player_id
        ON CONFLICT (team_id, player_id) DO NOTHING;
      END IF;
    ELSE
      UPDATE team_upgrade_tickets SET team_id = v_winner.team_id WHERE id = v_auction.upgrade_ticket_id AND used_on_player_id IS NULL;
    END IF;
    PERFORM write_finance_entry(v_winner.team_id, v_auction.league_id, -v_winner.amount, 'Auction', 'Won auction', v_season, 'auction', v_auction.id);
    IF v_auction.team_id IS NOT NULL THEN PERFORM write_finance_entry(v_auction.team_id, v_auction.league_id, v_winner.amount, 'Auction', 'Sold auction asset', v_season, 'auction', v_auction.id); END IF;
    UPDATE auctions SET status = 'finished', outcome = 'sold', winning_team_id = v_winner.team_id, winning_amount = v_winner.amount, unsold_fee = 0, finished_at = NOW() WHERE id = p_auction_id;
  ELSE
    v_fee := CASE WHEN v_auction.mode = 'auction_house' THEN auction_unsold_fee(COALESCE(v_auction.reserve_amount, 0)) ELSE 0 END;
    IF v_auction.team_id IS NOT NULL AND v_fee > 0 THEN PERFORM write_finance_entry(v_auction.team_id, v_auction.league_id, -v_fee, 'Auction Fee', 'Auction asset unsold', v_season, 'auction', v_auction.id); END IF;
    UPDATE auctions SET status = 'finished', outcome = 'unsold', winning_team_id = NULL, winning_amount = NULL, unsold_fee = v_fee, finished_at = NOW() WHERE id = p_auction_id;
  END IF;
  PERFORM write_audit_log(v_auction.league_id, 'finish_auction', p_actor_user_id, jsonb_build_object('auction_id', p_auction_id));
  RETURN json_build_object('success', true, 'outcome', (SELECT outcome FROM auctions WHERE id = p_auction_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_auction_listing(p_auction_id UUID, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE v_auction RECORD;
BEGIN
  SELECT a.* INTO v_auction FROM auctions a WHERE a.id = p_auction_id FOR UPDATE;
  IF v_auction IS NULL OR v_auction.status <> 'active' OR v_auction.mode <> 'auction_house' THEN RETURN json_build_object('success', false, 'error', 'Listing is not active'); END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_auction.team_id AND user_id = p_actor_user_id) THEN RETURN json_build_object('success', false, 'error', 'Not your listing'); END IF;
  IF EXISTS (SELECT 1 FROM bids WHERE auction_id = p_auction_id) THEN RETURN json_build_object('success', false, 'error', 'A listing with bids cannot be cancelled'); END IF;
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_auction.league_id AND status = 'OFFSEASON') THEN RETURN json_build_object('success', false, 'error', 'Transfer season is closed'); END IF;
  UPDATE auctions SET status = 'finished', outcome = 'cancelled', finished_at = NOW() WHERE id = p_auction_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION resolve_expired_auctions(p_league_id UUID, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE v_row RECORD; v_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = p_league_id AND commissioner_user_id = p_actor_user_id) THEN RETURN json_build_object('success', false, 'error', 'Host only'); END IF;
  FOR v_row IN SELECT id FROM auctions WHERE league_id = p_league_id AND status = 'active' AND end_time <= NOW() LOOP
    PERFORM finish_auction(v_row.id, p_actor_user_id); v_count := v_count + 1;
  END LOOP;
  RETURN json_build_object('success', true, 'resolved', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Listed tickets cannot be consumed through the existing RPC.
CREATE OR REPLACE FUNCTION use_upgrade_ticket(p_ticket_id UUID, p_player_id TEXT, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE v_ticket RECORD; v_rating_boost INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM auctions WHERE upgrade_ticket_id = p_ticket_id AND status IN ('draft', 'active')) THEN RETURN json_build_object('success', false, 'error', 'Ticket is listed in an auction'); END IF;
  SELECT t.id, t.team_id, t.tier, t.used_on_player_id INTO v_ticket FROM team_upgrade_tickets t WHERE t.id = p_ticket_id;
  IF v_ticket IS NULL THEN RETURN json_build_object('success', false, 'error', 'Ticket not found'); END IF;
  IF v_ticket.used_on_player_id IS NOT NULL THEN RETURN json_build_object('success', false, 'error', 'Ticket already used'); END IF;
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_ticket.team_id AND user_id = p_actor_user_id) THEN RETURN json_build_object('success', false, 'error', 'Not your team'); END IF;
  IF NOT EXISTS (SELECT 1 FROM league_players WHERE team_id = v_ticket.team_id AND player_id = p_player_id) THEN RETURN json_build_object('success', false, 'error', 'Player not on your team'); END IF;
  v_rating_boost := CASE v_ticket.tier WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 WHEN 'gold' THEN 3 WHEN 'platinum' THEN 4 ELSE 1 END;
  UPDATE league_players SET rating = LEAST(99, COALESCE(rating, 0) + v_rating_boost) WHERE team_id = v_ticket.team_id AND player_id = p_player_id;
  UPDATE team_upgrade_tickets SET used_on_player_id = p_player_id, used_at = NOW() WHERE id = p_ticket_id;
  RETURN json_build_object('success', true, 'rating_boost', v_rating_boost, 'player_id', p_player_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
