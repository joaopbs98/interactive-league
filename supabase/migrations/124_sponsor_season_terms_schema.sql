-- 124: Sponsor season terms schema - IL25 sponsor system overhaul
-- New tables: sponsor_season_terms, sponsor_payout_tiers
-- Extend teams: sponsor_contract_ends_season
-- Extend sponsors: contract_start_seasons (optional for built-in sponsors)

CREATE TABLE IF NOT EXISTS sponsor_season_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  base_payment INTEGER NOT NULL DEFAULT 0,
  bonus_amount INTEGER,
  bonus_condition_code TEXT,
  bonus_merch_pct NUMERIC DEFAULT 0,
  transfer_request_count INTEGER DEFAULT 0,
  transfer_request_rank INTEGER DEFAULT 1,
  merch_modifier NUMERIC DEFAULT 0,
  repayment_penalty INTEGER DEFAULT 0,
  payout_type TEXT DEFAULT 'fixed' CHECK (payout_type IN ('fixed', 'performance_tier')),
  UNIQUE(sponsor_id, season)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_season_terms_sponsor_season ON sponsor_season_terms(sponsor_id, season);

COMMENT ON TABLE sponsor_season_terms IS 'Per-season terms for built-in sponsors (Vodafone, Spotify, Qatar)';
COMMENT ON COLUMN sponsor_season_terms.transfer_request_rank IS '1=highest rated, 2=2nd highest, etc.';
COMMENT ON COLUMN sponsor_season_terms.payout_type IS 'fixed=base+bonus; performance_tier=lookup by competition stage';

CREATE TABLE IF NOT EXISTS sponsor_payout_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_season_term_id UUID NOT NULL REFERENCES sponsor_season_terms(id) ON DELETE CASCADE,
  competition TEXT NOT NULL CHECK (competition IN ('uecl', 'uel', 'ucl')),
  stage_pattern TEXT NOT NULL,
  payout_amount INTEGER NOT NULL DEFAULT 0,
  merch_modifier NUMERIC DEFAULT 0,
  transfer_request_count INTEGER DEFAULT 0,
  transfer_request_rank INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sponsor_payout_tiers_term ON sponsor_payout_tiers(sponsor_season_term_id);

COMMENT ON TABLE sponsor_payout_tiers IS 'Performance-based payout by competition stage (Spotify S6/S8, Qatar S6/S8/S10)';

ALTER TABLE teams ADD COLUMN IF NOT EXISTS sponsor_contract_ends_season INTEGER;
COMMENT ON COLUMN teams.sponsor_contract_ends_season IS 'Season when sponsor contract ends. S2-S4: 4; S5-S6: 6; S7-S8: 8; S9-S10: 10';

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contract_start_seasons INTEGER[] DEFAULT NULL;
COMMENT ON COLUMN sponsors.contract_start_seasons IS 'Seasons when sponsor can be picked: {2,5,7,9} for main sponsors';

ALTER TABLE sponsor_season_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_payout_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sponsor_season_terms" ON sponsor_season_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read sponsor_payout_tiers" ON sponsor_payout_tiers FOR SELECT TO authenticated USING (true);
