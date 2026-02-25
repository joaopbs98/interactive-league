-- 068: Transfer list enhancements (IL25 spec §6)
-- looking_for: criteria (e.g. "81+ RB"); accepts_trades: Cash OR "Trades or cash"

ALTER TABLE transfer_listings ADD COLUMN IF NOT EXISTS looking_for TEXT;
ALTER TABLE transfer_listings ADD COLUMN IF NOT EXISTS accepts_trades BOOLEAN DEFAULT false;

COMMENT ON COLUMN transfer_listings.looking_for IS 'What the seller is looking for (e.g. "81+ RB", specific player)';
COMMENT ON COLUMN transfer_listings.accepts_trades IS 'If true, accepts trades or cash; if false, cash only';
