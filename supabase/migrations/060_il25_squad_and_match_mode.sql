-- 060: IL25 squad and match mode - match_mode, transfer_window, transfer_request, origin_type
-- Per IL25 spec: SIMULATED | MANUAL match modes; transfer window host-controlled;
-- league_players.transfer_request for sponsor failure; origin_type for wage discounts

DO $$ BEGIN
  CREATE TYPE match_mode AS ENUM ('SIMULATED', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS match_mode match_mode DEFAULT 'SIMULATED';
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS transfer_window_open BOOLEAN DEFAULT true;

ALTER TABLE league_players ADD COLUMN IF NOT EXISTS transfer_request BOOLEAN DEFAULT false;
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS origin_type TEXT;

COMMENT ON COLUMN leagues.match_mode IS 'SIMULATED = app generates results; MANUAL = host inserts EAFC results';
COMMENT ON COLUMN leagues.transfer_window_open IS 'When true, managers can make roster moves (trades, signings, etc.)';
COMMENT ON COLUMN league_players.transfer_request IS 'Set by sponsor failure; player requests transfer';
COMMENT ON COLUMN league_players.origin_type IS 'drafted | packed | signed | trade - used for wage discounts';
