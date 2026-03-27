-- 110: Per-player FA deadline and pool confirm flow
-- Each player in pool has own deadline. Pool is draft until host confirms.

ALTER TABLE free_agent_pool ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
COMMENT ON COLUMN free_agent_pool.deadline IS 'Bid deadline for this player. Bids after this time are rejected.';

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS fa_pool_status TEXT DEFAULT 'draft';
UPDATE leagues SET fa_pool_status = 'draft' WHERE fa_pool_status IS NULL;
ALTER TABLE leagues DROP CONSTRAINT IF EXISTS leagues_fa_pool_status_check;
ALTER TABLE leagues ADD CONSTRAINT leagues_fa_pool_status_check
  CHECK (fa_pool_status IN ('draft', 'confirmed'));
COMMENT ON COLUMN leagues.fa_pool_status IS 'draft = pool hidden from managers. confirmed = pool visible for bidding.';
