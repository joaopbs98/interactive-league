-- 082: Auction reserve fees (moderator rule)
-- If sold: no fee. If unsold: charge 4% of reserve to listing team.

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS reserve_amount INTEGER;
COMMENT ON COLUMN auctions.team_id IS 'Team that listed the player (pays 4% reserve fee if unsold)';
COMMENT ON COLUMN auctions.reserve_amount IS 'Reserve price; 4% charged to listing team if auction ends unsold';

-- Backfill reserve_amount from starting_bid for existing auctions
UPDATE auctions SET reserve_amount = starting_bid WHERE reserve_amount IS NULL;

-- RPC: Finish auction - assign winner if sold, charge 4% reserve fee if unsold
CREATE OR REPLACE FUNCTION finish_auction(p_auction_id UUID, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_auction RECORD;
  v_winner_bid RECORD;
  v_listing_team_id UUID;
  v_reserve INTEGER;
  v_fee INTEGER;
  v_season INTEGER;
BEGIN
  SELECT a.* INTO v_auction
  FROM auctions a
  WHERE a.id = p_auction_id;

  IF v_auction IS NOT NULL AND v_auction.league_id IS NOT NULL THEN
    SELECT season INTO v_season FROM leagues WHERE id = v_auction.league_id;
  END IF;

  IF v_auction IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Auction not found');
  END IF;

  IF v_auction.status = 'finished' THEN
    RETURN json_build_object('success', false, 'error', 'Auction already finished');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leagues WHERE id = v_auction.league_id AND commissioner_user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Host only');
  END IF;

  v_reserve := COALESCE(v_auction.reserve_amount, v_auction.starting_bid);
  v_listing_team_id := v_auction.team_id;
  IF v_listing_team_id IS NULL AND v_auction.league_id IS NOT NULL THEN
    SELECT c.team_id INTO v_listing_team_id
    FROM contracts c
    JOIN teams t ON t.id = c.team_id
    WHERE c.player_id = v_auction.player_id AND t.league_id = v_auction.league_id AND c.status = 'active'
    LIMIT 1;
  END IF;

  SELECT b.team_id, b.amount INTO v_winner_bid
  FROM bids b
  WHERE b.auction_id = p_auction_id
  ORDER BY b.amount DESC
  LIMIT 1;

  UPDATE auctions SET status = 'finished' WHERE id = p_auction_id;

  IF v_winner_bid.team_id IS NOT NULL AND v_winner_bid.amount >= v_reserve THEN
    -- Sold: assign player to winner, no fee
    UPDATE league_players SET team_id = v_winner_bid.team_id
    WHERE league_id = v_auction.league_id AND player_id = v_auction.player_id;

    UPDATE contracts SET team_id = v_winner_bid.team_id
    WHERE player_id = v_auction.player_id
      AND team_id IN (SELECT id FROM teams WHERE league_id = v_auction.league_id);

    PERFORM write_finance_entry(
      v_winner_bid.team_id, v_auction.league_id, -v_winner_bid.amount,
      'Auction', 'Won auction for player',
      COALESCE(v_season, 1)
    );

    IF v_listing_team_id IS NOT NULL THEN
      PERFORM write_finance_entry(
        v_listing_team_id, v_auction.league_id, v_winner_bid.amount,
        'Auction', 'Sold player via auction',
        COALESCE(v_season, 1)
      );
    END IF;

    RETURN json_build_object('success', true, 'sold', true, 'winner_team_id', v_winner_bid.team_id);
  ELSE
    -- Unsold: charge 4% of reserve to listing team
    v_fee := (v_reserve * 0.04)::INTEGER;
    IF v_listing_team_id IS NOT NULL AND v_fee > 0 THEN
      PERFORM write_finance_entry(
        v_listing_team_id, v_auction.league_id, -v_fee,
        'Auction Fee', '4% reserve fee (auction unsold)',
        COALESCE(v_season, 1)
      );
    END IF;
    RETURN json_build_object('success', true, 'sold', false, 'reserve_fee', v_fee);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
