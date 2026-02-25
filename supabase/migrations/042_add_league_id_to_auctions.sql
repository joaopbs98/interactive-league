-- 042: Add league_id to auctions for league-scoped auctions (per final_doc 4.11)
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_auctions_league_id ON auctions(league_id);
