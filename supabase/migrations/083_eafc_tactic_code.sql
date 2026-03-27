-- 083: EAFC tactic import code for manual match mode
-- Users save their EAFC tactic code (e.g. m4@qGU2uyGCm) so hosts can import in-game.

ALTER TABLE teams ADD COLUMN IF NOT EXISTS eafc_tactic_code TEXT;
COMMENT ON COLUMN teams.eafc_tactic_code IS 'EAFC in-game tactic import code for manual match mode';
