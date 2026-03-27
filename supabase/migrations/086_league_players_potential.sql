-- 086: Add potential to league_players for host-overridable per-league potential
ALTER TABLE league_players ADD COLUMN IF NOT EXISTS potential INTEGER;
COMMENT ON COLUMN league_players.potential IS 'Host-set potential (overrides player.potential when set). Used for wonderkid display.';
